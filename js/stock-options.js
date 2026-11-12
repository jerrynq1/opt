/* ================= BINANCE STOCK OPTIONS: QQQ + GLD =================
   Uses a narrowly allow-listed Cloudflare Worker proxy for Binance Stock
   Options REST endpoints (the quote endpoint is origin-restricted by Binance).
   Stock candles and underlying prices use Binance Equity WebSocket directly.
   Public stock Kline stream is live-only: historical bars are not fabricated.
*/
(function(){
  'use strict';

  const API_BASE = String(window.BINANCE_STOCK_PROXY || '').replace(/\/+$/, '');
  const API_PREFIX = API_BASE + '/api/binance-stock-proxy';
  // Binance HAR confirms chain-symbols replies with Access-Control-Allow-Origin: *.
  // Try this public GET directly from GitHub Pages; only quote POST stays on Worker
  // because Binance restricts that endpoint's CORS origin to www.binance.com.
  const BINANCE_PUBLIC_BASE = 'https://www.binance.com';
  const DIRECT_PUBLIC_PATHS = ['/bapi/equity/v1/public/equity/option/chain-symbols', '/bapi/equity/v1/public/equity/option/get-config', '/bapi/equity/v1/public/equity/option/get-exchange-info'];
  function ensureProxyConfigured(){
    if(!API_BASE) throw new Error('Chưa cấu hình Cloudflare Worker. Hãy deploy worker/ rồi dán URL workers.dev vào js/stock-options-config.js.');
  }
  const WS_URL = 'wss://nbstream.binance.com/equity/stream';
  const CONFIG = {
    qqq: {key:'qqq', symbol:'QQQ', assetCode:'EQ_QQQ', name:'Invesco QQQ Trust', root:'QQQ'},
    gld: {key:'gld', symbol:'GLD', assetCode:'EQ_GLD', name:'SPDR Gold Trust', root:'GLD'}
  };
  const sessions = {};
  const $ = id => document.getElementById(id);
  const num = x => {
    if(x === null || x === undefined || x === '') return null;
    const v = Number(x); return Number.isFinite(v) ? v : null;
  };
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = (x,d=2) => x===null || !Number.isFinite(Number(x)) ? '—' : Number(x).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
  const compact = x => x===null || !Number.isFinite(Number(x)) ? '—' : Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(Number(x));
  const pct = x => x===null || !Number.isFinite(Number(x)) ? '—' : (Number(x)*100).toFixed(2)+'%';
  const isoTodayNY = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const dateLabel = iso => {
    if(!iso) return '—';
    const d = new Date(iso+'T12:00:00Z');
    return new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(d);
  };
  const strikeKey = x => Number(x).toFixed(6).replace(/0+$/,'').replace(/\.$/,'');

  function pageMarkup(cfg){
    const p = `so-${cfg.key}`;
    return `
      <div class="so-head">
        <div><div class="options-eyebrow">BINANCE EQUITY OPTIONS · STOCKS</div>
          <h2>${cfg.symbol} <span>· ${cfg.name}</span></h2>
          <p class="msg">Underlying, Option Chain, Greeks, Open Interest và Exposure từ Binance Equity Options.</p>
        </div>
        <div class="opt-actions"><span class="opt-status" id="${p}-status">Chưa đồng bộ</span><button class="btn sm" id="${p}-refresh" type="button">↻ Làm mới</button></div>
      </div>
      <div class="opt-errors" id="${p}-error" hidden></div>
      <div class="so-kpis" id="${p}-kpis">
        <div class="opt-metric"><span>LAST PRICE</span><strong>—</strong><small>Binance Equity</small></div>
        <div class="opt-metric"><span>CHANGE</span><strong>—</strong><small>So với previous close</small></div>
        <div class="opt-metric"><span>CALL OI</span><strong>—</strong><small>Hợp đồng có OI</small></div>
        <div class="opt-metric"><span>PUT OI</span><strong>—</strong><small>Hợp đồng có OI</small></div>
        <div class="opt-metric"><span>TOTAL VOLUME</span><strong>—</strong><small>Call + Put</small></div>
        <div class="opt-metric"><span>OI COVERAGE</span><strong>—</strong><small>Quote có OI / tổng contract</small></div>
      </div>
      <div class="card so-chain-toolbar">
        <div class="opt-toolbar">
          <div class="opt-control"><label for="${p}-expiry">EXPIRATION</label><select id="${p}-expiry"><option value="">Đang tải kỳ hạn…</option></select></div>
          <div class="opt-control"><label for="${p}-strike-count">HIỂN THỊ STRIKE</label><select id="${p}-strike-count"><option value="5">5 strikes</option><option value="10">10 strikes</option><option value="15" selected>15 strikes</option><option value="20">20 strikes</option><option value="30">30 strikes</option><option value="50">50 strikes</option><option value="100">100 strikes</option><option value="all">Tất cả</option></select></div>
          <div class="opt-source">Underlying: <b>${cfg.symbol}</b> · Contract multiplier: <b id="${p}-contract-multiplier">—</b> · Quote source: Binance Stock Options</div>
        </div>
        <div class="so-chain-meta" id="${p}-chain-meta">Đang lấy Option Chain…</div>
      </div>
      <div class="card so-level-card">
        <div class="opt-card-title"><div><h3>Key Levels</h3><small>Ước lượng từ OI và Greeks của expiry được chọn</small></div><button class="btn ghost sm" type="button" id="${p}-copy">Copy Levels</button></div>
        <div class="opt-levels-grid so-levels" id="${p}-levels"><div class="opt-empty">Đang chờ dữ liệu OI…</div></div>
      </div>
      <div class="opt-main-grid so-exposure-grid">
        <div class="card so-exposure-card">
          <div class="so-exposure-window">
            <div class="so-exposure-windowbar">
              <div class="so-exposure-windowtitle"><span class="so-exposure-dots"><i></i><i></i><i></i></span><span>EXPOSURE</span></div>
              <div class="so-exposure-windowcontrols"><span class="so-exposure-feed">${cfg.symbol} · OPTIONS</span>
                <select id="${p}-exposure-metric" class="opt-exposure-select" aria-label="Chọn loại Exposure"><option value="gamma">GEX · Gamma</option><option value="delta">DEX · Delta</option><option value="vega">VGEX · Vega</option><option value="theta">THEX · Theta</option></select>
              </div>
            </div>
            <div class="so-exposure-caption"><div><strong id="${p}-exposure-title">GAMMA EXPOSURE</strong><span id="${p}-exposure-subtitle">Calls → right · Puts ← left</span></div><small id="${p}-exposure-units">USD notional per 1% move</small></div>
            <div class="opt-gex-chart so-exposure" id="${p}-gex"><div class="opt-empty">Đang chờ Greeks/OI…</div></div>
            <div class="so-exposure-legend"><span><i class="call"></i>CALL EXPOSURE</span><span><i class="put"></i>PUT EXPOSURE</span><span><i class="spot"></i>UNDERLYING SPOT</span><span><i class="call-wall"></i>CALL OI WALL</span><span><i class="put-wall"></i>PUT OI WALL</span><span><i class="gex-call-wall"></i>CW · MAX +GEX</span><span><i class="gex-put-wall"></i>PW · MAX −GEX</span></div>
          </div>
          <p class="opt-mode-note" id="${p}-exposure-note">Call và Put được tách theo option side; OI không cho biết holder đang Long hay Short.</p>
        </div>
        <div class="card so-greeks-card"><div class="opt-card-title"><div><h3>Aggregate Greeks</h3><small>Expiry đang chọn</small></div></div><div class="opt-greeks" id="${p}-greeks"><div class="opt-empty">Đang tính…</div></div></div>
      </div>
      <div class="card so-oi-card">
        <div class="opt-card-title"><h3>Open Interest by Strike</h3><small class="opt-chart-meta"><span class="opt-legend-item"><i class="opt-legend-call"></i>Call</span><span class="opt-legend-item"><i class="opt-legend-put"></i>Put</span><b id="${p}-oiwall">OI Wall: —</b></small></div>
        <div class="so-oi-chart" id="${p}-oi"><div class="opt-empty">Đang chờ OI…</div></div>
      </div>
      <div class="card opt-chain-card">
        <div class="opt-card-title"><div><h3>Option Chain · ${cfg.symbol}</h3><small>Call / Put · Bid / Ask · Mid · Volume · Open Interest · IV · Greeks</small></div><small id="${p}-rows-count">— contracts</small></div>
        <div class="opt-table-wrap"><table class="opt-chain so-chain-table">
          <thead><tr><th colspan="9" class="call-head">CALLS</th><th rowspan="2">STRIKE</th><th colspan="9" class="put-head">PUTS</th></tr>
          <tr><th>Bid × Size</th><th>Ask × Size</th><th>Mid</th><th>Last</th><th>Volume</th><th>OI</th><th>IV</th><th>Delta</th><th>Gamma</th><th>Gamma</th><th>Delta</th><th>IV</th><th>OI</th><th>Volume</th><th>Last</th><th>Mid</th><th>Ask × Size</th><th>Bid × Size</th></tr></thead>
          <tbody id="${p}-chain"><tr><td colspan="19" class="opt-empty">Đang tải Option Chain…</td></tr></tbody>
        </table></div>
      </div>
      <div class="card so-method-card"><div class="opt-card-title"><h3>Data Status & Methodology</h3><button class="btn ghost sm" type="button" id="${p}-method-toggle">Giải thích cách tính</button></div>
        <div class="opt-meta" id="${p}-meta">
          <span class="opt-meta-item"><small>OPTIONS FEED</small><b>Binance Stock Options</b></span>
          <span class="opt-meta-item"><small>SPOT REFERENCE</small><b>Binance Equity WebSocket</b></span>
          <span class="opt-meta-item"><small>GREEKS MODEL</small><b>OI × Greek × multiplier</b></span>
          <span class="opt-meta-item"><small>MISSING OI</small><b>Giữ null, không thay bằng 0</b></span>
        </div>
        <div class="opt-method" id="${p}-method" hidden>
          <p><strong>Nguồn Option Chain:</strong> Binance Stock Options <code>option/chain-symbols</code> liệt kê OCC symbols theo ngày đáo hạn; <code>get-option-quote</code> trả Bid/Ask/Mid, volume, OI, multiplier, IV và Greeks.</p>
          <p><strong>Contract size:</strong> multiplier đọc từ từng option quote (mẫu GLD trong HAR là 100 shares/contract). Không hardcode OI và không thay <code>null</code> bằng 0.</p>
          <p><strong>GEX:</strong> Σ(Gamma × OI × multiplier × Spot² × 0.01), Call dương và Put âm. <strong>DEX:</strong> Σ(Delta × OI × multiplier × Spot). Vega và Theta tổng hợp từ Greek × OI × multiplier.</p>
          <p><strong>Key Levels:</strong> Call/Put OI Wall được tính riêng từ OI lớn nhất của từng phía. CW là strike có Net GEX dương lớn nhất; PW là strike có Net GEX âm lớn nhất theo trị tuyệt đối. GEX 1–10 xếp các strike còn lại theo |Net GEX| sau khi loại CW/PW (không loại OI Wall). GEX Ratio = tổng Call GEX / |tổng Put GEX|. Ratio > 1: Call Gamma trội, thiên hướng ổn định và biên độ hẹp; ratio < 1: Put Gamma trội, rủi ro biến động mạnh và trượt giá cao. Đây là heuristic theo quy ước Call+/Put−, không xác nhận dealer positioning.</p>
          <p><strong>Gamma Flip / Zero Gamma:</strong> Giữ OI, IV và DTE cố định; giả định giá underlying tại từng mức, tính lại Gamma từng hợp đồng bằng Black–Scholes, sau đó tổng hợp Net GEX = Σ(Call +, Put −) × OI × multiplier × giá giả định² × 0.01. Gamma Flip / Zero Gamma là nghiệm làm tổng Net GEX đổi dấu. Mô hình dùng r = 0, q = 0, đáo hạn lúc 16:00 America/New_York và nội suy/bisection quanh điểm đổi dấu. Đây là mô hình ước lượng theo quy ước Call+/Put−, không phải vị thế dealer đã xác minh. Cần OI, multiplier, IV và expiry đầy đủ.</p>
          <p><strong>Max Pain:</strong> với mỗi giá settlement ứng viên K, tính Σ[Call OI × multiplier × max(K − strike, 0)] + Σ[Put OI × multiplier × max(strike − K, 0)] trên toàn bộ hợp đồng của đúng expiry. Chọn settlement có tổng payout thấp nhất. Nếu nhiều strike cùng mức thấp nhất, QuantLab hiển thị strike đại diện thấp nhất và công bố toàn bộ các strike đồng hạng. Chỉ tính khi Option Chain hoàn tất, mọi OI đều có dữ liệu hợp lệ và mọi contract có OI &gt; 0 có multiplier hợp lệ. Không cộng volume hoặc premium vào Max Pain.</p>
          <p><strong>Spot reference:</strong> Binance Equity WebSocket <code>${cfg.assetCode}@symbol_price</code> được dùng làm giá tham chiếu cho KPI, Exposure và các Key Levels.</p>
          <p><strong>Giới hạn:</strong> Binance trả <code>oi: null</code> cho một số hợp đồng. Các hợp đồng này được đánh dấu thiếu OI và bị loại khỏi exposure, nhưng vẫn hiển thị dữ liệu quote/Greeks còn lại. Endpoint quote có thể trả dữ liệu trễ; độ trễ phụ thuộc quyền dữ liệu tài khoản.</p>
          <p><strong>Không có trong nguồn hiện tại:</strong> option trade prints/flow tape và Vanna/Charm không nằm trong quote response được ghi nhận, nên dashboard không tự ước lượng hoặc hiển thị hai loại dữ liệu này như dữ liệu Binance.</p>
        </div>
      </div>`;
  }

  const DISPLAY_KEY='tp_stock_options_display_strikes_v1';
  function readDisplayStrikes(key){
    try{const v=JSON.parse(localStorage.getItem(DISPLAY_KEY)||'{}')[key];return v==='all'?'all':([5,10,15,20,30,50,100].includes(+v)?+v:15)}catch{return 15}
  }
  function saveDisplayStrikes(key,value){try{const v=JSON.parse(localStorage.getItem(DISPLAY_KEY)||'{}')||{};v[key]=value;localStorage.setItem(DISPLAY_KEY,JSON.stringify(v))}catch{}}
  function buildViews(){
    for(const cfg of Object.values(CONFIG)){
      const view = $('v-'+cfg.key+'Options');
      if(view && !view.dataset.stockOptionsBuilt){ view.innerHTML=pageMarkup(cfg); view.dataset.stockOptionsBuilt='1'; }
      sessions[cfg.key] = sessions[cfg.key] || {
        cfg, active:false, socket:null, reconnectTimer:null, pollTimer:null, statusTimer:null,
        expiry:null, expirations:[], contracts:[], contractSymbols:new Set(), quotes:new Map(), price:null, previousClose:null,
        priceTime:0, oiLastUpdate:0, quoteLoading:false,
        quoteFeed:'delay', streamExpiry:null, streamNames:[], reconnectDelay:1000, requestId:1, chainLoadToken:0, crossAssetError:'',
        displayStrikes:readDisplayStrikes(cfg.key), chainComplete:false, hydrating:false, hydrateProgress:0, loadedExpiry:null
      };
      bindView(sessions[cfg.key]);
    }
  }

  async function request(path, method='GET', body){
    const isDirectPublic = method === 'GET' && DIRECT_PUBLIC_PATHS.some(prefix => path.startsWith(prefix));
    const options={method,headers:{'Accept':'application/json'}};
    if(body!==undefined){options.headers['Content-Type']='application/json';options.body=JSON.stringify(body);}
    const proxyUrl = API_BASE ? (API_PREFIX + path) : '';
    let response=null, directProblem='';

    if(isDirectPublic){
      // Public chain metadata is attempted directly first. If the browser blocks
      // Binance through CORS/network policy, retry through the configured narrow Worker.
      try{
        const direct=await fetch(BINANCE_PUBLIC_BASE + path,options);
        if(direct.ok)response=direct;
        else directProblem=`HTTP ${direct.status}: ${(await direct.text()).slice(0,160)}`;
      }catch(e){directProblem=e.message||String(e);}
      if(!response){
        if(!proxyUrl)throw new Error(`Không gọi được Binance trực tiếp (${directProblem||'network/CORS'}). Chưa cấu hình Cloudflare Worker fallback trong js/stock-options-config.js.`);
        try{response=await fetch(proxyUrl,options)}
        catch(e){throw new Error(`Binance direct không khả dụng (${directProblem||'network/CORS'}); Worker fallback cũng lỗi (${e.message||e}). Kiểm tra mạng và URL Worker trong js/stock-options-config.js.`)}
      }
    }else{
      ensureProxyConfigured();
      try{response=await fetch(proxyUrl,options)}
      catch(e){throw new Error('Không gọi được Binance proxy. Kiểm tra URL Cloudflare Worker trong js/stock-options-config.js. Chi tiết: '+(e.message||e))}
    }

    const text=await response.text();
    if(!response.ok){
      const message=`HTTP ${response.status}: ${text.slice(0,180)}`;
      if(isDirectPublic)throw new Error(`Binance direct không khả dụng (${directProblem||'network/CORS'}); Worker fallback trả ${message}. Kiểm tra Worker và Binance upstream.`);
      throw new Error(`Binance Worker ${message}`);
    }
    let json;
    try{json=JSON.parse(text)}catch{throw new Error('Binance trả response không phải JSON: '+text.slice(0,120));}
    if(json && json.code && json.code!=='000000' && json.code!=='0') throw new Error(json.message||json.msg||`Binance error ${json.code}`);
    if(json && json.success===false) throw new Error(json.message||'Binance API request failed');
    return json;
  }

  function setStatus(s,text,kind=''){
    const el=$(`${'so-'+s.cfg.key}-status`); if(!el)return;
    el.textContent=text; el.className='opt-status'+(kind?' '+kind:'');
  }
  function showError(s,msg){
    const el=$(`so-${s.cfg.key}-error`);if(!el)return;
    const detail=String(msg??'Unknown error');
    el.innerHTML=`<div class="opt-error-copy"><strong>Không tải được Option Chain</strong><span>Kiểm tra kết nối internet và URL Cloudflare Worker trong <code>js/stock-options-config.js</code>.</span></div><details class="opt-error-details"><summary>Chi tiết kỹ thuật</summary><p>${esc(detail)}</p></details>`;
    el.hidden=false;
  }
  function clearError(s){const el=$(`so-${s.cfg.key}-error`);if(el){el.hidden=true;el.innerHTML='';}}


  function candidateDates(limit=18){
    const out=[]; const base=new Date(isoTodayNY()+'T12:00:00Z');
    for(let i=0;i<65 && out.length<limit;i++){
      const d=new Date(base.getTime()+i*86400000),day=d.getUTCDay();
      if(day===0||day===6)continue;
      out.push(d.toISOString().slice(0,10));
    }
    return out;
  }

  async function loadExpirations(s){
    const cfg=s.cfg;
    setStatus(s,'Đang lấy expiry trực tiếp từ Binance…','loading');
    const dates=candidateDates(24);
    const found=[]; let firstError='';
    let next=0;
    async function worker(){while(next<dates.length){const d=dates[next++];try{
      const data=await request(`/bapi/equity/v1/public/equity/option/chain-symbols?${new URLSearchParams({symbol:cfg.symbol,rootSymbol:cfg.root,expirationDate:d})}`);
      const list=data.data?.l||[];if(list.length)found.push({date:d,root:cfg.root});
    }catch(e){if(!firstError)firstError=e.message||String(e);} }}
    await Promise.all(Array.from({length:4},worker));
    found.sort((a,b)=>a.date.localeCompare(b.date));
    s.expirations=found;
    if(!found.length)throw new Error(`Không tìm thấy expiry ${cfg.symbol}. Đã thử Binance REST và Worker dự phòng. ${firstError||'Không có contract trong các ngày đã kiểm tra.'}`);
    return found;
  }

  // OCC symbol e.g. QQQ261110C00369000 -> strike 369.000
  function occStrike(sym){
    const m=String(sym||'').match(/[CP](\d{8})$/i);
    return m?Number(m[1])/1000:null;
  }
  function normaliseQuote(q){
    const optionSymbol=q.os??q.optionSymbol??'';
    const rawSide=String(q.t??q.contractType??q.side??'').toLowerCase();
    const occSide=(optionSymbol.match(/[0-9]([cp])[0-9]+$/i)||[])[1]?.toUpperCase();
    const side=rawSide.includes('put')||rawSide==='p'?'P':rawSide.includes('call')||rawSide==='c'?'C':occSide==='P'?'P':'C';
    const oiRaw=q.oi!==undefined?q.oi:q.openInterest;
    const oiParsed=oiRaw===null||oiRaw===undefined||oiRaw===''?null:num(oiRaw);
    const oi=oiParsed!==null&&oiParsed>=0?oiParsed:null;
    return {
      optionSymbol, name:q.n??q.name??optionSymbol, side,
      expiration:num(q.e??q.expiration), strike:num(q.sp??q.strikePrice??q.strike)??occStrike(optionSymbol), multiplier:num(q.m??q.multiplier),
      last:num(q.p??q.l??q.lastPrice??q.last), bid:num(q.bp??q.bid), ask:num(q.ap??q.ask), mid:num(q.mp??q.mid),
      volume:num(q.v??q.volume), openInterest:oi,
      iv:num(q.iv??q.impliedVolatility), delta:num(q.de??q.delta), gamma:num(q.ga??q.gamma), theta:num(q.th??q.theta), vega:num(q.ve??q.vega),
      breakEven:num(q.be??q.breakEven), previousClose:num(q.pcp??q.previousClose), bidSize:num(q.bs??q.bidSize), askSize:num(q.as??q.askSize),
    };
  }

  function strikeSymbols(list, s){
    const count=s.displayStrikes;
    if(count==='all')return list.map(x=>x.os).filter(Boolean);
    const strikes=[...new Set(list.map(x=>occStrike(x.os)).filter(v=>Number.isFinite(v)))].sort((a,b)=>a-b);
    if(!strikes.length)return list.map(x=>x.os).filter(Boolean);
    const anchor=Number.isFinite(s.price)?s.price:strikes[Math.floor(strikes.length/2)];
    const selected=new Set(strikes.slice().sort((a,b)=>Math.abs(a-anchor)-Math.abs(b-anchor)).slice(0,Math.max(1,+count||15)).map(strikeKey));
    return list.filter(x=>selected.has(strikeKey(occStrike(x.os)))).map(x=>x.os).filter(Boolean);
  }
  async function fetchQuoteBatches(s, symbols, token, expiry, concurrency=2){
    const batches=[];for(let i=0;i<symbols.length;i+=100)batches.push(symbols.slice(i,i+100));
    let next=0,receivedCount=0;
    async function worker(){
      while(next<batches.length){
        const batch=batches[next++];
        const reply=await request('/bapi/equity/v1/friendly/equity/option/get-option-quote','POST',{occSymbols:batch});
        if(token!==s.chainLoadToken||expiry!==s.expiry)return;
        const received=(Array.isArray(reply.data)?reply.data:[]).map(normaliseQuote).filter(q=>q.optionSymbol);
        for(const q of received)s.quotes.set(q.optionSymbol,q);
        receivedCount+=received.length;s.hydrateProgress+=batch.length;
        s.oiLastUpdate=Date.now();
        if(s.hydrating)updateChainMeta(s);
      }
    }
    await Promise.all(Array.from({length:Math.min(Math.max(1,concurrency),batches.length||1)},worker));
    return receivedCount;
  }
  async function hydrateRemainingQuotes(s, symbols, token, expiry){
    if(!symbols.length){s.chainComplete=true;s.hydrating=false;s.loadedExpiry=expiry;renderAll(s);setStatus(s,`Loaded · ${s.quotes.size}/${s.contracts.length} contracts`,'ok');return;}
    s.hydrating=true;
    try{
      await fetchQuoteBatches(s,symbols,token,expiry,2);
      if(token!==s.chainLoadToken||expiry!==s.expiry)return;
      const allQuotesPresent=s.contractSymbols?Array.from(s.contractSymbols).every(symbol=>s.quotes.has(symbol)):s.quotes.size>=s.contracts.length;
      s.chainComplete=allQuotesPresent;s.loadedExpiry=allQuotesPresent?expiry:null;
      s.hydrating=false;s.crossAssetError='';
      renderAll(s);setStatus(s,allQuotesPresent?`Loaded full chain · ${s.quotes.size}/${s.contracts.length} contracts`:`Chain còn thiếu quote · ${s.quotes.size}/${s.contracts.length}` ,allQuotesPresent?'ok':'warn');
    }catch(e){
      if(token!==s.chainLoadToken)return;
      s.hydrating=false;s.chainComplete=false;s.crossAssetError=e.message||String(e);
      renderAll(s);setStatus(s,'Chain tải chưa đầy đủ · xem lỗi','bad');showError(s,e.message||String(e));
    }
  }
  async function loadChain(s, refreshAll=false){
    if(!s.expiry)return;
    const token=++s.chainLoadToken;
    const cfg=s.cfg,expiry=s.expiry,meta=s.expirations.find(x=>x.date===expiry),root=meta?.root||cfg.root;
    const sameExpiry=s.loadedExpiry===expiry&&s.quotes.size>0;
    const previousQuotes=sameExpiry?new Map(s.quotes):new Map();
    const keepCompleteSnapshot=!!(refreshAll&&sameExpiry);
    s.hydrating=keepCompleteSnapshot;s.chainComplete=keepCompleteSnapshot;s.hydrateProgress=0;
    setStatus(s,'Đang lấy Option Chain…','loading');
    if(!s.quotes.size)$(`so-${cfg.key}-chain`).innerHTML='<tr><td colspan="19" class="opt-empty">Đang lấy danh sách OCC contracts…</td></tr>';
    const chain=await request(`/bapi/equity/v1/public/equity/option/chain-symbols?${new URLSearchParams({symbol:cfg.symbol,rootSymbol:root,expirationDate:expiry})}`);
    if(token!==s.chainLoadToken||expiry!==s.expiry)return;
    const list=chain.data?.l||[];
    if(!list.length)throw new Error(`Binance không trả contract cho ${cfg.symbol} expiry ${expiry}.`);
    s.contracts=list;
    const symbols=list.map(x=>x.os).filter(Boolean);
    s.contractSymbols=new Set(symbols);
    // A same-expiry refresh may see a changed listed-strike set; discard quotes no longer in that chain.
    s.quotes=new Map([...previousQuotes].filter(([symbol])=>s.contractSymbols.has(symbol)));
    // A periodic refresh re-quotes the whole expiry in the background while preserving the last complete snapshot.
    if(refreshAll&&sameExpiry){
      s.hydrateProgress=0;s.hydrating=true;
      s.chainComplete=Array.from(s.contractSymbols).every(symbol=>s.quotes.has(symbol));
      s.oiLastUpdate=Date.now();s.crossAssetError='';
      renderAll(s);updateChainMeta(s);syncOptionStream(s);
      setStatus(s,`Đang làm mới toàn bộ ${symbols.length} contracts · vẫn giữ dữ liệu gần nhất trên chart`,'loading');
      hydrateRemainingQuotes(s,symbols,token,expiry);
      return;
    }
    const visibleSymbols=strikeSymbols(list,s);
    const already=new Set(s.quotes.keys());
    const priority=visibleSymbols.filter(x=>!already.has(x));
    if(priority.length){
      await fetchQuoteBatches(s,priority,token,expiry,2);
      if(token!==s.chainLoadToken||expiry!==s.expiry)return;
    }
    if(!s.quotes.size&&priority.length<symbols.length){
      // Fallback only when Binance returned no visible ATM quote at all.
      await fetchQuoteBatches(s,symbols,token,expiry,2);
      if(token!==s.chainLoadToken||expiry!==s.expiry)return;
    }
    if(!s.quotes.size)throw new Error('Binance trả danh sách contract nhưng không có quote.');
    s.oiLastUpdate=Date.now();s.crossAssetError='';
    const missing=symbols.filter(x=>!s.quotes.has(x));
    s.hydrateProgress=symbols.length-missing.length;
    s.hydrating=missing.length>0;
    s.chainComplete=missing.length===0;
    renderAll(s);updateChainMeta(s);syncOptionStream(s);
    if(missing.length){
      setStatus(s,`Đã hiển thị ${s.displayStrikes==='all'?'tất cả':s.displayStrikes} strikes · đang tải phần còn lại (${s.quotes.size}/${symbols.length})`,'loading');
      // Full-chain analytics are hydrated in the background; first paint only requests visible ATM strikes.
      hydrateRemainingQuotes(s,missing,token,expiry);
    }else{
      s.loadedExpiry=expiry;setStatus(s,`Loaded · ${s.quotes.size} option quotes`,'ok');
    }
  }

  function mergeLiveQuote(s, raw){
    const arr=Array.isArray(raw)?raw:[raw];
    const sourceKeys={name:['n','name'],side:['t','contractType','side'],expiration:['e','expiration'],strike:['sp','strikePrice','strike'],multiplier:['m','multiplier'],last:['p','l','lastPrice','last'],bid:['bp','bid'],ask:['ap','ask'],mid:['mp','mid'],volume:['v','volume'],openInterest:['oi','openInterest'],iv:['iv','impliedVolatility'],delta:['de','delta'],gamma:['ga','gamma'],theta:['th','theta'],vega:['ve','vega'],breakEven:['be','breakEven'],previousClose:['pcp','previousClose'],bidSize:['bs','bidSize'],askSize:['as','askSize']};
    let changed=false;
    for(const item of arr){
      if(!item || !(item.os||item.optionSymbol))continue;
      const q=normaliseQuote(item);
      if(s.contractSymbols?.size && !s.contractSymbols.has(q.optionSymbol))continue;
      const old=s.quotes.get(q.optionSymbol)||{...q,openInterest:null,volume:null,iv:null,delta:null,gamma:null,theta:null,vega:null,bid:null,ask:null,mid:null,last:null,multiplier:null,bidSize:null,askSize:null};
      const next={...old,optionSymbol:q.optionSymbol};
      for(const [field,keys] of Object.entries(sourceKeys)){
        if(keys.some(k=>Object.prototype.hasOwnProperty.call(item,k)))next[field]=q[field];
      }
      if(!old.side&&q.side)next.side=q.side;
      if(!old.name&&q.name)next.name=q.name;
      s.quotes.set(q.optionSymbol,next);changed=true;
    }
    if(changed){s.oiLastUpdate=Date.now();renderAll(s);}
  }

  function getRows(s){return [...s.quotes.values()].sort((a,b)=>a.strike-b.strike||(a.side==='C'?-1:1));}
  function pairedRows(s){
    const map=new Map();
    for(const q of getRows(s)){
      if(!Number.isFinite(q.strike))continue;
      const key=strikeKey(q.strike);if(!map.has(key))map.set(key,{strike:q.strike});
      map.get(key)[q.side]=q;
    }
    return [...map.values()].sort((a,b)=>a.strike-b.strike);
  }

  function maxPainOf(dist){
    if(!Array.isArray(dist)||!dist.length)return null;
    const rows=dist.filter(x=>Number.isFinite(x.strike)&&x.strike>0&&
      Number.isFinite(x.callPainOI)&&x.callPainOI>=0&&
      Number.isFinite(x.putPainOI)&&x.putPainOI>=0);
    if(rows.length!==dist.length||!rows.length)return null;
    const strikes=[...new Set(rows.map(x=>x.strike))].sort((a,b)=>a-b);
    if(!strikes.length)return null;
    const payouts=strikes.map(settlement=>{
      let payout=0;
      for(const x of rows){
        payout+=Math.max(0,settlement-x.strike)*x.callPainOI;
        payout+=Math.max(0,x.strike-settlement)*x.putPainOI;
      }
      return {strike:settlement,payout};
    });
    const minimum=Math.min(...payouts.map(x=>x.payout));
    // Floating-point tolerance only groups numerically equal minima; it does not
    // smooth or interpolate the listed-strike settlement candidates.
    const tolerance=Math.max(1e-8,Math.abs(minimum)*1e-10);
    const tiedStrikes=payouts.filter(x=>Math.abs(x.payout-minimum)<=tolerance).map(x=>x.strike);
    // Deterministic representative: lowest listed strike. Preserve every tied
    // listed strike so the UI can disclose a flat/minimum payout zone.
    return {strike:tiedStrikes[0],payout:minimum,tiedStrikes, isTie:tiedStrikes.length>1,
      candidateCount:strikes.length,method:'OI × multiplier × intrinsic value · one expiry'};
  }
  function ivSigma(value){
    let v=num(value);if(v===null||v<=0)return null;
    if(v>3)v/=100;
    return v>=.01&&v<=5?v:null;
  }
  function expiryAtUsCloseUtc(expiry){
    const date=String(expiry||'').slice(0,10),m=date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m)return null;
    const targetWall=Date.UTC(+m[1],+m[2]-1,+m[3],16,0,0); // 16:00 New York local time
    try{
      const fmt=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
      let guess=targetWall;
      // Solve UTC instant whose New York wall-clock time is 16:00; this handles EST/EDT.
      for(let i=0;i<4;i++){
        const parts=Object.fromEntries(fmt.formatToParts(new Date(guess)).map(x=>[x.type,x.value]));
        const represented=Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second);
        const correction=targetWall-represented;
        guess+=correction;
        if(Math.abs(correction)<1000)break;
      }
      return guess;
    }catch{
      // Safe fallback for environments without IANA timezone support (UTC-5 standard time).
      return targetWall+5*60*60*1000;
    }
  }
  function yearsToExpiry(expiry,now){
    const end=expiryAtUsCloseUtc(expiry);
    if(end===null)return null;
    const t=(end-now)/(365.25*86400000);
    return Number.isFinite(t)&&t>0?t:null;
  }
  function bsmGamma(spot,strike,time,sigma){
    if(!(spot>0&&strike>0&&time>0&&sigma>0))return null;
    const root=Math.sqrt(time),den=sigma*root;
    const d1=(Math.log(spot/strike)+.5*sigma*sigma*time)/den; // r = q = 0 approximation
    const gamma=Math.exp(-.5*d1*d1)/(spot*den*Math.sqrt(2*Math.PI));
    return Number.isFinite(gamma)?gamma:null;
  }
  function gammaFlipInputKey(rows){
    return rows.map(q=>[q.optionSymbol||'',q.strike??'',q.side||'',q.openInterest??'',q.multiplier??'',q.iv??''].join(':')).join('|');
  }
  function gammaFlipOf(rows,spot,expiry,now=Date.now()){
    const time=yearsToExpiry(expiry,now);
    if(time===null)return {level:null,complete:false,reason:'Thiếu DTE hợp lệ',coverage:0};
    const valid=rows.filter(q=>Number.isFinite(q.strike));
    const eligible=valid.filter(q=>q.openInterest!==null&&q.openInterest!==undefined&&Number.isFinite(q.openInterest)&&q.multiplier>0&&Number.isFinite(q.multiplier)&&ivSigma(q.iv)!==null);
    const coverage=valid.length?eligible.length/valid.length:0;
    if(!valid.length||eligible.length!==valid.length)return {level:null,complete:false,reason:'Cần OI, multiplier và IV cho toàn bộ expiry',coverage};
    const netAt=price=>{
      let total=0;
      for(const q of eligible){
        const g=bsmGamma(price,q.strike,time,ivSigma(q.iv));
        if(g===null)return null;
        const value=g*q.openInterest*q.multiplier*price*price*.01;
        total+=q.side==='P'?-value:value;
      }
      return total;
    };
    const strikes=eligible.map(q=>q.strike).filter(v=>Number.isFinite(v)&&v>0);
    const anchors=spot>0?[...strikes,spot]:strikes;
    const lo=Math.min(...anchors)*.5,hi=Math.max(...anchors)*1.5,steps=600,points=[];
    if(!(hi>lo))return {level:null,crosses:[],complete:true,reason:'Dải giá giả định không hợp lệ',coverage};
    for(let i=0;i<=steps;i++){const price=lo+(hi-lo)*i/steps;points.push({price,gex:netAt(price)});}
    const crosses=[];
    const addCross=x=>{if(Number.isFinite(x)&&(!crosses.length||Math.abs(crosses[crosses.length-1]-x)>(hi-lo)/steps*.05))crosses.push(x);};
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i];
      if(a.gex===0){addCross(a.price);continue;}
      if(b.gex===0){addCross(b.price);continue;}
      if((a.gex<0&&b.gex>0)||(a.gex>0&&b.gex<0)){
        // Refine each sign change with bisection rather than relying on coarse scan interpolation.
        let left=a.price,right=b.price,fLeft=a.gex;
        for(let n=0;n<64;n++){
          const mid=(left+right)/2,fMid=netAt(mid);
          if(!Number.isFinite(fMid))break;
          if(Math.abs(fMid)<1e-10||right-left<Math.max(1e-10,mid*1e-12)){left=right=mid;break;}
          if((fLeft<0&&fMid>0)||(fLeft>0&&fMid<0))right=mid;
          else{left=mid;fLeft=fMid;}
        }
        addCross((left+right)/2);
      }
    }
    const orderedCrosses=crosses.sort((a,b)=>a-b);
    const level=spot>0&&orderedCrosses.length?orderedCrosses.slice().sort((a,b)=>Math.abs(a-spot)-Math.abs(b-spot))[0]:null;
    return {level,crosses:orderedCrosses,complete:true,reason:!orderedCrosses.length?'Không có zero-cross trong dải giá giả định':!(spot>0)?'Cần Spot hiện tại để chọn zero-cross gần nhất':'Gamma Flip / Zero Gamma · BSM repricing · OI/IV cố định · r=q=0 · 16:00 New York expiry · bisection-refined',coverage,range:[lo,hi],timeToExpiry:time};
  }
  function calc(s,now=Date.now()){
    const rows=getRows(s),spot=s.price;
    let callOI=0,putOI=0,oiKnown=0,oiMissing=0,multiplierMissing=0,maxPainMultiplierMissing=0,callVol=0,putVol=0;
    const per=new Map();let delta=spot!==null?0:null,gamma=spot!==null?0:null,vega=0,theta=0;
    let gexKnown=0,gexMissing=0;
    for(const q of rows){
      if(!Number.isFinite(q.strike))continue;
      const side=q.side;
      const p=per.get(strikeKey(q.strike))||{strike:q.strike,gex:0,dex:0,vgex:0,thex:0,callOI:0,putOI:0,callVol:0,putVol:0,callGex:0,putGex:0,callDex:0,putDex:0,callVgex:0,putVgex:0,callThex:0,putThex:0,callPainOI:0,putPainOI:0};
      if(q.volume!=null){if(side==='C'){callVol+=q.volume;p.callVol+=q.volume;}else{putVol+=q.volume;p.putVol+=q.volume;}}
      per.set(strikeKey(q.strike),p);
      if(q.openInterest==null){oiMissing++;gexMissing++;continue;}
      const oi=q.openInterest,m=q.multiplier;
      oiKnown++;
      if(side==='C'){callOI+=oi;p.callOI+=oi;}else{putOI+=oi;p.putOI+=oi;}
      const validMultiplier=m!=null&&Number.isFinite(m)&&m>0;
      if(oi>0&&!validMultiplier)maxPainMultiplierMissing++;
      if(validMultiplier){if(side==='C')p.callPainOI+=oi*m;else p.putPainOI+=oi*m;}
      if(!validMultiplier){multiplierMissing++;gexMissing++;continue;}
      if(spot!==null&&q.gamma!=null&&Number.isFinite(q.gamma)){const raw=q.gamma*oi*m*spot*spot*.01;const v=side==='P'?-raw:raw;p.gex+=v;if(side==='C')p.callGex+=Math.abs(raw);else p.putGex-=Math.abs(raw);gamma+=v;gexKnown++;}else{gexMissing++;}
      if(spot!==null&&q.delta!=null){const raw=q.delta*oi*m*spot;p.dex+=raw;if(side==='C')p.callDex+=Math.abs(raw);else p.putDex+=Math.abs(raw);delta+=raw;}
      if(q.vega!=null){const raw=q.vega*oi*m;p.vgex+=raw;if(side==='C')p.callVgex+=Math.abs(raw);else p.putVgex+=Math.abs(raw);vega+=raw;}
      if(q.theta!=null){const raw=q.theta*oi*m;p.thex+=raw;if(side==='C')p.callThex+=Math.abs(raw);else p.putThex+=Math.abs(raw);theta+=raw;}
    }
    const dist=[...per.values()].sort((a,b)=>a.strike-b.strike);
    const calls=dist.filter(x=>x.callOI>0).sort((a,b)=>b.callOI-a.callOI);
    const puts=dist.filter(x=>x.putOI>0).sort((a,b)=>b.putOI-a.putOI);
    const totalContracts=Math.max(rows.length,s.contracts.length||0);
    oiMissing=Math.max(oiMissing,totalContracts-oiKnown);
    gexMissing=Math.max(gexMissing,totalContracts-gexKnown);
    const complete=!!s.chainComplete&&(s.contractSymbols?.size?Array.from(s.contractSymbols).every(symbol=>s.quotes.has(symbol)):s.quotes.size>=s.contracts.length);
    const oiComplete=complete&&oiMissing===0;
    const gexComplete=complete&&gexMissing===0&&spot!==null&&totalContracts>0;
    const maxPainComplete=oiComplete&&maxPainMultiplierMissing===0;
    const validOI=oiKnown,coverage=totalContracts?validOI/totalContracts:0;
    const gexCoverage=totalContracts?gexKnown/totalContracts:0;
    // Net GEX convention: Calls contribute positive GEX and Puts negative GEX.
    const callOIWall=calls[0]||null,putOIWall=puts[0]||null;
    const positiveGex=gexComplete?dist.filter(x=>Number.isFinite(x.gex)&&x.gex>0).slice().sort((a,b)=>b.gex-a.gex):[];
    const negativeGex=gexComplete?dist.filter(x=>Number.isFinite(x.gex)&&x.gex<0).slice().sort((a,b)=>a.gex-b.gex):[];
    const gexCallWall=positiveGex[0]||null;
    const gexPutWall=negativeGex[0]||null;
    const gammaWallKeys=new Set([gexCallWall?.strike,gexPutWall?.strike].filter(Number.isFinite).map(strikeKey));
    const gexLevels=gexComplete?dist.filter(x=>Number.isFinite(x.gex)&&Math.abs(x.gex)>0&&!gammaWallKeys.has(strikeKey(x.strike)))
      .slice().sort((a,b)=>Math.abs(b.gex)-Math.abs(a.gex)).slice(0,10):[];
    // Reprice only when expiry/DTE or OI, multiplier, IV, strike or side changes.
    // Quote last/bid/ask ticks do not affect the BSM Gamma Flip scan.
    const flipCacheKey=[s.expiry||'',gammaFlipInputKey(rows),rows.length,Math.floor(now/60000)].join('|');
    let flipCalc=s._gammaFlipCache?.key===flipCacheKey?s._gammaFlipCache.value:null;
    if(!flipCalc){flipCalc=complete?gammaFlipOf(rows,spot,s.expiry,now):{level:null,crosses:[],complete:false,reason:'Full Option Chain chưa tải xong',coverage:0};try{s._gammaFlipCache={key:flipCacheKey,value:flipCalc}}catch{}}
    // Cache the BSM scan, not the nearest root: the closest zero-cross can change as Spot moves.
    const gammaFlip=spot>0&&flipCalc.crosses?.length?flipCalc.crosses.slice().sort((a,b)=>Math.abs(a-spot)-Math.abs(b-spot))[0]:null;
    // Requested GEX Ratio: total Call GEX divided by absolute total Put GEX.
    // Call exposure is positive by convention; Put exposure is stored negative.
    const callGexTotal=gexComplete?dist.reduce((sum,x)=>sum+Math.max(0,x.callGex||0),0):null;
    const putGexTotal=gexComplete?dist.reduce((sum,x)=>sum+(x.putGex||0),0):null;
    const putGexAbsTotal=putGexTotal===null?null:Math.abs(putGexTotal);
    const gexRatio=gexComplete&&putGexAbsTotal>0?callGexTotal/putGexAbsTotal:null;
    const gexRatioState=!gexComplete?'incomplete':putGexAbsTotal===0?(callGexTotal>0?'call-only':'no-gex'):'ready';
    const gexRatioBias=gexRatioState==='call-only'?'call-dominant':gexRatioState==='no-gex'?'balanced':gexRatio===null?null:gexRatio>1?'call-dominant':gexRatio<1?'put-dominant':'balanced';
    return {rows,dist,callOI,putOI,oiKnown,oiMissing,multiplierMissing,maxPainMultiplierMissing,totalContracts,callVol,putVol,volume:callVol+putVol,delta,gamma,vega,theta,
      callOIWall,putOIWall,gexCallWall,gexPutWall,
      gammaFlip,gammaFlipComplete:flipCalc.complete&&spot>0,gammaFlipReason:spot>0?flipCalc.reason:'Chờ Spot underlying để chọn Gamma Flip gần nhất',gammaFlipCoverage:flipCalc.coverage,
      callGexTotal,putGexTotal,putGexAbsTotal,gexRatio,gexRatioState,gexRatioBias,
      gexLevels,maxPain:maxPainComplete?maxPainOf(dist):null,
      complete,oiComplete,gexComplete,gexKnown,gexMissing,gexCoverage,maxPainComplete,coverage,
      oiWall:dist.reduce((best,x)=>{const v=Math.max(x.callOI,x.putOI);return v>0&&(!best||v>best.oi)?{strike:x.strike,oi:v}:best;},null)};
  }

  function renderAll(s){
    renderKpis(s);renderLevels(s);renderExposure(s);renderGreeks(s);renderOI(s);renderChain(s);updateChainMeta(s);
    try{if(typeof window.crossAssetMapDataUpdated==='function')window.crossAssetMapDataUpdated(s.cfg.key)}catch(e){}
  }
  function metric(value,label,sub,cls=''){
    return `<div class="opt-metric"><span>${label}</span><strong class="${cls}">${value}</strong><small>${sub||''}</small></div>`;
  }
  function renderKpis(s){
    const c=calc(s),spot=s.price,change=spot!==null&&s.previousClose!==null?spot-s.previousClose:null,changePct=change!==null&&s.previousClose?change/s.previousClose:null;
    const k=$(`so-${s.cfg.key}-kpis`);if(!k)return;
    k.innerHTML=[
      metric(fmt(spot,2),'LAST PRICE',s.cfg.symbol+' · USD'),
      metric(change===null?'—':`${change>=0?'+':''}${fmt(change,2)} (${changePct===null?'—':(changePct*100).toFixed(2)+'%'})`,'CHANGE','So với previous close',change===null?'':change>=0?'pos-t':'neg-t'),
      metric(compact(c.callOI),'CALL OI',`${c.rows.filter(x=>x.side==='C'&&x.openInterest!=null).length} contracts có OI`),
      metric(compact(c.putOI),'PUT OI',`${c.rows.filter(x=>x.side==='P'&&x.openInterest!=null).length} contracts có OI`),
      metric(compact(c.volume),'TOTAL VOLUME',`Call ${compact(c.callVol)} · Put ${compact(c.putVol)}`),
      metric((c.coverage*100).toFixed(1)+'%','OI COVERAGE',`${c.oiKnown}/${c.totalContracts} contracts có OI`,c.oiMissing?'neg-t':'')
    ].join('');
  }
  function renderLevels(s){
    const c=calc(s),el=$(`so-${s.cfg.key}-levels`);if(!el)return;
    const pending=!c.complete;
    const cards=[
      {key:'call',label:'CALL OI WALL',tag:'OI · CALL',value:c.callOIWall?fmt(c.callOIWall.strike,2):'—',meta:c.callOIWall?`Call OI · ${compact(c.callOIWall.callOI)}${c.oiComplete?'':' · provisional'}`:'Chưa có Call OI'},
      {key:'put',label:'PUT OI WALL',tag:'OI · PUT',value:c.putOIWall?fmt(c.putOIWall.strike,2):'—',meta:c.putOIWall?`Put OI · ${compact(c.putOIWall.putOI)}${c.oiComplete?'':' · provisional'}`:'Chưa có Put OI'},
      {key:'gex-call',label:'CW · GEX CALL WALL',tag:'MAX +NET GEX',value:c.gexCallWall?fmt(c.gexCallWall.strike,2):'—',meta:c.gexCallWall?`Net GEX +${compact(c.gexCallWall.gex)}`:c.gexComplete?'Không có Net GEX dương':'Cần đủ OI + Gamma + multiplier'},
      {key:'gex-put',label:'PW · GEX PUT WALL',tag:'MAX |−NET GEX|',value:c.gexPutWall?fmt(c.gexPutWall.strike,2):'—',meta:c.gexPutWall?`Net GEX −${compact(Math.abs(c.gexPutWall.gex))}`:c.gexComplete?'Không có Net GEX âm':'Cần đủ OI + Gamma + multiplier'},
      {key:'gamma-flip',label:'GAMMA FLIP / ZERO GAMMA',tag:'BSM · NET GEX ZERO-CROSS',value:c.gammaFlip===null?'—':fmt(c.gammaFlip,2),meta:c.gammaFlip!==null?'Mức Net GEX đổi dấu khi repricing underlying':c.gammaFlipReason||'Cần full OI, multiplier, IV và DTE'},
      {key:'pain',label:'MAX PAIN',tag:'EXPIRY',value:c.maxPain?fmt(c.maxPain.strike,2):'—',meta:c.maxPain?`Payout · ${compact(c.maxPain.payout)}${c.maxPain.isTie?` · đồng hạng: ${c.maxPain.tiedStrikes.map(x=>fmt(x,2)).join(' / ')}`:''}`:!c.complete?'Cần tải đủ expiry':!c.oiComplete?'OI chưa đủ để tính':'Thiếu contract multiplier'},
      {key:'gex-ratio',label:'GEX RATIO',tag:'CALL GEX / |PUT GEX|',value:c.gexRatioState==='call-only'?'∞':c.gexRatio===null?'—':`${c.gexRatio.toFixed(2)}x`,meta:c.gexRatioBias==='call-dominant'?'Call Gamma trội · xu hướng ổn định, biên độ hẹp':c.gexRatioBias==='put-dominant'?'Put Gamma trội · rủi ro biến động và trượt giá cao':c.gexRatioBias==='balanced'?'Call/Put Gamma tương đối cân bằng':c.gexRatioState==='no-gex'?'Không có GEX hợp lệ':'Cần full GEX coverage'}
    ];
    const status=pending?'<span class="kl-status is-loading">Đang tải full chain</span>':'<span class="kl-status">Expiry đã đồng bộ</span>';
    const cardsHtml=cards.map(x=>`<article class="kl-card kl-${x.key}"><div class="kl-card-top"><span class="kl-label">${x.label}</span><span class="kl-tag">${x.tag}</span></div><strong class="kl-value">${esc(x.value)}</strong><span class="kl-meta">${esc(x.meta)}</span></article>`).join('');
    const maxGex=Math.max(1,...c.gexLevels.map(x=>Math.abs(x.gex)));
    const gexHtml=c.gexLevels.length?c.gexLevels.map((x,i)=>{const pos=x.gex>=0,ratio=Math.max(2,Math.abs(x.gex)/maxGex*100);return `<div class="kl-gex-row ${pos?'is-positive':'is-negative'}"><span class="kl-rank">${String(i+1).padStart(2,'0')}</span><strong class="kl-strike">${fmt(x.strike,2)}</strong><span class="kl-track"><i style="width:${ratio.toFixed(1)}%"></i></span><b class="kl-gex-value">${x.gex>=0?'+':'−'}${compact(Math.abs(x.gex))}</b><span class="kl-side">${pos?'NET +':'NET −'}</span></div>`}).join(''):'<div class="kl-empty">Chưa có dữ liệu GEX theo strike.</div>';
    el.innerHTML=`<div class="kl-summary-grid">${cardsHtml}</div><section class="kl-gex-panel"><div class="kl-gex-heading"><div><h4>GEX ladder <span>01—10</span></h4><p>Xếp theo |Net GEX| sau khi loại CW và PW · GEX walls, không loại OI walls</p></div>${status}</div><div class="kl-gex-list">${gexHtml}</div><p class="kl-footnote">Net GEX theo strike = Call GEX (+) + Put GEX (−). CW là Net GEX dương lớn nhất; PW là Net GEX âm có trị tuyệt đối lớn nhất. Call/Put OI Walls được tính độc lập từ OI. GEX Ratio = Σ Call GEX / |Σ Put GEX|. Ratio > 1: Call Gamma trội, thiên hướng ổn định/biên độ hẹp; ratio < 1: Put Gamma trội, rủi ro biến động/trượt giá cao. Đây là heuristic theo quy ước Call+/Put−, không xác nhận dealer positioning. Gamma Flip / Zero Gamma được tính một lần bằng BSM repricing. GEX coverage: ${(c.gexCoverage*100).toFixed(1)}% (${c.gexKnown}/${c.totalContracts} contracts hợp lệ).</p></section>`;
  }

  function renderExposure(s){
    const c=calc(s),el=$(`so-${s.cfg.key}-gex`);if(!el)return;
    const metricKey=$(`so-${s.cfg.key}-exposure-metric`)?.value||'gamma';
    const config={
      gamma:{callField:'callGex',putField:'putGex',title:'GAMMA EXPOSURE',subtitle:'Call GEX → right · Put GEX ← left',units:'USD notional per 1% underlying move',note:'Call và Put được tách riêng theo option side. Put GEX mang dấu âm trong aggregate; cột trái hiển thị độ lớn tuyệt đối. OI không xác định holder đang Long hay Short.'},
      delta:{callField:'callDex',putField:'putDex',title:'DELTA EXPOSURE',subtitle:'Call DEX → right · Put DEX ← left',units:'USD delta notional',note:'Cột Call/Put biểu thị độ lớn Delta Notional riêng theo từng option side; aggregate vẫn giữ dấu Delta native từ provider. OI không xác định holder đang Long hay Short.'},
      vega:{callField:'callVgex',putField:'putVgex',title:'VEGA EXPOSURE',subtitle:'Call Vega → right · Put Vega ← left',units:'Vega × OI × contract multiplier',note:'Call và Put Vega được tách theo option side, hiển thị độ lớn tuyệt đối. Đây là Greek × OI × multiplier, không phải vị thế Long/Short đã xác minh.'},
      theta:{callField:'callThex',putField:'putThex',title:'THETA EXPOSURE',subtitle:'Call Theta → right · Put Theta ← left',units:'Theta × OI × contract multiplier',note:'Call và Put Theta được tách theo option side, hiển thị độ lớn tuyệt đối. Aggregate vẫn giữ dấu Theta native từ provider; không phải P/L dự báo.'}
    }[metricKey]||null;
    const title=$(`so-${s.cfg.key}-exposure-title`),subtitle=$(`so-${s.cfg.key}-exposure-subtitle`),units=$(`so-${s.cfg.key}-exposure-units`),note=$(`so-${s.cfg.key}-exposure-note`);
    if(config){if(title)title.textContent=config.title;if(subtitle)subtitle.textContent=config.subtitle;if(units)units.textContent=config.units;if(note)note.textContent=config.note;}
    if(!config){el.innerHTML='<div class="opt-empty">Exposure metric không được hỗ trợ.</div>';return;}

    const hasValue=x=>(Number(x[config.callField])||0)!==0||(Number(x[config.putField])||0)!==0;
    const candidates=c.dist.filter(hasValue);
    if(!candidates.length){el.innerHTML=`<div class="exposure-empty"><b>Chưa có dữ liệu Exposure</b><span>Cần OI, multiplier và Greeks hợp lệ cho expiry này.</span></div>`;return;}

    // Keep a symmetric strike window around the underlying so the profile reads like a ladder.
    const MAX_ROWS=44;
    let visible;
    if(Number.isFinite(s.price)){
      visible=candidates.slice().sort((a,b)=>Math.abs(a.strike-s.price)-Math.abs(b.strike-s.price)).slice(0,MAX_ROWS).sort((a,b)=>a.strike-b.strike);
    }else{
      visible=candidates.slice().sort((a,b)=>((Number(b[config.callField])||0)+Math.abs(Number(b[config.putField])||0))-((Number(a[config.callField])||0)+Math.abs(Number(a[config.putField])||0))).slice(0,MAX_ROWS).sort((a,b)=>a.strike-b.strike);
    }
    const max=Math.max(1,...visible.flatMap(x=>[Math.abs(Number(x[config.callField])||0),Math.abs(Number(x[config.putField])||0)]));
    const first=visible[0].strike,last=visible[visible.length-1].strike,range=last-first||1;
    const positionFor=value=>{
      const v=Number(value);if(!Number.isFinite(v)||v<first||v>last)return null;
      if(visible.length===1)return 50;
      return Math.max(0,Math.min(100,(v-first)/range*100));
    };
    const marker=(value,kind,label)=>{
      const pos=positionFor(value);if(pos===null)return '';
      return `<div class="exposure-marker ${kind}" style="--marker-y:${pos.toFixed(3)}%"><span>${label} <b>${fmt(value,2)}</b></span></div>`;
    };
    const rows=visible.map((x,i)=>{
      const call=Math.abs(Number(x[config.callField])||0),put=Math.abs(Number(x[config.putField])||0);
      const cw=call>0?Math.max(1,call/max*100):0,pw=put>0?Math.max(1,put/max*100):0;
      const rowClass=(Number.isFinite(s.price)&&Math.abs(x.strike-s.price)<=range/Math.max(visible.length-1,1)*.55)?' is-near-spot':'';
      return `<div class="exposure-row${rowClass}" style="--row-i:${i}" data-strike="${x.strike}" title="Strike ${fmt(x.strike,2)} · Call ${compact(call)} · Put ${compact(put)}"><span class="exposure-strike">${fmt(x.strike,2)}</span><span class="exposure-put-track"><i data-exposure-value="${put}" style="width:${pw.toFixed(2)}%"></i></span><span class="exposure-zero"></span><span class="exposure-call-track"><i data-exposure-value="${call}" style="width:${cw.toFixed(2)}%"></i></span></div>`;
    }).join('');
    const lines=[
      marker(s.price,'is-spot','SPOT'),
      marker(c.callOIWall?.strike,'is-call-wall','CALL OI WALL'),
      marker(c.putOIWall?.strike,'is-put-wall','PUT OI WALL'),
      marker(c.gexCallWall?.strike,'is-gex-call-wall','CW · MAX +GEX'),
      marker(c.gexPutWall?.strike,'is-gex-put-wall','PW · MAX −GEX')
    ].join('');
    const status=!c.complete?'PARTIAL CHAIN':metricKey==='gamma'&&!c.gexComplete?'GEX COVERAGE INCOMPLETE':'FULL CHAIN';
    el.innerHTML=`<div class="exposure-plot" role="img" aria-label="Bilateral ${metricKey.toUpperCase()} exposure by strike. Puts extend left, Calls extend right.">
      <div class="exposure-axis-head"><span>STRIKE</span><span>PUTS ←</span><span></span><span>→ CALLS</span></div>
      <div class="exposure-rows">${rows}${lines}</div>
      <div class="exposure-bottom"><span>${fmt(first,2)} — ${fmt(last,2)}</span><span>${visible.length} STRIKES · ${status}</span><span>MAX ${compact(max)}</span></div>
    </div>`;
  }
  function renderGreeks(s){
    const c=calc(s),el=$(`so-${s.cfg.key}-greeks`);if(!el)return;
    const lines=[['Delta Notional',c.delta,'USD'],['Gamma Exposure (1%)',c.gamma,'USD'],['Vega × OI',c.vega,'Greek × contracts'],['Theta × OI',c.theta,'Greek × contracts']];
    el.innerHTML=lines.map(([name,v,u])=>`<div class="opt-greek-line"><span>${name}<small>${u}</small></span><b>${v===null||!Number.isFinite(v)?'—':compact(v)}</b></div>`).join('')+
      `<p class="opt-footnote">Exposure chỉ tổng hợp contract có OI và multiplier hợp lệ. ${c.oiMissing} contract chưa có OI; ${c.multiplierMissing} contract thiếu multiplier nên vẫn tính vào OI nhưng bị loại khỏi Greeks exposure.</p>`;
  }
  function renderOI(s){
    const c=calc(s),el=$(`so-${s.cfg.key}-oi`),wall=$(`so-${s.cfg.key}-oiwall`);if(!el)return;
    if(wall)wall.textContent='OI Wall: '+(c.oiWall?fmt(c.oiWall.strike,2):'—');
    const rows=c.dist.filter(x=>x.callOI+x.putOI>0).sort((a,b)=>a.strike-b.strike);
    if(!rows.length){el.innerHTML='<div class="opt-empty">Không có OI hợp lệ cho expiry này.</div>';return;}
    const max=Math.max(...rows.map(x=>Math.max(x.callOI,x.putOI)),1);
    const visible=(s.price===null?rows:rows.slice().sort((a,b)=>Math.abs(a.strike-s.price)-Math.abs(b.strike-s.price)).slice(0,34)).sort((a,b)=>a.strike-b.strike);
    el.innerHTML=visible.map(x=>`<div class="so-oi-row"><span>${fmt(x.strike,2)}</span><div class="so-oi-bars"><i class="call" style="width:${Math.max(0,x.callOI/max*100)}%"></i><i class="put" style="width:${Math.max(0,x.putOI/max*100)}%"></i></div><b>${compact(x.callOI+x.putOI)}</b></div>`).join('');
  }
  function quoteCell(q,field,format){
    if(!q)return '<td>—</td>';
    const v=q[field];
    if(field==='openInterest'&&v==null)return '<td title="Binance trả OI = null">—</td>';
    return `<td>${v==null?'—':format?format(v):esc(v)}</td>`;
  }
  function quoteSizeCell(q,field){
    if(!q||q[field]==null)return '<td>—</td>';
    const size=q[field+'Size'];
    return `<td>${fmt(q[field],2)} <small>× ${size===null?'—':compact(size)}</small></td>`;
  }
  function renderChain(s){
    const all=pairedRows(s),el=$(`so-${s.cfg.key}-chain`),spot=s.price;if(!el)return;
    if(!all.length){el.innerHTML='<tr><td colspan="19" class="opt-empty">Chưa có contract.</td></tr>';return;}
    const atm=spot===null?all[Math.floor(all.length/2)]:all.reduce((best,x)=>!best||Math.abs(x.strike-spot)<Math.abs(best.strike-spot)?x:best,null);
    const data=s.displayStrikes==='all'?all:all.slice().sort((a,b)=>Math.abs(a.strike-(spot??atm.strike))-Math.abs(b.strike-(spot??atm.strike))).slice(0,Math.max(1,+s.displayStrikes||15)).sort((a,b)=>a.strike-b.strike);
    el.innerHTML=data.map(x=>{
      const c=x.C,p=x.P,atmClass=atm&&x.strike===atm.strike?'atm':'';
      return `<tr class="${atmClass}">
        ${quoteSizeCell(c,'bid')}${quoteSizeCell(c,'ask')}
        ${quoteCell(c,'mid',v=>fmt(v,2))}${quoteCell(c,'last',v=>fmt(v,2))}
        ${quoteCell(c,'volume',v=>compact(v))}${quoteCell(c,'openInterest',v=>compact(v))}
        ${quoteCell(c,'iv',v=>pct(v))}${quoteCell(c,'delta',v=>fmt(v,4))}${quoteCell(c,'gamma',v=>fmt(v,5))}
        <td class="strike">${fmt(x.strike,2)}${atmClass?'<small>ATM</small>':''}</td>
        ${quoteCell(p,'gamma',v=>fmt(v,5))}${quoteCell(p,'delta',v=>fmt(v,4))}${quoteCell(p,'iv',v=>pct(v))}
        ${quoteCell(p,'openInterest',v=>compact(v))}${quoteCell(p,'volume',v=>compact(v))}
        ${quoteCell(p,'last',v=>fmt(v,2))}${quoteCell(p,'mid',v=>fmt(v,2))}
        ${quoteSizeCell(p,'ask')}${quoteSizeCell(p,'bid')}
      </tr>`;
    }).join('');
    const limit=s.displayStrikes==='all'?'All':s.displayStrikes;
    $(`so-${s.cfg.key}-rows-count`).textContent=`Showing ${data.length}/${all.length} strikes · ${s.quotes.size}/${s.contracts.length} quotes · limit ${limit}`;
  }

  function updateChainMeta(s){
    const c=calc(s),el=$(`so-${s.cfg.key}-chain-meta`);if(!el)return;
    el.innerHTML=`<span>Expiry: <b>${esc(s.expiry||'—')}</b></span><span>Contracts: <b>${s.contracts.length||s.quotes.size}</b></span><span>Quotes: <b>${s.quotes.size}/${s.contracts.length||s.quotes.size}</b></span><span>OI available: <b>${c.oiKnown}</b></span><span>OI unavailable / pending: <b>${c.oiMissing}</b></span><span>Full chain: <b>${c.complete?'Loaded':s.hydrating?'Loading…':'Partial'}</b></span><span>Last quote update: <b>${s.oiLastUpdate?new Date(s.oiLastUpdate).toLocaleTimeString('vi-VN'):'—'}</b></span>`;
    const multiplier=[...s.quotes.values()].find(x=>x.multiplier!==null && x.multiplier>0)?.multiplier??null;
    const mult=$(`so-${s.cfg.key}-multiplier`),toolbarMult=$(`so-${s.cfg.key}-contract-multiplier`);
    if(mult)mult.textContent=multiplier?`${fmt(multiplier,0)} shares`:'—';
    if(toolbarMult)toolbarMult.textContent=multiplier?`${fmt(multiplier,0)} shares`:'—';
    const meta=$(`so-${s.cfg.key}-meta`);if(meta){
      const items=[
        ['OPTIONS FEED','Binance Stock Options · delayed / access-dependent'],
        ['REST SOURCE','chain-symbols + get-option-quote'],
        ['CONTRACT MULTIPLIER',multiplier?`${fmt(multiplier,0)} shares`:'Chưa có quote multiplier'],
        ['OI COVERAGE',`${c.oiKnown}/${c.totalContracts} contracts có OI`],
        ['MISSING DATA',`${c.oiMissing} thiếu OI · ${c.multiplierMissing} thiếu multiplier`],
        ['SPOT WEBSOCKET',s.socket&&s.socket.readyState===WebSocket.OPEN?'Connected':'Connecting / closed']
      ];
      meta.innerHTML=items.map(([label,value])=>`<span class="opt-meta-item"><small>${esc(label)}</small><b>${esc(value)}</b></span>`).join('');
    }
  }

  function handlePrice(s, data){
    const rows=Array.isArray(data?.rates)?data.rates:Array.isArray(data)?data:[data];
    const hit=rows.find(x=>x && ((x.ac??x.assetCode)===s.cfg.assetCode||(x.s??x.symbol)===s.cfg.symbol));
    if(!hit)return;
    s.price=num(hit.p??hit.price??hit.c??hit.close);
    s.previousClose=num(hit.pc??hit.prevClose??hit.lrc??hit.lastRegularClose??hit.prc??hit.prevRegularClose);
    s.priceTime=num(hit.t??hit.time??hit.E??hit.eventTime)||Date.now();
    renderKpis(s);renderLevels(s);renderExposure(s);renderGreeks(s);renderOI(s);renderChain(s);
    try{if(typeof window.crossAssetMapDataUpdated==='function')window.crossAssetMapDataUpdated(s.cfg.key)}catch(e){}
  }

  function subscribe(s){
    if(!s.active)return;
    closeSocket(s);
    let ws;
    try{ws=new WebSocket(WS_URL);}catch(e){scheduleReconnect(s);return;}
    s.socket=ws;
    ws.onopen=()=>{
      s.reconnectDelay=1000;
      const params=[`${s.cfg.assetCode}@symbol_price`];
      s.streamNames=params;
      if(s.expiry){const root=s.expirations.find(x=>x.date===s.expiry)?.root||s.cfg.root;const d=s.expiry.replace(/-/g,'');params.push(`${s.cfg.symbol}_${d}_${root}@optionChainQuoteDelayed`);s.streamNames=params;}
      ws.send(JSON.stringify({method:'SUBSCRIBE',params,id:s.requestId++}));
      setStatus(s,`Connected · ${s.cfg.symbol}`,'ok');
    };
    ws.onmessage=ev=>{
      let msg;try{msg=JSON.parse(ev.data)}catch{return;}
      const stream=String(msg.stream||''),data=msg.data??msg;
      if(stream.endsWith('@symbol_price')||stream==='price'||data.rates||data.ac)handlePrice(s,data);
      else if(stream.includes('@optionChainQuote')){
        const items=[data.q,data.t,data.g,data.v].find(Array.isArray)||data.data||data.quotes||data.list||data;
        mergeLiveQuote(s,items);
      }
    };
    ws.onerror=()=>setStatus(s,'WebSocket lỗi · đang thử kết nối lại','bad');
    ws.onclose=()=>{if(s.active){setStatus(s,'Mất kết nối · reconnect…','loading');scheduleReconnect(s);}};
  }
  function closeSocket(s){
    if(s.socket){try{s.socket.onclose=null;s.socket.close(1000,'stock-options inactive')}catch{}s.socket=null;}
    if(s.reconnectTimer){clearTimeout(s.reconnectTimer);s.reconnectTimer=null;}
  }
  function scheduleReconnect(s){
    if(!s.active||s.reconnectTimer)return;
    const wait=s.reconnectDelay||1000;s.reconnectDelay=Math.min(30000,wait*2);
    s.reconnectTimer=setTimeout(()=>{s.reconnectTimer=null;if(s.active)subscribe(s);},wait);
  }
  function syncOptionStream(s){
    if(!s.active||!s.socket||s.socket.readyState!==WebSocket.OPEN)return;
    const old=s.streamNames.filter(x=>x.includes('@optionChainQuote'));
    if(old.length)s.socket.send(JSON.stringify({method:'UNSUBSCRIBE',params:old,id:s.requestId++}));
    const base=s.streamNames.filter(x=>!x.includes('@optionChainQuote'));
    if(!s.expiry){s.streamNames=base;return;}
    const root=s.expirations.find(x=>x.date===s.expiry)?.root||s.cfg.root,d=s.expiry.replace(/-/g,'');
    const name=`${s.cfg.symbol}_${d}_${root}@optionChainQuoteDelayed`;
    s.socket.send(JSON.stringify({method:'SUBSCRIBE',params:[name],id:s.requestId++}));s.streamNames=[...base,name];
  }

  async function refreshQuotes(s){
    if(!s.active||!s.expiry||s.quoteLoading||s.hydrating)return;
    s.quoteLoading=true;
    try{await loadChain(s,true);}catch(e){s.crossAssetError=e.message||String(e);showError(s,e.message);setStatus(s,'Quote refresh lỗi','bad');try{if(typeof window.crossAssetMapDataUpdated==='function')window.crossAssetMapDataUpdated(s.cfg.key)}catch{}}
    finally{s.quoteLoading=false;}
  }
  function startPolling(s){
    if(s.pollTimer)clearInterval(s.pollTimer);
    s.pollTimer=setInterval(()=>refreshQuotes(s),60000);
  }

  async function activate(s){
    if(s.active)return;
    s.active=true;
    clearError(s);
    setStatus(s,'Đang kết nối Binance…','loading');
    try{
      const exps=await loadExpirations(s);
      const select=$(`so-${s.cfg.key}-expiry`);
      if(select){select.innerHTML=exps.map(x=>`<option value="${esc(x.date)}">${esc(dateLabel(x.date))} · ${esc(x.root)}</option>`).join('');
        const today=isoTodayNY(),preferred=exps.find(x=>x.date>=today)||exps[0];s.expiry=preferred.date;select.value=s.expiry;}
      subscribe(s);
      await loadChain(s);
      startPolling(s);
      setStatus(s,`Connected · ${s.quotes.size} option quotes`,'ok');
    }catch(e){s.crossAssetError=e.message||String(e);showError(s,e.message);setStatus(s,'Không tải được dữ liệu','bad');try{if(typeof window.crossAssetMapDataUpdated==='function')window.crossAssetMapDataUpdated(s.cfg.key)}catch{}}
  }
  function deactivate(s){
    s.active=false;closeSocket(s);
    if(s.pollTimer){clearInterval(s.pollTimer);s.pollTimer=null;}
  }
  function bindView(s){
    const p='so-'+s.cfg.key,view=$('v-'+s.cfg.key+'Options');if(!view||view.dataset.stockOptionsBound)return;
    view.dataset.stockOptionsBound='1';
    $(`${p}-refresh`).onclick=()=>{clearError(s);refreshQuotes(s);};
    $(`${p}-expiry`).onchange=e=>{s.expiry=e.target.value;loadChain(s).catch(err=>{showError(s,err.message);setStatus(s,'Không tải được expiry','bad')});};
    const strikeSelect=$(`${p}-strike-count`);if(strikeSelect){strikeSelect.value=String(s.displayStrikes);strikeSelect.onchange=e=>{s.displayStrikes=e.target.value==='all'?'all':Math.max(5,+e.target.value||15);saveDisplayStrikes(s.cfg.key,s.displayStrikes);renderChain(s);};}
    $(`${p}-method-toggle`).onclick=()=>{const box=$(`${p}-method`);box.hidden=!box.hidden;};
    $(`${p}-exposure-metric`).onchange=()=>renderExposure(s);
    $(`${p}-copy`).onclick=()=>{
      const c=calc(s),text=[`${s.cfg.symbol} · ${s.expiry}`,`Call OI Wall: ${c.callOIWall?.strike??'—'}`,`Put OI Wall: ${c.putOIWall?.strike??'—'}`,`CW (max +Net GEX): ${c.gexCallWall?.strike??'—'}`,`PW (max |−Net GEX|): ${c.gexPutWall?.strike??'—'}`,`Gamma Flip / Zero Gamma (BSM repriced): ${c.gammaFlip??'—'}`,`Max Pain: ${c.maxPain?.strike??'—'}${c.maxPain?.isTie?` (tied: ${c.maxPain.tiedStrikes.join('/')})`:''}`,`GEX Ratio (Call GEX / |Put GEX|): ${c.gexRatioState==='call-only'?'∞':c.gexRatio===null?'—':c.gexRatio.toFixed(4)+'x'}`,`GEX 1-10: ${c.gexLevels.map(x=>x.strike).join(', ')}`,`Call OI: ${c.callOI}`,`Put OI: ${c.putOI}`,`GEX: ${c.gamma}`,`DEX: ${c.delta}`,`OI coverage: ${(c.coverage*100).toFixed(1)}%`].join('\n');
      if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).catch(()=>{});else{const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();}
    };
  }

  let crossAssetRequested=null;
  function setActive(viewKey){
    for(const s of Object.values(sessions)){
      if(s.cfg.key+'Options'===viewKey||s.cfg.key===crossAssetRequested)activate(s);
      else if(s.active)deactivate(s);
    }
  }
  function crossAssetStart(key){
    if(!sessions[key])throw new Error('Nguồn ETF không hợp lệ: '+key);
    crossAssetRequested=key;activate(sessions[key]);
  }
  function crossAssetStop(){
    crossAssetRequested=null;setActive(document.body?.dataset?.v||null);
  }
  async function crossAssetSetExpiry(key,expiry){
    const s=sessions[key];if(!s||!s.expirations.some(x=>x.date===expiry))throw new Error('Expiry không hợp lệ cho '+(s?.cfg.symbol||key));
    if(s.expiry===expiry)return true;
    s.expiry=expiry;s.crossAssetError='';
    try{await loadChain(s);return true;}
    catch(e){s.crossAssetError=e.message||String(e);try{if(typeof window.crossAssetMapDataUpdated==='function')window.crossAssetMapDataUpdated(key)}catch{}throw e;}
  }
  function crossAssetSnapshot(key){
    const s=sessions[key];if(!s)return null;
    const c=calc(s);
    return {key,symbol:s.cfg.symbol,price:s.price,priceTime:s.priceTime,expiry:s.expiry,expirations:s.expirations.map(x=>({date:x.date,root:x.root})),updatedAt:s.oiLastUpdate,error:s.crossAssetError||'',
      coverage:c.coverage,oiKnown:c.oiKnown,totalContracts:c.totalContracts,callOI:c.callOI,putOI:c.putOI,callVol:c.callVol,putVol:c.putVol,
      callOIWall:c.oiComplete&&c.callOIWall?{strike:c.callOIWall.strike,oi:c.callOIWall.callOI}:null,
      putOIWall:c.oiComplete&&c.putOIWall?{strike:c.putOIWall.strike,oi:c.putOIWall.putOI}:null,
      gexCallWall:c.gexCallWall?{strike:c.gexCallWall.strike,gex:c.gexCallWall.gex}:null,
      gexPutWall:c.gexPutWall?{strike:c.gexPutWall.strike,gex:c.gexPutWall.gex}:null,
      gexComplete:c.gexComplete,gexKnown:c.gexKnown,gexMissing:c.gexMissing,gexCoverage:c.gexCoverage,
      gammaFlip:c.gammaFlipComplete?c.gammaFlip:null,gammaFlipMethod:'Gamma Flip / Zero Gamma · BSM repricing · fixed OI/IV · r=q=0 · expiry 16:00 America/New_York · bisection-refined Net GEX zero-cross',maxPain:c.maxPain?{strike:c.maxPain.strike,payout:c.maxPain.payout}:null,gexRatio:c.gexRatio,gexRatioState:c.gexRatioState,gexRatioBias:c.gexRatioBias,callGexTotal:c.callGexTotal,putGexAbsTotal:c.putGexAbsTotal,complete:c.complete,oiComplete:c.oiComplete,maxPainComplete:c.maxPainComplete,
      gexLevels:c.gexLevels.map((x,i)=>({rank:i+1,strike:x.strike,gex:x.gex})),oiWall:c.oiWall?{strike:c.oiWall.strike,oi:c.oiWall.oi}:null,
      dist:c.dist.map(x=>({strike:x.strike,callOI:x.callOI,putOI:x.putOI,callVol:x.callVol,putVol:x.putVol,gex:c.gexComplete?x.gex:null,callGex:c.gexComplete?x.callGex:null,putGex:c.gexComplete?x.putGex:null}))};
  }

  buildViews();
  window.stockOptionsSetActive=setActive;
  window.stockOptionsCrossAssetStart=crossAssetStart;
  window.stockOptionsCrossAssetStop=crossAssetStop;
  window.stockOptionsCrossAssetSnapshot=crossAssetSnapshot;
  window.stockOptionsCrossAssetSetExpiry=crossAssetSetExpiry;
  window.stockOptionsDebug=()=>Object.fromEntries(Object.values(sessions).map(s=>[s.cfg.symbol,{expiry:s.expiry,quotes:s.quotes.size,contracts:s.contracts.length,complete:s.chainComplete,hydrating:s.hydrating,displayStrikes:s.displayStrikes,oi:[...s.quotes.values()].filter(q=>q.openInterest!==null).length,price:s.price}]));
})();
