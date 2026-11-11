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
  const intervals = ['5m','1h','1d','1w','1M'];
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
      <div class="so-chart-grid">
        <div class="card so-chart-card">
          <div class="opt-card-title"><div><h3>${cfg.symbol} Candlestick Chart</h3><small id="${p}-chart-meta">Chờ Binance Equity Kline stream…</small></div>
            <div class="so-tfs">${intervals.map((it,i)=>`<button type="button" class="tf${i===0?' on':''}" data-so-interval="${it}">${it}</button>`).join('')}</div>
          </div>
          <div class="so-chart-wrap"><div id="${p}-chart" class="so-chart"></div><div class="so-chart-empty" id="${p}-chart-empty">Đang chờ nến đầu tiên từ Binance. Stream Stocks gửi nến đang chạy; chưa có endpoint REST Kline lịch sử trong tài liệu Stocks API công khai.</div></div>
          <div class="so-chart-foot"><span id="${p}-chart-ohlc">O — · H — · L — · C —</span><span id="${p}-chart-feed">Kline stream · ${cfg.symbol}</span></div>
        </div>
        <div class="card so-quote-card">
          <div class="opt-card-title"><h3>Underlying Snapshot</h3><small>Binance Equity</small></div>
          <div class="so-quote-price" id="${p}-price">—</div>
          <div class="so-quote-change" id="${p}-change">Chưa có giá mới</div>
          <div class="so-quote-list">
            <div><span>Previous close</span><b id="${p}-prev">—</b></div>
            <div><span>Market phase</span><b id="${p}-phase">—</b></div>
            <div><span>Last update</span><b id="${p}-updated">—</b></div>
            <div><span>Contract multiplier</span><b id="${p}-multiplier">—</b></div>
          </div>
          <p class="so-note">Giá underlying lấy từ stream riêng <code>${cfg.assetCode}@symbol_price</code>. Stock Options quote được lấy từ endpoint riêng của Binance và có thể bị delay tùy quyền dữ liệu.</p>
        </div>
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
            <div class="so-exposure-legend"><span><i class="call"></i>CALL EXPOSURE</span><span><i class="put"></i>PUT EXPOSURE</span><span><i class="spot"></i>UNDERLYING SPOT</span></div>
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
        <div class="opt-meta" id="${p}-meta"></div>
        <div class="opt-method" id="${p}-method" hidden>
          <p><strong>Nguồn Option Chain:</strong> Binance Stock Options <code>option/chain-symbols</code> liệt kê OCC symbols theo ngày đáo hạn; <code>get-option-quote</code> trả Bid/Ask/Mid, volume, OI, multiplier, IV và Greeks.</p>
          <p><strong>Contract size:</strong> multiplier đọc từ từng option quote (mẫu GLD trong HAR là 100 shares/contract). Không hardcode OI và không thay <code>null</code> bằng 0.</p>
          <p><strong>GEX:</strong> Σ(Gamma × OI × multiplier × Spot² × 0.01), Call dương và Put âm. <strong>DEX:</strong> Σ(Delta × OI × multiplier × Spot). Vega và Theta tổng hợp từ Greek × OI × multiplier.</p>
          <p><strong>Key Levels:</strong> Call/Put OI Wall là strike có OI lớn nhất theo từng phía. Gamma Flip là điểm cumulative GEX đổi dấu. GEX 1–10 là các strike có trị tuyệt đối net GEX lớn nhất, xếp theo độ mạnh chứ không theo thứ tự giá. Max Pain là strike tối thiểu hóa intrinsic payout tính từ OI của toàn expiry.</p>
          <p><strong>Vol Trigger:</strong> chỉ hiện khi Binance hoặc nguồn dữ liệu tích hợp cung cấp trường Vol Trigger riêng. Không đồng nhất trường này với Gamma Flip. Với nguồn Binance hiện tại nếu không có trường riêng, dashboard sẽ ghi chưa có dữ liệu.</p>
          <p><strong>Giới hạn:</strong> Binance trả <code>oi: null</code> cho một số hợp đồng. Các hợp đồng này được đánh dấu thiếu OI và bị loại khỏi exposure, nhưng vẫn hiển thị dữ liệu quote/Greeks còn lại. Endpoint quote có thể trả dữ liệu trễ; độ trễ phụ thuộc quyền dữ liệu tài khoản.</p>
          <p><strong>Chart:</strong> Dùng Equity WebSocket <code>${cfg.symbol}@kline_INTERVAL</code> (5m, 1h, 1d, 1w, 1M). Luồng công khai được xác minh là cập nhật nến đang chạy, không bao gồm backfill lịch sử trong request capture hiện có. Biểu đồ sẽ bắt đầu có nến khi Binance gửi payload; không tự sinh dữ liệu lịch sử.</p>
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
        phase:'—', priceTime:0, interval:'5m', chart:null, candleSeries:null, volumeSeries:null,
        lastCandle:null, candlesSeen:0, oiLastUpdate:0, quoteLoading:false, chartResize:null,
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
    const url = isDirectPublic ? (BINANCE_PUBLIC_BASE + path) : (ensureProxyConfigured(), API_PREFIX + path);
    let response;
    try{
      response=await fetch(url,options);
    }catch(e){
      if(isDirectPublic) throw new Error('Binance không cho trình duyệt truy cập trực tiếp chain-symbols (CORS hoặc network). Đây là bước thử A; nếu tiếp tục lỗi sẽ chuyển sang Node.js proxy. Chi tiết: '+(e.message||e));
      throw new Error('Không gọi được Binance proxy. Kiểm tra URL Cloudflare Worker trong js/stock-options-config.js. Chi tiết: '+(e.message||e));
    }
    const text=await response.text();
    if(!response.ok){
      const message=`HTTP ${response.status}: ${text.slice(0,180)}`;
      if(isDirectPublic) throw new Error('Binance direct chain-symbols bị từ chối: '+message);
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
  function showError(s,msg){const el=$(`so-${s.cfg.key}-error`);if(el){el.hidden=false;el.textContent=msg;}}
  function clearError(s){const el=$(`so-${s.cfg.key}-error`);if(el){el.hidden=true;el.textContent='';}}


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
    if(!found.length)throw new Error(`Không lấy được expiry ${cfg.symbol} trực tiếp từ Binance. ${firstError||'Không có contract trong các ngày đã kiểm tra.'}`);
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
    const oi=q.oi!==undefined?q.oi:q.openInterest;
    return {
      optionSymbol, name:q.n??q.name??optionSymbol, side,
      expiration:num(q.e??q.expiration), strike:num(q.sp??q.strikePrice??q.strike)??occStrike(optionSymbol), multiplier:num(q.m??q.multiplier),
      last:num(q.p??q.l??q.lastPrice??q.last), bid:num(q.bp??q.bid), ask:num(q.ap??q.ask), mid:num(q.mp??q.mid),
      volume:num(q.v??q.volume), openInterest:oi===null||oi===undefined?null:num(oi),
      iv:num(q.iv??q.impliedVolatility), delta:num(q.de??q.delta), gamma:num(q.ga??q.gamma), theta:num(q.th??q.theta), vega:num(q.ve??q.vega),
      breakEven:num(q.be??q.breakEven), previousClose:num(q.pcp??q.previousClose), bidSize:num(q.bs??q.bidSize), askSize:num(q.as??q.askSize),
      volTrigger:num(q.vt??q.volTrigger??q.volatilityTrigger)
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
    const sourceKeys={name:['n','name'],side:['t','contractType','side'],expiration:['e','expiration'],strike:['sp','strikePrice','strike'],multiplier:['m','multiplier'],last:['p','l','lastPrice','last'],bid:['bp','bid'],ask:['ap','ask'],mid:['mp','mid'],volume:['v','volume'],openInterest:['oi','openInterest'],iv:['iv','impliedVolatility'],delta:['de','delta'],gamma:['ga','gamma'],theta:['th','theta'],vega:['ve','vega'],breakEven:['be','breakEven'],previousClose:['pcp','previousClose'],bidSize:['bs','bidSize'],askSize:['as','askSize'],volTrigger:['vt','volTrigger','volatilityTrigger']};
    let changed=false;
    for(const item of arr){
      if(!item || !(item.os||item.optionSymbol))continue;
      const q=normaliseQuote(item);
      if(s.contractSymbols?.size && !s.contractSymbols.has(q.optionSymbol))continue;
      const old=s.quotes.get(q.optionSymbol)||{...q,openInterest:null,volume:null,iv:null,delta:null,gamma:null,theta:null,vega:null,bid:null,ask:null,mid:null,last:null,multiplier:null,bidSize:null,askSize:null,volTrigger:null};
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
    if(!dist.length)return null;
    const strikes=dist.map(x=>x.strike);let best=null;
    for(const settlement of strikes){
      let payout=0;
      for(const x of dist){
        payout+=Math.max(0,settlement-x.strike)*(x.callPainOI||0);
        payout+=Math.max(0,x.strike-settlement)*(x.putPainOI||0);
      }
      if(!best||payout<best.payout)best={strike:settlement,payout};
    }
    return best;
  }
  function calc(s){
    const rows=getRows(s),spot=s.price;
    let callOI=0,putOI=0,oiKnown=0,oiMissing=0,multiplierMissing=0,callVol=0,putVol=0;
    const per=new Map();let delta=spot!==null?0:null,gamma=spot!==null?0:null,vega=0,theta=0;
    const volTriggers=[];
    for(const q of rows){
      if(!Number.isFinite(q.strike))continue;
      const side=q.side;
      const p=per.get(strikeKey(q.strike))||{strike:q.strike,gex:0,dex:0,vgex:0,thex:0,callOI:0,putOI:0,callVol:0,putVol:0,callGex:0,putGex:0,callDex:0,putDex:0,callVgex:0,putVgex:0,callThex:0,putThex:0,callPainOI:0,putPainOI:0};
      if(q.volume!=null){if(side==='C'){callVol+=q.volume;p.callVol+=q.volume;}else{putVol+=q.volume;p.putVol+=q.volume;}}
      if(q.volTrigger!=null&&q.volTrigger>0)volTriggers.push(q.volTrigger);
      per.set(strikeKey(q.strike),p);
      if(q.openInterest==null){oiMissing++;continue;}
      const oi=q.openInterest,m=q.multiplier;
      oiKnown++;
      if(side==='C'){callOI+=oi;p.callOI+=oi;p.callPainOI+=oi*(m>0?m:1);}else{putOI+=oi;p.putOI+=oi;p.putPainOI+=oi*(m>0?m:1);}
      if(m==null||!Number.isFinite(m)||m<=0){multiplierMissing++;continue;}
      if(spot!==null&&q.gamma!=null){const raw=q.gamma*oi*m*spot*spot*.01;const v=side==='P'?-raw:raw;p.gex+=v;if(side==='C')p.callGex+=Math.abs(raw);else p.putGex-=Math.abs(raw);gamma+=v;}
      if(spot!==null&&q.delta!=null){const raw=q.delta*oi*m*spot;p.dex+=raw;if(side==='C')p.callDex+=Math.abs(raw);else p.putDex+=Math.abs(raw);delta+=raw;}
      if(q.vega!=null){const raw=q.vega*oi*m;p.vgex+=raw;if(side==='C')p.callVgex+=Math.abs(raw);else p.putVgex+=Math.abs(raw);vega+=raw;}
      if(q.theta!=null){const raw=q.theta*oi*m;p.thex+=raw;if(side==='C')p.callThex+=Math.abs(raw);else p.putThex+=Math.abs(raw);theta+=raw;}
    }
    const dist=[...per.values()].sort((a,b)=>a.strike-b.strike);
    const calls=dist.filter(x=>x.callOI>0).sort((a,b)=>b.callOI-a.callOI);
    const puts=dist.filter(x=>x.putOI>0).sort((a,b)=>b.putOI-a.putOI);
    let cumulative=0,flip=null,previous=null;
    for(const x of dist){
      const next=cumulative+x.gex;
      if(previous&&((cumulative<=0&&next>=0)||(cumulative>=0&&next<=0))&&next!==cumulative){
        const ratio=(0-cumulative)/(next-cumulative);flip=previous.strike+(x.strike-previous.strike)*ratio;break;
      }
      cumulative=next;previous=x;
    }
    const totalContracts=Math.max(rows.length,s.contracts.length||0);
    oiMissing=Math.max(oiMissing,totalContracts-oiKnown);
    const validOI=oiKnown,coverage=totalContracts?validOI/totalContracts:0;
    const gexLevels=dist.filter(x=>Number.isFinite(x.gex)&&Math.abs(x.gex)>0).slice().sort((a,b)=>Math.abs(b.gex)-Math.abs(a.gex)).slice(0,10);
    const volTrigger=volTriggers.length?volTriggers.sort((a,b)=>a-b)[Math.floor(volTriggers.length/2)]:null;
    const complete=!!s.chainComplete&&(s.contractSymbols?.size?Array.from(s.contractSymbols).every(symbol=>s.quotes.has(symbol)):s.quotes.size>=s.contracts.length);
    const oiComplete=complete&&oiMissing===0;
    const maxPainComplete=oiComplete&&multiplierMissing===0;
    return {rows,dist,callOI,putOI,oiKnown,oiMissing,multiplierMissing,totalContracts,callVol,putVol,volume:callVol+putVol,delta,gamma,vega,theta,
      callWall:calls[0]||null,putWall:puts[0]||null,flip,volTrigger,gexLevels,maxPain:maxPainComplete?maxPainOf(dist):null,complete,oiComplete,maxPainComplete,coverage,
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
      {key:'call',label:'CALL OI WALL',tag:'CALL',value:c.callWall?fmt(c.callWall.strike,2):'—',meta:c.callWall?`Open interest · ${compact(c.callWall.callOI)}`:'Chưa có Call OI'},
      {key:'put',label:'PUT OI WALL',tag:'PUT',value:c.putWall?fmt(c.putWall.strike,2):'—',meta:c.putWall?`Open interest · ${compact(c.putWall.putOI)}`:'Chưa có Put OI'},
      {key:'flip',label:'GAMMA FLIP',tag:'GEX',value:c.flip===null?'—':fmt(c.flip,2),meta:c.flip===null?'Chưa tìm thấy điểm cumulative GEX đổi dấu':'Cumulative GEX đổi dấu'},
      {key:'vol',label:'VOL TRIGGER',tag:'VOL',value:c.volTrigger===null?'—':fmt(c.volTrigger,2),meta:c.volTrigger===null?'Nguồn Binance chưa cung cấp level riêng':'Level từ provider'},
      {key:'pain',label:'MAX PAIN',tag:'EXPIRY',value:c.maxPain?fmt(c.maxPain.strike,2):'—',meta:c.maxPain?`Payout model · ${compact(c.maxPain.payout)}`:!c.complete?'Cần tải đủ expiry':!c.oiComplete?'OI chưa đủ để tính':'Thiếu contract multiplier'},
      {key:'maxoi',label:'MAX OI STRIKE',tag:'OI',value:c.oiWall?fmt(c.oiWall.strike,2):'—',meta:c.oiWall?`Max side OI · ${compact(c.oiWall.oi)}`:'Chưa có OI'}
    ];
    const status=pending?'<span class="kl-status is-loading">Đang tải full chain</span>':'<span class="kl-status">Expiry đã đồng bộ</span>';
    const cardsHtml=cards.map(x=>`<article class="kl-card kl-${x.key}"><div class="kl-card-top"><span class="kl-label">${x.label}</span><span class="kl-tag">${x.tag}</span></div><strong class="kl-value">${esc(x.value)}</strong><span class="kl-meta">${esc(x.meta)}</span></article>`).join('');
    const maxGex=Math.max(1,...c.gexLevels.map(x=>Math.abs(x.gex)));
    const gexHtml=c.gexLevels.length?c.gexLevels.map((x,i)=>{const pos=x.gex>=0,ratio=Math.max(2,Math.abs(x.gex)/maxGex*100);return `<div class="kl-gex-row ${pos?'is-positive':'is-negative'}"><span class="kl-rank">${String(i+1).padStart(2,'0')}</span><strong class="kl-strike">${fmt(x.strike,2)}</strong><span class="kl-track"><i style="width:${ratio.toFixed(1)}%"></i></span><b class="kl-gex-value">${x.gex>=0?'+':'−'}${compact(Math.abs(x.gex))}</b><span class="kl-side">${pos?'NET +':'NET −'}</span></div>`}).join(''):'<div class="kl-empty">Chưa có dữ liệu GEX theo strike.</div>';
    el.innerHTML=`<div class="kl-summary-grid">${cardsHtml}</div><section class="kl-gex-panel"><div class="kl-gex-heading"><div><h4>GEX ladder <span>01—10</span></h4><p>Các strike được xếp theo trị tuyệt đối của Net GEX</p></div>${status}</div><div class="kl-gex-list">${gexHtml}</div><p class="kl-footnote">GEX dương / âm theo quy ước Call dương, Put âm. Đây là exposure ước tính từ OI và Greeks của expiry đang chọn.</p></section>`;
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
      const cw=call/max*100,pw=put/max*100;
      const rowClass=(Number.isFinite(s.price)&&Math.abs(x.strike-s.price)<=range/Math.max(visible.length-1,1)*.55)?' is-near-spot':'';
      return `<div class="exposure-row${rowClass}" style="--row-i:${i}" data-strike="${x.strike}" title="Strike ${fmt(x.strike,2)} · Call ${compact(call)} · Put ${compact(put)}"><span class="exposure-strike">${fmt(x.strike,2)}</span><span class="exposure-put-track"><i style="width:${pw.toFixed(2)}%"></i></span><span class="exposure-zero"></span><span class="exposure-call-track"><i style="width:${cw.toFixed(2)}%"></i></span></div>`;
    }).join('');
    const lines=[
      marker(s.price,'is-spot','SPOT'),
      marker(c.callWall?.strike,'is-call-wall','CALL RESISTANCE'),
      marker(c.putWall?.strike,'is-put-wall','PUT SUPPORT')
    ].join('');
    const status=c.complete?'FULL CHAIN':'PARTIAL CHAIN';
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
    const meta=$(`so-${s.cfg.key}-meta`);if(meta)meta.innerHTML=`<span>REST: chain-symbols + get-option-quote</span><span>Options feed: delayed / access-dependent</span><span>Multiplier from quote: ${multiplier??'—'}</span><span>${c.oiMissing} contracts without usable OI</span><span>${c.multiplierMissing} contracts without multiplier (excluded from exposure)</span><span>Underlying WS: ${s.socket&&s.socket.readyState===WebSocket.OPEN?'connected':'connecting / closed'}</span><span>Chart candles received: ${s.candlesSeen}</span>`;
  }

  function createChart(s){
    const cfg=s.cfg,container=$(`so-${cfg.key}-chart`);
    if(!container||s.chart||!window.LightweightCharts)return;
    const css=getComputedStyle(document.documentElement),ink=css.getPropertyValue('--ink').trim()||'#f5f5f5',mut=css.getPropertyValue('--mut').trim()||'#999',line=css.getPropertyValue('--line').trim()||'#333';
    const chart=LightweightCharts.createChart(container,{width:container.clientWidth||600,height:container.clientHeight||330,
      layout:{background:{type:'solid',color:'rgba(0,0,0,0)'},textColor:ink,fontFamily:'Space Grotesk, sans-serif'},
      grid:{vertLines:{color:line},horzLines:{color:line}},
      rightPriceScale:{borderColor:line,scaleMargins:{top:.08,bottom:.08}},
      timeScale:{borderColor:line,timeVisible:true,secondsVisible:false,rightOffset:5},
      crosshair:{mode:LightweightCharts.CrosshairMode?.Normal??0,vertLine:{color:mut},horzLine:{color:mut}},
      handleScroll:{mouseWheel:true,pressedMouseMove:true},handleScale:{mouseWheel:true,pinch:true}
    });
    const series=chart.addCandlestickSeries({upColor:'#22b58c',downColor:'#e45369',borderUpColor:'#22b58c',borderDownColor:'#e45369',wickUpColor:'#22b58c',wickDownColor:'#e45369',priceLineVisible:true});
    s.chart=chart;s.candleSeries=series;
    if(s.lastCandle){try{series.setData([s.lastCandle])}catch{}}
    s.chartResize=()=>{if(!s.chart)return;const w=container.clientWidth,h=container.clientHeight;if(w&&h)s.chart.applyOptions({width:w,height:h});};
    window.addEventListener('resize',s.chartResize);
    try{chart.timeScale().fitContent()}catch{}
  }

  function updateCandle(s, payload){
    const k=payload.k||payload;
    const ts=num(k.t??k.time??payload.t);
    const open=num(k.o??k.open),high=num(k.h??k.high),low=num(k.l??k.low),close=num(k.c??k.close),volume=num(k.v??k.volume);
    if(ts===null||open===null||high===null||low===null||close===null)return;
    const time=Math.floor(ts>1e12?ts/1000:ts);
    const candle={time,open,high,low,close};
    s.lastCandle=candle;
    if(!s.chart)createChart(s);
    if(s.candleSeries){try{s.candleSeries.update(candle)}catch(e){
      // On a newly selected interval, discard the previous series timestamp before accepting a new stream.
      try{s.candleSeries.setData([candle])}catch{}
    }}
    s.candlesSeen++;
    const empty=$(`so-${s.cfg.key}-chart-empty`);if(empty)empty.hidden=true;
    const meta=$(`so-${s.cfg.key}-chart-meta`);if(meta)meta.textContent=`Binance Equity Kline · ${s.interval} · ${new Date(time*1000).toLocaleString('vi-VN')}`;
    const ohlc=$(`so-${s.cfg.key}-chart-ohlc`);if(ohlc)ohlc.textContent=`O ${fmt(open,2)} · H ${fmt(high,2)} · L ${fmt(low,2)} · C ${fmt(close,2)}${volume!==null?' · V '+compact(volume):''}`;
  }
  function handlePrice(s, data){
    const rows=Array.isArray(data?.rates)?data.rates:Array.isArray(data)?data:[data];
    const hit=rows.find(x=>x && ((x.ac??x.assetCode)===s.cfg.assetCode||(x.s??x.symbol)===s.cfg.symbol));
    if(!hit)return;
    s.price=num(hit.p??hit.price??hit.c??hit.close);
    s.previousClose=num(hit.pc??hit.prevClose??hit.lrc??hit.lastRegularClose??hit.prc??hit.prevRegularClose);
    s.phase=hit.mp||hit.marketPhase||s.phase;
    s.priceTime=num(hit.t??hit.time??hit.E??hit.eventTime)||Date.now();
    const price=$(`so-${s.cfg.key}-price`),change=$(`so-${s.cfg.key}-change`),prev=$(`so-${s.cfg.key}-prev`),phase=$(`so-${s.cfg.key}-phase`),updated=$(`so-${s.cfg.key}-updated`);
    if(price)price.textContent=fmt(s.price,2);
    const diff=s.price!==null&&s.previousClose!==null?s.price-s.previousClose:null,p=diff!==null&&s.previousClose?diff/s.previousClose:null;
    if(change){change.textContent=diff===null?'Chưa có giá đối chiếu':`${diff>=0?'+':''}${fmt(diff,2)} (${p===null?'—':(p*100).toFixed(2)+'%'})`;change.className='so-quote-change '+(diff===null?'':diff>=0?'pos-t':'neg-t');}
    if(prev)prev.textContent=fmt(s.previousClose,2);if(phase)phase.textContent=esc(s.phase||'—');if(updated)updated.textContent=new Date(s.priceTime).toLocaleTimeString('vi-VN');
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
      const params=[`${s.cfg.assetCode}@symbol_price`,`${s.cfg.symbol}@kline_${s.interval}`,`${s.cfg.symbol}@tradingStatus`,`${s.cfg.symbol}@tradability`];
      s.streamNames=params;
      if(s.expiry){const root=s.expirations.find(x=>x.date===s.expiry)?.root||s.cfg.root;const d=s.expiry.replace(/-/g,'');params.push(`${s.cfg.symbol}_${d}_${root}@optionChainQuoteDelayed`);s.streamNames=params;}
      ws.send(JSON.stringify({method:'SUBSCRIBE',params,id:s.requestId++}));
      setStatus(s,`Connected · ${s.cfg.symbol} · ${s.interval}`,'ok');
    };
    ws.onmessage=ev=>{
      let msg;try{msg=JSON.parse(ev.data)}catch{return;}
      const stream=String(msg.stream||''),data=msg.data??msg;
      if(stream.endsWith('@symbol_price')||stream==='price'||data.rates||data.ac)handlePrice(s,data);
      else if(stream.includes('@kline_')||data.k||data.e==='kline')updateCandle(s,data);
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
    requestAnimationFrame(()=>{ if(s.active){ createChart(s); s.chartResize?.(); } });
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
    if(s.chartResize){window.removeEventListener('resize',s.chartResize);s.chartResize=null;}
    if(s.chart){try{s.chart.remove()}catch{}s.chart=null;s.candleSeries=null;}
  }
  function changeInterval(s,next){
    if(!intervals.includes(next)||s.interval===next)return;
    const old=`${s.cfg.symbol}@kline_${s.interval}`;s.interval=next;
    const view=$(`v-${s.cfg.key}Options`);view?.querySelectorAll('[data-so-interval]').forEach(b=>b.classList.toggle('on',b.dataset.soInterval===next));
    if(s.socket?.readyState===WebSocket.OPEN){s.socket.send(JSON.stringify({method:'UNSUBSCRIBE',params:[old],id:s.requestId++}));s.socket.send(JSON.stringify({method:'SUBSCRIBE',params:[`${s.cfg.symbol}@kline_${next}`],id:s.requestId++}));}
    if(s.candleSeries){try{s.candleSeries.setData([])}catch{}}
    s.lastCandle=null;s.candlesSeen=0;
    const empty=$(`so-${s.cfg.key}-chart-empty`);if(empty)empty.hidden=false;
    const meta=$(`so-${s.cfg.key}-chart-meta`);if(meta)meta.textContent=`Đang chờ ${next} candle từ Binance…`;
    const feed=$(`so-${s.cfg.key}-chart-feed`);if(feed)feed.textContent=`Kline stream · ${s.cfg.symbol} · ${next}`;
  }
  function bindView(s){
    const p='so-'+s.cfg.key,view=$('v-'+s.cfg.key+'Options');if(!view||view.dataset.stockOptionsBound)return;
    view.dataset.stockOptionsBound='1';
    $(`${p}-refresh`).onclick=()=>{clearError(s);refreshQuotes(s);};
    $(`${p}-expiry`).onchange=e=>{s.expiry=e.target.value;loadChain(s).catch(err=>{showError(s,err.message);setStatus(s,'Không tải được expiry','bad')});};
    const strikeSelect=$(`${p}-strike-count`);if(strikeSelect){strikeSelect.value=String(s.displayStrikes);strikeSelect.onchange=e=>{s.displayStrikes=e.target.value==='all'?'all':Math.max(5,+e.target.value||15);saveDisplayStrikes(s.cfg.key,s.displayStrikes);renderChain(s);};}
    view.querySelectorAll('[data-so-interval]').forEach(b=>b.onclick=()=>changeInterval(s,b.dataset.soInterval));
    $(`${p}-method-toggle`).onclick=()=>{const box=$(`${p}-method`);box.hidden=!box.hidden;};
    $(`${p}-exposure-metric`).onchange=()=>renderExposure(s);
    $(`${p}-copy`).onclick=()=>{
      const c=calc(s),text=[`${s.cfg.symbol} · ${s.expiry}`,`Call Wall: ${c.callWall?.strike??'—'}`,`Put Wall: ${c.putWall?.strike??'—'}`,`Gamma Flip: ${c.flip??'—'}`,`Vol Trigger: ${c.volTrigger??'Not supplied by source'}`,`Max Pain: ${c.maxPain?.strike??'—'}`,`GEX 1-10: ${c.gexLevels.map(x=>x.strike).join(', ')}`,`Call OI: ${c.callOI}`,`Put OI: ${c.putOI}`,`GEX: ${c.gamma}`,`DEX: ${c.delta}`,`OI coverage: ${(c.coverage*100).toFixed(1)}%`].join('\n');
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
      callWall:c.callWall?{strike:c.callWall.strike,oi:c.callWall.callOI}:null,
      putWall:c.putWall?{strike:c.putWall.strike,oi:c.putWall.putOI}:null,
      flip:c.flip,volTrigger:c.volTrigger,maxPain:c.maxPain?{strike:c.maxPain.strike,payout:c.maxPain.payout}:null,complete:c.complete,oiComplete:c.oiComplete,maxPainComplete:c.maxPainComplete,
      gexLevels:c.gexLevels.map((x,i)=>({rank:i+1,strike:x.strike,gex:x.gex})),oiWall:c.oiWall?{strike:c.oiWall.strike,oi:c.oiWall.oi}:null,
      dist:c.dist.map(x=>({strike:x.strike,callOI:x.callOI,putOI:x.putOI,callVol:x.callVol,putVol:x.putVol,gex:x.gex,callGex:x.callGex,putGex:x.putGex}))};
  }

  buildViews();
  window.stockOptionsSetActive=setActive;
  window.stockOptionsCrossAssetStart=crossAssetStart;
  window.stockOptionsCrossAssetStop=crossAssetStop;
  window.stockOptionsCrossAssetSnapshot=crossAssetSnapshot;
  window.stockOptionsCrossAssetSetExpiry=crossAssetSetExpiry;
  window.stockOptionsDebug=()=>Object.fromEntries(Object.values(sessions).map(s=>[s.cfg.symbol,{expiry:s.expiry,quotes:s.quotes.size,contracts:s.contracts.length,complete:s.chainComplete,hydrating:s.hydrating,displayStrikes:s.displayStrikes,oi:[...s.quotes.values()].filter(q=>q.openInterest!==null).length,price:s.price,interval:s.interval}]));
})();
