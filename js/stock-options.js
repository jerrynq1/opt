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
  function collectGexLadderExclusions({callOIWall,putOIWall,gexCallWall,gexPutWall,maxPain,gammaFlip}={}){
    const byStrike=new Map();
    const add=(value,reason)=>{
      const strike=Number(value);
      if(!Number.isFinite(strike)||strike<=0)return;
      const key=strikeKey(strike);
      if(!byStrike.has(key))byStrike.set(key,{strike,reasons:[]});
      const entry=byStrike.get(key);if(!entry.reasons.includes(reason))entry.reasons.push(reason);
    };
    add(callOIWall?.strike,'CALL OI WALL');
    add(putOIWall?.strike,'PUT OI WALL');
    add(gexCallWall?.strike,'CW');
    add(gexPutWall?.strike,'PW');
    add(maxPain?.strike,'MAX PAIN');
    for(const strike of (Array.isArray(maxPain?.tiedStrikes)?maxPain.tiedStrikes:[]))add(strike,'MAX PAIN TIE');
    add(gammaFlip,'GAMMA FLIP / ZERO GAMMA');
    return [...byStrike.values()];
  }
  function isExcludedGexStrike(strike,excluded=[]){
    const value=Number(strike);
    return Number.isFinite(value)&&excluded.some(x=>Number.isFinite(+x.strike)&&Math.abs(value-(+x.strike))<=1e-4);
  }

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
        <div class="opt-metric"><span>OI OBSERVED</span><strong>—</strong><small>OI thực nhận · null được giả định 0</small></div>
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
          <span class="opt-meta-item"><small>NULL OI / VOLUME</small><b>Giả định 0 cho analytics · tự cập nhật khi có dữ liệu</b></span>
        </div>
        <div class="opt-method" id="${p}-method" hidden>
          <p><strong>Nguồn Option Chain:</strong> Binance Stock Options <code>option/chain-symbols</code> liệt kê OCC symbols theo ngày đáo hạn; <code>get-option-quote</code> trả Bid/Ask/Mid, volume, OI, multiplier, IV và Greeks.</p>
          <p><strong>Contract size:</strong> multiplier được đọc từ quote hoặc contract metadata. Với OCC root QQQ/GLD chuẩn, nếu cả hai nguồn không gửi multiplier, QuantLab ghi rõ giả định chuẩn 100 shares; adjusted OCC roots không dùng giả định này. OI hoặc Volume trả <code>null</code> được giả định bằng 0 cho analytics khi OCC quote đã nhận đầy đủ; giá trị thô vẫn giữ null và được đánh dấu assumed-zero cho tới khi Binance gửi số liệu thực.</p>
          <p><strong>GEX:</strong> Σ(Gamma × OI × multiplier × Spot² × 0.01), Call dương và Put âm. Nếu Binance không trả Gamma cho contract, QuantLab tự tính Gamma bằng Black–Scholes từ IV, strike, Spot và DTE (r = q = 0); chỉ khi thiếu cả Gamma provider lẫn IV hợp lệ thì contract đó mới bị tính là thiếu GEX. <strong>DEX:</strong> Σ(Delta × OI × multiplier × Spot). Vega và Theta tổng hợp từ Greek × OI × multiplier.</p>
          <p><strong>Key Levels:</strong> Call/Put OI Wall được tính riêng từ OI lớn nhất của từng phía. CW là strike có Net GEX dương lớn nhất; PW là strike có Net GEX âm lớn nhất theo trị tuyệt đối. Net GEX theo strike được tự tính từ Gamma provider hoặc Gamma BSM suy ra từ IV nếu provider bỏ trống. GEX 1–10 xếp các strike còn lại theo |Net GEX| sau khi loại CW, PW, Call/Put OI Wall, Max Pain và Gamma Flip nếu trùng strike. GEX Ratio = tổng Call GEX / |tổng Put GEX|. Ratio > 1: Call Gamma trội, thiên hướng ổn định và biên độ hẹp; ratio < 1: Put Gamma trội, rủi ro biến động mạnh và trượt giá cao. Đây là heuristic theo quy ước Call+/Put−, không xác nhận dealer positioning.</p>
          <p><strong>Gamma Flip / Zero Gamma:</strong> Giữ OI, IV và DTE cố định; giả định giá underlying tại từng mức, tính lại Gamma từng hợp đồng bằng Black–Scholes, sau đó tổng hợp Net GEX = Σ(Call +, Put −) × OI × multiplier × giá giả định² × 0.01. Gamma Flip / Zero Gamma là nghiệm làm tổng Net GEX đổi dấu. Mô hình dùng r = 0, q = 0, đáo hạn lúc 16:00 America/New_York và nội suy/bisection quanh điểm đổi dấu. Đây là mô hình ước lượng theo quy ước Call+/Put−, không phải vị thế dealer đã xác minh. Cần OI, multiplier, IV và expiry đầy đủ.</p>
          <p><strong>Max Pain:</strong> với mỗi giá settlement ứng viên K, tính Σ[Call OI × multiplier × max(K − strike, 0)] + Σ[Put OI × multiplier × max(strike − K, 0)] trên toàn bộ hợp đồng của đúng expiry. Chọn settlement có tổng payout thấp nhất. Nếu nhiều strike cùng mức thấp nhất, QuantLab hiển thị strike đại diện thấp nhất và công bố toàn bộ các strike đồng hạng. Chỉ tính khi Option Chain hoàn tất; OI null trên quote đã nhận được giả định bằng 0, và mọi contract có OI dương phải có multiplier hợp lệ. Không cộng volume hoặc premium vào Max Pain.</p>
          <p><strong>Spot reference:</strong> Binance Equity WebSocket <code>${cfg.assetCode}@symbol_price</code> được dùng làm giá tham chiếu cho KPI, Exposure và các Key Levels.</p>
          <p><strong>Giả định dữ liệu:</strong> Khi OCC quote đã nhận đầy đủ nhưng Binance trả OI hoặc Volume là <code>null</code>, QuantLab giả định giá trị 0 cho đến khi có số liệu thực. Giá trị thô vẫn được giữ để phân biệt observed zero và assumed zero; khi Binance gửi OI/Volume thực, các tổng OI, GEX, GEX Ratio, Gamma Flip và Max Pain tự tính lại. OCC quote hoàn toàn chưa nhận được vẫn không bị giả định bằng 0. Endpoint quote có thể trả dữ liệu trễ; độ trễ phụ thuộc quyền dữ liệu tài khoản.</p>
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
        displayStrikes:readDisplayStrikes(cfg.key), chainComplete:false, hydrating:false, hydrateProgress:0, loadedExpiry:null, quotesExpiry:null, lastHydrationMissingSymbols:[], lastHydrationIncompleteSymbols:[], chainListInvalidCount:0,chainListDuplicateCount:0,contractMeta:new Map()
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
  function firstNumber(...values){
    for(const value of values){if(value===null||value===undefined||value==='')continue;const n=num(value);if(n!==null)return n;}
    return null;
  }
  function normaliseQuote(q){
    const packs=[q,q?.quote,q?.optionQuote,q?.option,q?.data,q?.ticker,q?.greeks].filter(x=>x&&typeof x==='object');
    const pick=(...keys)=>firstNumber(...packs.flatMap(pack=>keys.map(key=>pack[key])));
    const pickText=(...keys)=>{
      for(const pack of packs)for(const key of keys){const value=pack[key];if(value!==null&&value!==undefined&&String(value).trim()!=='')return String(value).trim();}
      return '';
    };
    const optionSymbol=pickText('os','optionSymbol','symbol','s');
    const rawSide=pickText('t','contractType','side','optionType').toLowerCase();
    const occSide=(optionSymbol.match(/[0-9]([cp])[0-9]+$/i)||[])[1]?.toUpperCase();
    const side=rawSide.includes('put')||rawSide==='p'?'P':rawSide.includes('call')||rawSide==='c'?'C':occSide==='P'?'P':occSide==='C'?'C':null;
    const oiParsed=pick('oi','openInterest','open_interest','openInterestQty','open_interest_qty','openInterestQuantity');
    const oi=oiParsed!==null&&oiParsed>=0?oiParsed:null;
    const multiplier=pick('m','multiplier','contractMultiplier','contract_multiplier','contractSize','contract_size');
    return {
      optionSymbol, name:pickText('n','name')||optionSymbol, side,
      expiration:pick('e','expiration','expiry'), strike:pick('sp','strikePrice','strike','k')??occStrike(optionSymbol),
      multiplier:multiplier!==null&&multiplier>0?multiplier:null,
      last:pick('p','l','lastPrice','last'), bid:pick('bp','bid'), ask:pick('ap','ask'), mid:pick('mp','mid'),
      volume:pick('v','volume'), openInterest:oi,
      iv:pick('iv','impliedVolatility','impliedVol','markIV','markIv','mark_iv','bidIV','askIV'),
      delta:pick('de','delta'), gamma:pick('ga','gamma'), theta:pick('th','theta'), vega:pick('ve','vega'),
      breakEven:pick('be','breakEven'), previousClose:pick('pcp','previousClose'), bidSize:pick('bs','bidSize'), askSize:pick('as','askSize'),
    };
  }
  function quoteRowsFromReply(reply){
    const isQuote=x=>x&&typeof x==='object'&&!Array.isArray(x)&&(x.os||x.optionSymbol||x.symbol||x.s);
    const queue=[{value:reply,depth:0}],seen=new Set();
    while(queue.length){
      const {value,depth}=queue.shift();
      if(!value||typeof value!=='object'||seen.has(value)||depth>6)continue;
      seen.add(value);
      if(Array.isArray(value)){
        const rows=value.filter(isQuote);
        if(rows.length)return rows;
        for(const child of value)if(child&&typeof child==='object')queue.push({value:child,depth:depth+1});
        continue;
      }
      const entries=Object.entries(value);
      const keyed=entries.filter(([key,child])=>/^(QQQ|GLD)/i.test(key)&&child&&typeof child==='object'&&!Array.isArray(child));
      if(keyed.length===entries.length&&keyed.length)return keyed.map(([os,child])=>({os,...child}));
      for(const [,child] of entries)if(child&&typeof child==='object')queue.push({value:child,depth:depth+1});
    }
    return [];
  }
  function mergeQuoteSnapshot(previous,incoming){
    if(!previous)return incoming;
    const merged={...previous,...incoming};
    // Binance may omit slowly changing fields in a refresh or send them as null.
    // Preserve the last valid OI/IV/multiplier/Greek rather than erasing analytics.
    for(const field of ['openInterest','multiplier','iv','gamma','delta','theta','vega','strike','side','expiration']){
      if(incoming[field]===null||incoming[field]===undefined){
        if(previous[field]!==null&&previous[field]!==undefined)merged[field]=previous[field];
      }
    }
    return merged;
  }
  function effectiveMultiplier(q){
    const explicit=num(q?.multiplier);
    if(explicit!==null&&explicit>0)return {value:explicit,source:'binance'};
    // Standard QQQ/GLD OCC roots represent the regular 100-share ETF contract.
    // Adjusted OCC roots (e.g. QQQ1) deliberately do not use this fallback.
    const symbol=String(q?.optionSymbol||'').toUpperCase();
    if(/^(QQQ|GLD)\d{6}[CP]\d{8}$/.test(symbol))return {value:100,source:'standard-100-assumption'};
    return {value:null,source:'missing'};
  }
  function quoteNeedsAnalyticsRetry(s,symbol){
    const q=s.quotes.get(symbol);
    if(!q)return true;
    // A received OCC quote with null OI is zero-filled for analytics, not retried forever.
    // If a later Binance update reports a real OI, mergeQuoteSnapshot replaces the null.
    if(q.openInterest===null||q.openInterest===undefined||!Number.isFinite(q.openInterest)||q.openInterest<0)return false;
    if(q.openInterest===0)return false;
    if(effectiveMultiplier(q).value===null)return true;
    // Gamma from the quote feed is enough for current-spot GEX, but Zero Gamma
    // reprices every contract over hypothetical spots and therefore requires IV
    // even when the provider supplied a current Gamma value.
    const sigma=ivSigma(q.iv);
    return sigma===null;
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
    const requested=[...new Set((symbols||[]).filter(Boolean))];
    let pending=requested.slice(),receivedCount=0,lastError='';
    for(let attempt=0;attempt<3&&pending.length;attempt++){
      const batchSize=attempt===0?100:Math.min(50,Math.max(1,pending.length));
      const batches=[];for(let i=0;i<pending.length;i+=batchSize)batches.push(pending.slice(i,i+batchSize));
      let next=0;const returnedThisRound=new Set();
      async function worker(){
        while(next<batches.length){
          const batch=batches[next++];
          try{
            const reply=await request('/bapi/equity/v1/friendly/equity/option/get-option-quote','POST',{occSymbols:batch});
            if(token!==s.chainLoadToken||expiry!==s.expiry)return;
            const received=quoteRowsFromReply(reply).map(normaliseQuote).filter(q=>q.optionSymbol);
            for(const q of received){
              if(!s.contractSymbols?.has(q.optionSymbol)||!batch.includes(q.optionSymbol))continue;
              returnedThisRound.add(q.optionSymbol);
              const meta=s.contractMeta?.get(q.optionSymbol);
              const enriched=meta?mergeQuoteSnapshot(meta,q):q;
              const old=s.quotes.get(q.optionSymbol);
              s.quotes.set(q.optionSymbol,mergeQuoteSnapshot(old,enriched));
            }
            s.hydrateProgress=Math.min(requested.length,s.hydrateProgress+batch.length);
            s.oiLastUpdate=Date.now();
            if(s.hydrating)updateChainMeta(s);
          }catch(error){lastError=error?.message||String(error);}
        }
      }
      await Promise.all(Array.from({length:Math.min(Math.max(1,concurrency),batches.length||1)},worker));
      if(token!==s.chainLoadToken||expiry!==s.expiry)return {requested:requested.length,received:receivedCount,missing:pending.slice(),error:lastError};
      receivedCount+=returnedThisRound.size;
      pending=pending.filter(symbol=>quoteNeedsAnalyticsRetry(s,symbol));
      // Retry contracts whose quote exists but whose full-expiry analytics
      // fields are still absent: OI, multiplier for positive OI, or IV for
      // Zero Gamma repricing. GEX itself can use provider Gamma or BSM from IV.
      if(pending.length&&attempt<2)await new Promise(resolve=>setTimeout(resolve,350*(attempt+1)));
    }
    return {requested:requested.length,received:requested.length-pending.length,missing:pending,error:lastError};
  }
  async function hydrateRemainingQuotes(s, symbols, token, expiry){
    const expected=s.contractSymbols?.size||s.contracts.length||0;
    if(!symbols.length){
      const allQuotesPresent=s.contractSymbols?Array.from(s.contractSymbols).every(symbol=>s.quotes.has(symbol)):s.quotes.size>=expected;
      const incomplete=s.contractSymbols?Array.from(s.contractSymbols).filter(symbol=>quoteNeedsAnalyticsRetry(s,symbol)):[];
      s.chainComplete=allQuotesPresent;s.hydrating=false;s.loadedExpiry=allQuotesPresent?expiry:null;
      s.lastHydrationMissingSymbols=[];s.lastHydrationIncompleteSymbols=incomplete;renderAll(s);
      setStatus(s,allQuotesPresent?(incomplete.length?`Full quotes loaded · ${incomplete.length} contracts thiếu OI/analytics`:`Loaded full chain · ${s.quotes.size}/${expected} contracts`):`Chain còn thiếu quote · ${s.quotes.size}/${expected}`,allQuotesPresent&&!incomplete.length?'ok':'warn');
      return;
    }
    s.hydrating=true;
    try{
      const result=await fetchQuoteBatches(s,symbols,token,expiry,2);
      if(token!==s.chainLoadToken||expiry!==s.expiry)return;
      const missing=s.contractSymbols?Array.from(s.contractSymbols).filter(symbol=>!s.quotes.has(symbol)):[];
      const incomplete=s.contractSymbols?Array.from(s.contractSymbols).filter(symbol=>quoteNeedsAnalyticsRetry(s,symbol)):[];
      const allQuotesPresent=missing.length===0&&s.quotes.size>=expected;
      s.lastHydrationMissingSymbols=missing.slice();s.lastHydrationIncompleteSymbols=incomplete.slice();
      s.chainComplete=allQuotesPresent;s.loadedExpiry=allQuotesPresent?expiry:null;
      s.hydrating=false;s.crossAssetError='';
      renderAll(s);
      const detail=[missing.length?`thiếu ${missing.length} OCC quote`:null,incomplete.length?`${incomplete.length} contract OI > 0 thiếu multiplier/IV`:null,result.error||null].filter(Boolean).join(' · ');
      setStatus(s,allQuotesPresent?(incomplete.length?`Full quotes · analytics thiếu ${incomplete.length}/${expected} · ${detail}`:`Loaded full chain · ${s.quotes.size}/${expected} contracts`):`Chain quote chưa đầy đủ · ${s.quotes.size}/${expected} · ${detail}`,allQuotesPresent&&!incomplete.length?'ok':'warn');
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
    const sameExpiry=s.quotesExpiry===expiry&&s.quotes.size>0;
    const previousQuotes=sameExpiry?new Map(s.quotes):new Map();
    const keepCompleteSnapshot=!!(refreshAll&&sameExpiry);
    s.hydrating=keepCompleteSnapshot;s.chainComplete=keepCompleteSnapshot;s.hydrateProgress=0;
    setStatus(s,'Đang lấy Option Chain…','loading');
    if(!s.quotes.size)$(`so-${cfg.key}-chain`).innerHTML='<tr><td colspan="19" class="opt-empty">Đang lấy danh sách OCC contracts…</td></tr>';
    const chain=await request(`/bapi/equity/v1/public/equity/option/chain-symbols?${new URLSearchParams({symbol:cfg.symbol,rootSymbol:root,expirationDate:expiry})}`);
    if(token!==s.chainLoadToken||expiry!==s.expiry)return;
    const list=chain.data?.l||[];
    if(!list.length)throw new Error(`Binance không trả contract cho ${cfg.symbol} expiry ${expiry}.`);
    const byOcc=new Map();let invalidRows=0,duplicateRows=0;
    for(const item of list){
      const symbol=String(item?.os??item?.optionSymbol??'').trim();
      if(!symbol){invalidRows++;continue;}
      if(byOcc.has(symbol)){duplicateRows++;continue;}
      byOcc.set(symbol,{...item,os:symbol});
    }
    const canonical=[...byOcc.values()];
    const symbols=canonical.map(x=>x.os);
    if(!symbols.length)throw new Error(`Binance trả ${list.length} dòng nhưng không có OCC symbol hợp lệ cho ${cfg.symbol} ${expiry}.`);
    s.chainListInvalidCount=invalidRows;s.chainListDuplicateCount=duplicateRows;
    s.contractMeta=new Map(canonical.map(item=>[item.os,normaliseQuote(item)]));
    s.contracts=canonical;
    s.contractSymbols=new Set(symbols);
    s.quotesExpiry=expiry;
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
    const priority=visibleSymbols.filter(x=>!already.has(x)||quoteNeedsAnalyticsRetry(s,x));
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
    const incomplete=symbols.filter(x=>quoteNeedsAnalyticsRetry(s,x));
    s.hydrateProgress=symbols.length-missing.length;
    s.hydrating=missing.length>0||incomplete.length>0;
    s.chainComplete=missing.length===0;
    renderAll(s);updateChainMeta(s);syncOptionStream(s);
    if(missing.length||incomplete.length){
      setStatus(s,`Đã hiển thị ${s.displayStrikes==='all'?'tất cả':s.displayStrikes} strikes · đang hoàn thiện dữ liệu (${s.quotes.size}/${symbols.length} quotes, ${incomplete.length} contract OI > 0 thiếu multiplier/IV)`,'loading');
      // Full-chain analytics are hydrated in the background; first paint only requests visible ATM strikes.
      hydrateRemainingQuotes(s,[...new Set([...missing,...incomplete])],token,expiry);
    }else{
      s.loadedExpiry=expiry;s.lastHydrationMissingSymbols=[];setStatus(s,`Loaded · ${s.quotes.size}/${symbols.length} option quotes`,'ok');
    }
  }

  function mergeLiveQuote(s, raw){
    const arr=Array.isArray(raw)?raw:[raw];
    const sourceKeys={name:['n','name'],side:['t','contractType','side','optionType'],expiration:['e','expiration','expiry'],strike:['sp','strikePrice','strike','k'],multiplier:['m','multiplier','contractMultiplier','contract_multiplier','contractSize','contract_size'],last:['p','l','lastPrice','last'],bid:['bp','bid'],ask:['ap','ask'],mid:['mp','mid'],volume:['v','volume'],openInterest:['oi','openInterest','open_interest','openInterestQty','open_interest_qty','openInterestQuantity'],iv:['iv','impliedVolatility','impliedVol','markIV','markIv','mark_iv','bidIV','askIV'],delta:['de','delta','greeks'],gamma:['ga','gamma','greeks'],theta:['th','theta','greeks'],vega:['ve','vega','greeks'],breakEven:['be','breakEven'],previousClose:['pcp','previousClose'],bidSize:['bs','bidSize'],askSize:['as','askSize']};
    let changed=false;
    for(const item of arr){
      if(!item || !(item.os||item.optionSymbol))continue;
      const q=normaliseQuote(item);
      if(s.contractSymbols?.size && !s.contractSymbols.has(q.optionSymbol))continue;
      const old=s.quotes.get(q.optionSymbol)||{...q,openInterest:null,volume:null,iv:null,delta:null,gamma:null,theta:null,vega:null,bid:null,ask:null,mid:null,last:null,multiplier:null,bidSize:null,askSize:null};
      const incoming={optionSymbol:q.optionSymbol};
      const sourcePacks=[item,item.quote,item.optionQuote,item.data,item.greeks].filter(x=>x&&typeof x==='object');
      for(const [field,keys] of Object.entries(sourceKeys)){
        if(sourcePacks.some(pack=>keys.some(k=>Object.prototype.hasOwnProperty.call(pack,k))))incoming[field]=q[field];
      }
      if(!old.side&&q.side)incoming.side=q.side;
      if(!old.name&&q.name)incoming.name=q.name;
      const next=mergeQuoteSnapshot(old,incoming);
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
    // No positive OI means there is no payout distribution and no meaningful
    // Max Pain. Do not label an arbitrary lowest strike as the result.
    const totalOpenInterestWeight=rows.reduce((sum,x)=>sum+x.callPainOI+x.putPainOI,0);
    if(!(totalOpenInterestWeight>0))return null;
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
  // Binance may omit per-contract Gamma even while IV, OI and contract size are
  // present. Derive the missing Greek from IV and time-to-expiry instead of
  // suppressing every GEX-derived level for the expiry.
  function resolveGamma(q,spot,time){
    const provider=num(q.gamma);
    // Vanilla-option Gamma is non-negative for both Calls and Puts; direction
    // is applied later from the option side, so normalize signed feeds here.
    // A literal zero from a quote is treated as unavailable (or rounded underflow)
    // and is derived from IV when possible.
    if(provider!==null&&Math.abs(provider)>0)return {gamma:Math.abs(provider),source:'provider'};
    const sigma=ivSigma(q.iv);
    const derived=spot>0&&time!==null&&sigma!==null?bsmGamma(spot,q.strike,time,sigma):null;
    return derived!==null?{gamma:derived,source:'bsm-iv'}:{gamma:null,source:'missing'};
  }
  function gammaFlipInputKey(rows){
    return rows.map(q=>[q.optionSymbol||'',q.strike??'',q.side||'',q.openInterest??'',q.multiplier??'',q.iv??''].join(':')).join('|');
  }
  function gammaFlipOf(rows,spot,expiry,now=Date.now()){
    const time=yearsToExpiry(expiry,now);
    if(time===null)return {level:null,complete:false,reason:'Thiếu DTE hợp lệ',coverage:0};
    const valid=rows.filter(q=>Number.isFinite(q.strike)&&q.strike>0&&(q.side==='C'||q.side==='P'));
    const invalidCount=rows.length-valid.length;
    // Received contracts with null OI are treated as zero until Binance reports a value.
    // Zero-OI contracts do not contribute to repriced Net GEX and need no IV/multiplier.
    const invalidOI=valid.filter(q=>q.openInterest!==null&&q.openInterest!==undefined&&(!Number.isFinite(q.openInterest)||q.openInterest<0));
    const active=valid.filter(q=>Number.isFinite(q.openInterest)&&q.openInterest>0);
    const eligible=active.filter(q=>effectiveMultiplier(q).value!==null&&ivSigma(q.iv)!==null);
    const coverage=active.length?eligible.length/active.length:1;
    if(!valid.length||invalidCount>0||invalidOI.length>0||eligible.length!==active.length)return {level:null,crosses:[],complete:false,reason:'Contract OI > 0 cần multiplier hợp lệ (Binance hoặc standard 100-share OCC) và IV hợp lệ; OI null được giả định 0',coverage};
    if(!eligible.length)return {level:null,crosses:[],complete:true,reason:'Không có contract OI dương để tính Zero Gamma',coverage};
    const netAt=price=>{
      let total=0;
      for(const q of eligible){
        const g=bsmGamma(price,q.strike,time,ivSigma(q.iv));
        if(g===null)return null;
        const multiplier=effectiveMultiplier(q).value;
        if(multiplier===null)return null;
        const value=g*q.openInterest*multiplier*price*price*.01;
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
    const time=yearsToExpiry(s.expiry,now);
    let callOI=0,putOI=0,oiKnown=0,oiMissing=0,oiAssumedZero=0,volumeKnown=0,volumeAssumedZero=0,ivKnown=0,ivMissing=0,multiplierMissing=0,multiplierAssumed=0,multiplierKnown=0,maxPainMultiplierMissing=0,callVol=0,putVol=0;
    let invalidContractCount=0;
    const oiMissingSamples=[],missingIVSamples=[],missingMultiplierSamples=[],missingGreekSamples=[];
    const per=new Map();let delta=spot!==null?0:null,gamma=spot!==null?0:null,vega=0,theta=0;
    let gexKnown=0,gexMissing=0,gammaProviderKnown=0,gammaDerivedKnown=0;
    for(const q of rows){
      const side=q.side==='P'?'P':q.side==='C'?'C':null;
      if(!Number.isFinite(q.strike)||q.strike<=0||!side){
        invalidContractCount++;oiMissing++;gexMissing++;
        if(oiMissingSamples.length<5)oiMissingSamples.push(q.optionSymbol||'(unknown OCC)');
        continue;
      }
      const p=per.get(strikeKey(q.strike))||{strike:q.strike,gex:0,dex:0,vgex:0,thex:0,callOI:0,putOI:0,callVol:0,putVol:0,callGex:0,putGex:0,callDex:0,putDex:0,callVgex:0,putVgex:0,callThex:0,putThex:0,callPainOI:0,putPainOI:0,gammaProviderKnown:0,gammaDerivedKnown:0};
      const volumeValid=q.volume!==null&&q.volume!==undefined&&Number.isFinite(q.volume)&&q.volume>=0;
      const volume=volumeValid?q.volume:0;
      if(volumeValid)volumeKnown++;else volumeAssumedZero++;
      if(side==='C'){callVol+=volume;p.callVol+=volume;}else{putVol+=volume;p.putVol+=volume;}
      per.set(strikeKey(q.strike),p);
      const oiValid=q.openInterest!==null&&q.openInterest!==undefined&&Number.isFinite(q.openInterest)&&q.openInterest>=0;
      const oi=oiValid?q.openInterest:0;
      if(oiValid)oiKnown++;
      else {oiMissing++;oiAssumedZero++;if(oiMissingSamples.length<5)oiMissingSamples.push(q.optionSymbol||strikeKey(q.strike));}
      const mi=effectiveMultiplier(q),m=mi.value;
      if(side==='C'){callOI+=oi;p.callOI+=oi;}else{putOI+=oi;p.putOI+=oi;}
      if(oi>0&&m===null){maxPainMultiplierMissing++;multiplierMissing++;gexMissing++;if(missingMultiplierSamples.length<5)missingMultiplierSamples.push(q.optionSymbol||strikeKey(q.strike));}
      else if(oi>0){multiplierKnown++;if(mi.source==='standard-100-assumption')multiplierAssumed++;}
      if(oi===0){if(side==='C')p.callPainOI+=0;else p.putPainOI+=0;gexKnown++;continue;}
      if(m!==null){if(side==='C')p.callPainOI+=oi*m;else p.putPainOI+=oi*m;}
      if(ivSigma(q.iv)!==null)ivKnown++;
      else if(missingIVSamples.length<5)missingIVSamples.push(q.optionSymbol||strikeKey(q.strike));
      if(ivSigma(q.iv)===null)ivMissing++;
      if(m===null)continue;
      if(spot!==null){
        const resolved=resolveGamma(q,spot,time);
        if(resolved.gamma!==null){
          const raw=resolved.gamma*oi*m*spot*spot*.01;
          const v=side==='P'?-raw:raw;
          p.gex+=v;
          if(side==='C')p.callGex+=Math.abs(raw);else p.putGex-=Math.abs(raw);
          gamma+=v;gexKnown++;
          if(resolved.source==='provider'){gammaProviderKnown++;p.gammaProviderKnown++;}
          else{gammaDerivedKnown++;p.gammaDerivedKnown++;}
        }else{
          gexMissing++;
          if(missingGreekSamples.length<5)missingGreekSamples.push(q.optionSymbol||strikeKey(q.strike));
        }
      }else{gexMissing++;}
      if(spot!==null&&q.delta!=null&&Number.isFinite(q.delta)){const raw=q.delta*oi*m*spot;p.dex+=raw;if(side==='C')p.callDex+=Math.abs(raw);else p.putDex+=Math.abs(raw);delta+=raw;}
      if(q.vega!=null&&Number.isFinite(q.vega)){const raw=q.vega*oi*m;p.vgex+=raw;if(side==='C')p.callVgex+=Math.abs(raw);else p.putVgex+=Math.abs(raw);vega+=raw;}
      if(q.theta!=null&&Number.isFinite(q.theta)){const raw=q.theta*oi*m;p.thex+=raw;if(side==='C')p.callThex+=Math.abs(raw);else p.putThex+=Math.abs(raw);theta+=raw;}
    }
    const dist=[...per.values()].sort((a,b)=>a.strike-b.strike);
    const calls=dist.filter(x=>x.callOI>0).sort((a,b)=>b.callOI-a.callOI);
    const puts=dist.filter(x=>x.putOI>0).sort((a,b)=>b.putOI-a.putOI);
    const expectedSymbols=s.contractSymbols instanceof Set?[...s.contractSymbols]:[];
    const missingQuoteSymbols=expectedSymbols.filter(symbol=>!s.quotes.has(symbol));
    const totalContracts=Math.max(expectedSymbols.length,s.contracts.length||0,rows.length);
    oiMissing+=missingQuoteSymbols.length;gexMissing+=missingQuoteSymbols.length;
    const complete=!!s.chainComplete&&missingQuoteSymbols.length===0&&(s.chainListInvalidCount||0)===0&&rows.length>=Math.min(totalContracts,expectedSymbols.length||totalContracts);
    // Null OI on a received contract is assumed zero; full-chain completeness is based on OCC quote coverage.
    const oiComplete=complete&&invalidContractCount===0;
    const gexAvailable=gexKnown>0&&spot!==null;
    const gexComplete=complete&&gexMissing===0&&spot!==null&&totalContracts>0;
    const gexProvisional=gexAvailable&&!gexComplete;
    const maxPainComplete=oiComplete&&maxPainMultiplierMissing===0;
    const maxPain=maxPainComplete?maxPainOf(dist):null;
    const maxPainReason=!complete?`Đang thiếu ${missingQuoteSymbols.length} quote OCC`:
      !oiComplete?`Có contract OCC không hợp lệ`:
      maxPainMultiplierMissing>0?`Thiếu multiplier ở ${maxPainMultiplierMissing} contract OI > 0`:
      !maxPain?'Expiry không có OI dương để xác định Max Pain':'Max Pain tính từ toàn bộ expiry';
    const validOI=oiKnown,coverage=totalContracts?validOI/totalContracts:0;
    const oiAnalyticsCoverage=totalContracts?(oiKnown+oiAssumedZero)/totalContracts:0;
    const gexCoverage=totalContracts?gexKnown/totalContracts:0;
    const multiplierCoverage=oiKnown?multiplierKnown/Math.max(1,oiKnown-rows.filter(q=>q.openInterest===0).length):0;
    // OI walls are strictly OI-ranked; GEX walls are independently ranked from signed Net GEX.
    const callOIWall=calls[0]||null,putOIWall=puts[0]||null;
    const positiveGex=gexAvailable?dist.filter(x=>Number.isFinite(x.gex)&&x.gex>0).slice().sort((a,b)=>b.gex-a.gex):[];
    const negativeGex=gexAvailable?dist.filter(x=>Number.isFinite(x.gex)&&x.gex<0).slice().sort((a,b)=>a.gex-b.gex):[];
    const gexCallWall=positiveGex[0]||null;
    const gexPutWall=negativeGex[0]||null;
    // Reprice Zero Gamma from all positive-OI contracts using IV, independent of provider Gamma.
    const flipCacheKey=[s.expiry||'',gammaFlipInputKey(rows),rows.length,Math.floor(now/60000)].join('|');
    let flipCalc=s._gammaFlipCache?.key===flipCacheKey?s._gammaFlipCache.value:null;
    if(!flipCalc){flipCalc=complete?gammaFlipOf(rows,spot,s.expiry,now):{level:null,crosses:[],complete:false,reason:'Full Option Chain chưa tải xong',coverage:0};try{s._gammaFlipCache={key:flipCacheKey,value:flipCalc}}catch{}}
    const gammaFlip=spot>0&&flipCalc.crosses?.length?flipCalc.crosses.slice().sort((a,b)=>Math.abs(a-spot)-Math.abs(b-spot))[0]:null;
    // GEX 1–10 is the next ten distinct strikes after excluding every plotted
    // price level: OI Walls, GEX CW/PW, Max Pain (including tied minima), and
    // Gamma Flip if it lands exactly on an option strike.
    const gexLadderExcludedLevels=collectGexLadderExclusions({callOIWall,putOIWall,gexCallWall,gexPutWall,maxPain,gammaFlip});
    const gexRankedCandidates=gexAvailable?dist.filter(x=>Number.isFinite(x.gex)&&Math.abs(x.gex)>0)
      .slice().sort((a,b)=>Math.abs(b.gex)-Math.abs(a.gex)):[];
    const gexLevels=gexRankedCandidates.filter(x=>!isExcludedGexStrike(x.strike,gexLadderExcludedLevels))
      .slice(0,10).map((x,i)=>({...x,rank:i+1}));
    const callGexTotal=gexAvailable?dist.reduce((sum,x)=>sum+Math.max(0,x.callGex||0),0):null;
    const putGexTotal=gexAvailable?dist.reduce((sum,x)=>sum+(x.putGex||0),0):null;
    const putGexAbsTotal=putGexTotal===null?null:Math.abs(putGexTotal);
    const gexRatio=gexAvailable&&putGexAbsTotal>0?callGexTotal/putGexAbsTotal:null;
    const gexRatioState=!gexAvailable?'unavailable':gexProvisional?'provisional':putGexAbsTotal===0?(callGexTotal>0?'call-only':'no-gex'):'ready';
    const gexRatioBias=gexRatioState==='call-only'?'call-dominant':gexRatioState==='no-gex'?'balanced':gexRatio===null?null:gexRatio>1?'call-dominant':gexRatio<1?'put-dominant':'balanced';
    const oiMissingQuotes=missingQuoteSymbols.length;
    return {rows,dist,callOI,putOI,oiKnown,oiMissing,oiAssumedZero,volumeKnown,volumeAssumedZero,multiplierMissing,multiplierKnown,multiplierAssumed,multiplierCoverage,maxPainMultiplierMissing,invalidContractCount,missingQuoteSymbols,oiMissingSamples,missingMultiplierSamples,missingGreekSamples,totalContracts,callVol,putVol,volume:callVol+putVol,delta,gamma,vega,theta,
      callOIWall,putOIWall,gexCallWall,gexPutWall,
      gammaFlip,gammaFlipComplete:flipCalc.complete&&spot>0,gammaFlipReason:spot>0?flipCalc.reason:'Chờ Spot underlying để chọn Gamma Flip gần nhất',gammaFlipCoverage:flipCalc.coverage,
      callGexTotal,putGexTotal,putGexAbsTotal,gexRatio,gexRatioState,gexRatioBias,
      gexRankedCandidates,gexLadderExcludedLevels,gexLevels,maxPain,maxPainReason,
      complete,oiComplete,gexAvailable,gexComplete,gexProvisional,gexKnown,gexMissing,gammaProviderKnown,gammaDerivedKnown,gexCoverage,maxPainComplete,coverage,oiAnalyticsCoverage,
      ivKnown,ivMissing,missingIVSamples,ivCoverage:ivKnown+ivMissing?ivKnown/(ivKnown+ivMissing):0,
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
      metric(compact(c.callOI),'CALL OI',`${c.rows.filter(x=>x.side==='C'&&x.openInterest!=null).length} observed · null→0 ${c.rows.filter(x=>x.side==='C'&&x.openInterest==null).length}`),
      metric(compact(c.putOI),'PUT OI',`${c.rows.filter(x=>x.side==='P'&&x.openInterest!=null).length} observed · null→0 ${c.rows.filter(x=>x.side==='P'&&x.openInterest==null).length}`),
      metric(compact(c.volume),'TOTAL VOLUME',`Call ${compact(c.callVol)} · Put ${compact(c.putVol)} · null→0 ${c.volumeAssumedZero}`),
      metric((c.coverage*100).toFixed(1)+'%','OI OBSERVED',`${c.oiKnown} observed · ${c.oiAssumedZero} null → 0`, '')
    ].join('');
  }
  function renderLevels(s){
    const c=calc(s),el=$(`so-${s.cfg.key}-levels`);if(!el)return;
    const pending=!c.complete;
    const cards=[
      {key:'call',label:'CALL OI WALL',tag:'OI · CALL',value:c.callOIWall?fmt(c.callOIWall.strike,2):'—',meta:c.callOIWall?`Call OI · ${compact(c.callOIWall.callOI)}${c.oiComplete?'':' · provisional'}${c.oiAssumedZero?` · ${c.oiAssumedZero} null→0`:''}`:'Chưa có Call OI'},
      {key:'put',label:'PUT OI WALL',tag:'OI · PUT',value:c.putOIWall?fmt(c.putOIWall.strike,2):'—',meta:c.putOIWall?`Put OI · ${compact(c.putOIWall.putOI)}${c.oiComplete?'':' · provisional'}${c.oiAssumedZero?` · ${c.oiAssumedZero} null→0`:''}`:'Chưa có Put OI'},
      {key:'gex-call',label:'CW · GEX CALL WALL',tag:'MAX +NET GEX',value:c.gexCallWall?fmt(c.gexCallWall.strike,2):'—',meta:c.gexCallWall?`Net GEX +${compact(c.gexCallWall.gex)}${c.gexComplete?'':' · provisional'}`:c.gexAvailable?'Không có Net GEX dương':'Cần OI + multiplier và Gamma provider hoặc IV + DTE'},
      {key:'gex-put',label:'PW · GEX PUT WALL',tag:'MAX |−NET GEX|',value:c.gexPutWall?fmt(c.gexPutWall.strike,2):'—',meta:c.gexPutWall?`Net GEX −${compact(Math.abs(c.gexPutWall.gex))}${c.gexComplete?'':' · provisional'}`:c.gexAvailable?'Không có Net GEX âm':'Cần OI + multiplier và Gamma provider hoặc IV + DTE'},
      {key:'gamma-flip',label:'GAMMA FLIP / ZERO GAMMA',tag:'BSM · NET GEX ZERO-CROSS',value:c.gammaFlip===null?'—':fmt(c.gammaFlip,2),meta:c.gammaFlip!==null?`Mức Net GEX đổi dấu khi repricing underlying${c.oiAssumedZero?` · ${c.oiAssumedZero} OI null→0`:''}`:(c.multiplierMissing?`Thiếu multiplier ở ${c.multiplierMissing} contract`:c.ivMissing?`Thiếu IV ở ${c.ivMissing} contracts OI > 0`:c.gammaFlipReason||'Cần IV và DTE hợp lệ')},
      {key:'pain',label:'MAX PAIN',tag:'EXPIRY',value:c.maxPain?fmt(c.maxPain.strike,2):'—',meta:c.maxPain?`Payout · ${compact(c.maxPain.payout)}${c.maxPain.isTie?` · đồng hạng: ${c.maxPain.tiedStrikes.map(x=>fmt(x,2)).join(' / ')}`:''}${c.oiAssumedZero?` · ${c.oiAssumedZero} OI null→0`:''}`:c.maxPainReason},
      {key:'gex-ratio',label:'GEX RATIO',tag:'CALL GEX / |PUT GEX|',value:c.gexRatioState==='call-only'?'∞':c.gexRatio===null?'—':`${c.gexProvisional?'~':''}${c.gexRatio.toFixed(2)}x`,meta:c.gexRatioBias==='call-dominant'?'Call Gamma trội · xu hướng ổn định, biên độ hẹp':c.gexRatioBias==='put-dominant'?'Put Gamma trội · rủi ro biến động và trượt giá cao':c.gexRatioBias==='balanced'?'Call/Put Gamma tương đối cân bằng':c.gexRatioState==='no-gex'?'Không có GEX hợp lệ':c.gexRatioState==='provisional'?'Tạm tính · đang tải phần còn lại':'Chưa có Gamma hoặc IV hợp lệ'}
    ];
    const status=!c.complete?'<span class="kl-status is-loading">Đang tải full chain</span>':!c.oiComplete?'<span class="kl-status is-loading">Có OCC contract không hợp lệ</span>':c.gexProvisional?'<span class="kl-status is-loading">GEX tạm tính · thiếu Gamma/IV/multiplier</span>':c.gexComplete&&c.ivMissing>0?`<span class="kl-status is-loading">GEX & Max Pain sẵn sàng · Zero Gamma thiếu IV (${c.ivMissing})</span>`:c.gexComplete?`<span class="kl-status">Full analytics loaded${c.oiAssumedZero?` · ${c.oiAssumedZero} OI null→0`:''}</span>`:'<span class="kl-status">Quotes/OI loaded · GEX unavailable</span>';
    const cardsHtml=cards.map(x=>`<article class="kl-card kl-${x.key}"><div class="kl-card-top"><span class="kl-label">${x.label}</span><span class="kl-tag">${x.tag}</span></div><strong class="kl-value">${esc(x.value)}</strong><span class="kl-meta">${esc(x.meta)}</span></article>`).join('');
    const maxGex=Math.max(1,...c.gexLevels.map(x=>Math.abs(x.gex)));
    const gexHtml=c.gexLevels.length?c.gexLevels.map((x,i)=>{const pos=x.gex>=0,ratio=Math.max(2,Math.abs(x.gex)/maxGex*100);return `<div class="kl-gex-row ${pos?'is-positive':'is-negative'}"><span class="kl-rank">${String(i+1).padStart(2,'0')}</span><strong class="kl-strike">${fmt(x.strike,2)}</strong><span class="kl-track"><i style="width:${ratio.toFixed(1)}%"></i></span><b class="kl-gex-value">${x.gex>=0?'+':'−'}${compact(Math.abs(x.gex))}</b><span class="kl-side">${pos?'NET +':'NET −'}</span></div>`}).join(''):`<div class="kl-empty">${c.gexMissing>0?`GEX chưa đủ ${c.gexMissing}/${c.totalContracts} contracts · OI thiếu ${c.oiMissing} · multiplier thiếu ${c.multiplierMissing} · Gamma/IV thiếu ${c.missingGreekSamples.length?c.missingGreekSamples.length:'xem Data Status'} · coverage ${(c.gexCoverage*100).toFixed(1)}%.`: 'Chưa có GEX khác 0 để xếp hạng.'}</div>`;
    el.innerHTML=`<div class="kl-summary-grid">${cardsHtml}</div><section class="kl-gex-panel"><div class="kl-gex-heading"><div><h4>GEX ladder <span>01—10</span></h4><p>Xếp theo |Net GEX| sau khi loại tất cả Key Levels trùng strike</p></div>${status}</div><div class="kl-gex-list">${gexHtml}</div><p class="kl-footnote">Net GEX theo strike = Call GEX (+) + Put GEX (−). CW là Net GEX dương lớn nhất; PW là Net GEX âm có trị tuyệt đối lớn nhất. Call/Put OI Walls được tính độc lập từ OI. GEX Ratio = Σ Call GEX / |Σ Put GEX|. Ratio > 1: Call Gamma trội, thiên hướng ổn định/biên độ hẹp; ratio < 1: Put Gamma trội, rủi ro biến động/trượt giá cao. Đây là heuristic theo quy ước Call+/Put−, không xác nhận dealer positioning. Gamma Flip / Zero Gamma được tính một lần bằng BSM repricing. GEX coverage: ${(c.gexCoverage*100).toFixed(1)}% (${c.gexKnown}/${c.totalContracts}) · OI null→0 ${c.oiAssumedZero} · Volume null→0 ${c.volumeAssumedZero} · Gamma Binance ${c.gammaProviderKnown}, BSM/IV ${c.gammaDerivedKnown}, thiếu ${c.gexMissing} · multiplier Binance ${c.multiplierKnown-c.multiplierAssumed}, standard-100 fallback ${c.multiplierAssumed}.</p></section>`;
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
    const status=!c.complete?'PARTIAL CHAIN':metricKey==='gamma'&&c.gexProvisional?'GEX PROVISIONAL':metricKey==='gamma'&&!c.gexComplete?'GEX COVERAGE INCOMPLETE':'FULL CHAIN';
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
      `<p class="opt-footnote">Exposure dùng OI null như 0 cho tới khi Binance gửi số thực; ${c.oiAssumedZero} contract đang zero-fill. Contract OI > 0 nhưng thiếu multiplier (${c.multiplierMissing}) bị loại khỏi Greeks exposure.</p>`;
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
    if((field==='openInterest'||field==='volume')&&v==null)return `<td class="opt-assumed-zero" title="Binance trả null; giả định 0 cho tới khi có dữ liệu thực">0</td>`;
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
    const missingOISample=c.oiMissingSamples.length?` · ${c.oiMissingSamples.slice(0,3).join(', ')}`:'';
    const missingMultSample=c.missingMultiplierSamples.length?` · ${c.missingMultiplierSamples.slice(0,3).join(', ')}`:'';
    const missingGreekSample=c.missingGreekSamples.length?` · ${c.missingGreekSamples.slice(0,3).join(', ')}`:'';
    const missingIVSample=c.missingIVSamples.length?` · ${c.missingIVSamples.slice(0,3).join(', ')}`:'';
    el.innerHTML=`<span>Expiry: <b>${esc(s.expiry||'—')}</b></span><span>OCC contracts: <b>${c.totalContracts}${s.chainListInvalidCount?` · ${s.chainListInvalidCount} dòng lỗi OCC`:''}${s.chainListDuplicateCount?` · ${s.chainListDuplicateCount} OCC trùng`:''}</b></span><span>Quotes: <b>${s.quotes.size}/${c.totalContracts}</b></span><span>OI observed: <b>${c.oiKnown}/${c.totalContracts} · ${c.oiAssumedZero} null → 0 assumed${esc(missingOISample)}</b></span><span>IV coverage (OI > 0): <b>${c.ivKnown}/${c.ivKnown+c.ivMissing} · thiếu ${c.ivMissing}${esc(missingIVSample)}</b></span><span>Multiplier: <b>${c.multiplierKnown} hợp lệ · ${c.multiplierAssumed} suy ra ×100 · thiếu ${c.multiplierMissing}${esc(missingMultSample)}</b></span><span>GEX: <b>${c.gexKnown}/${c.totalContracts} · ${c.gammaProviderKnown} provider + ${c.gammaDerivedKnown} BSM/IV · thiếu ${c.gexMissing}${esc(missingGreekSample)}</b></span><span>Full quote universe: <b>${c.complete?'Loaded':'Loading / partial'}</b></span><span>Last quote update: <b>${s.oiLastUpdate?new Date(s.oiLastUpdate).toLocaleTimeString('vi-VN'):'—'}</b></span>`;
    const multiplier=[...s.quotes.values()].map(q=>effectiveMultiplier(q).value).find(x=>x!==null)??null;
    const mult=$(`so-${s.cfg.key}-multiplier`),toolbarMult=$(`so-${s.cfg.key}-contract-multiplier`);
    const multiplierLabel=multiplier?`${fmt(multiplier,0)} shares${c.multiplierAssumed?' · includes standard fallback':''}`:'—';
    if(mult)mult.textContent=multiplierLabel;
    if(toolbarMult)toolbarMult.textContent=multiplierLabel;
    const meta=$(`so-${s.cfg.key}-meta`);if(meta){
      const items=[
        ['OPTIONS FEED','Binance Stock Options · delayed / access-dependent'],
        ['REST SOURCE','chain-symbols + get-option-quote'],
        ['CONTRACT MULTIPLIER',`${c.multiplierKnown} contract OI>0 có multiplier · ${c.multiplierAssumed} suy ra 100 shares cho OCC QQQ/GLD chuẩn`],
        ['QUOTE COVERAGE',`${s.quotes.size}/${c.totalContracts} OCC contracts`],
        ['OI OBSERVED / ZERO-FILL',`${c.oiKnown} observed · ${c.oiAssumedZero} null → 0 assumed · analytics coverage ${(c.oiAnalyticsCoverage*100).toFixed(1)}%${missingOISample}`],
        ['IV COVERAGE · OI > 0',`${c.ivKnown}/${c.ivKnown+c.ivMissing} · thiếu ${c.ivMissing}${missingIVSample}`],
        ['GEX COVERAGE',`${(c.gexCoverage*100).toFixed(1)}% · ${c.gammaProviderKnown} Gamma provider · ${c.gammaDerivedKnown} Gamma BSM/IV · thiếu ${c.gexMissing}${missingGreekSample}`],
        ['MULTIPLIER COVERAGE',`${c.multiplierKnown} hợp lệ · ${c.multiplierAssumed} assumed ×100 · thiếu ${c.multiplierMissing}${missingMultSample}`],
        ['ZERO-FILL ASSUMPTIONS',`${c.oiAssumedZero} OI · ${c.volumeAssumedZero} Volume`],
        ['MISSING DATA',`${c.ivMissing} IV · ${c.multiplierMissing} multiplier · ${c.missingGreekSamples.length} Gamma/IV`],
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
      const c=calc(s),text=[`${s.cfg.symbol} · ${s.expiry}`,`Call OI Wall: ${c.callOIWall?.strike??'—'}`,`Put OI Wall: ${c.putOIWall?.strike??'—'}`,`CW (max +Net GEX): ${c.gexCallWall?.strike??'—'}`,`PW (max |−Net GEX|): ${c.gexPutWall?.strike??'—'}`,`Gamma Flip / Zero Gamma (BSM repriced): ${c.gammaFlip??'—'}`,`Max Pain: ${c.maxPain?.strike??'—'}${c.maxPain?.isTie?` (tied: ${c.maxPain.tiedStrikes.join('/')})`:''}`,`GEX Ratio (Call GEX / |Put GEX|): ${c.gexRatioState==='call-only'?'∞':c.gexRatio===null?'—':c.gexRatio.toFixed(4)+'x'}`,`GEX 1-10: ${c.gexLevels.map(x=>x.strike).join(', ')}`,`Call OI: ${c.callOI}`,`Put OI: ${c.putOI}`,`GEX: ${c.gamma}`,`DEX: ${c.delta}`,`OI observed: ${(c.coverage*100).toFixed(1)}% · zero-filled ${c.oiAssumedZero}`].join('\n');
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
      coverage:c.coverage,oiAnalyticsCoverage:c.oiAnalyticsCoverage,oiKnown:c.oiKnown,oiAssumedZero:c.oiAssumedZero,volumeAssumedZero:c.volumeAssumedZero,oiAnalyticsComplete:c.oiComplete,totalContracts:c.totalContracts,callOI:c.callOI,putOI:c.putOI,callVol:c.callVol,putVol:c.putVol,
      callOIWall:c.oiComplete&&c.callOIWall?{strike:c.callOIWall.strike,oi:c.callOIWall.callOI}:null,
      putOIWall:c.oiComplete&&c.putOIWall?{strike:c.putOIWall.strike,oi:c.putOIWall.putOI}:null,
      gexCallWall:c.gexCallWall?{strike:c.gexCallWall.strike,gex:c.gexCallWall.gex}:null,
      gexPutWall:c.gexPutWall?{strike:c.gexPutWall.strike,gex:c.gexPutWall.gex}:null,
      gexAvailable:c.gexAvailable,gexComplete:c.gexComplete,gexProvisional:c.gexProvisional,gexKnown:c.gexKnown,gexMissing:c.gexMissing,gammaProviderKnown:c.gammaProviderKnown,gammaDerivedKnown:c.gammaDerivedKnown,gexCoverage:c.gexCoverage,
      gammaFlip:c.gammaFlipComplete?c.gammaFlip:null,gammaFlipMethod:'Gamma Flip / Zero Gamma · BSM repricing · fixed OI/IV · r=q=0 · expiry 16:00 America/New_York · bisection-refined Net GEX zero-cross',maxPain:c.maxPain?{strike:c.maxPain.strike,tiedStrikes:c.maxPain.tiedStrikes,payout:c.maxPain.payout}:null,gexRatio:c.gexRatio,gexRatioState:c.gexRatioState,gexRatioBias:c.gexRatioBias,callGexTotal:c.callGexTotal,putGexAbsTotal:c.putGexAbsTotal,complete:c.complete,oiComplete:c.oiComplete,maxPainComplete:c.maxPainComplete,
      gexLevels:c.gexLevels.map((x,i)=>({rank:i+1,strike:x.strike,gex:x.gex})),gexRankedCandidates:c.gexRankedCandidates.map(x=>({strike:x.strike,gex:x.gex})),gexLadderExcludedLevels:c.gexLadderExcludedLevels,gexMethod:{providerGamma:c.gammaProviderKnown,bsmDerivedGamma:c.gammaDerivedKnown},oiWall:c.oiWall?{strike:c.oiWall.strike,oi:c.oiWall.oi}:null,
      dist:c.dist.map(x=>({strike:x.strike,callOI:x.callOI,putOI:x.putOI,callVol:x.callVol,putVol:x.putVol,gex:c.gexComplete?x.gex:null,callGex:c.gexComplete?x.callGex:null,putGex:c.gexComplete?x.putGex:null}))};
  }

  buildViews();
  window.stockOptionsSetActive=setActive;
  window.stockOptionsCrossAssetStart=crossAssetStart;
  window.stockOptionsCrossAssetStop=crossAssetStop;
  window.stockOptionsCrossAssetSnapshot=crossAssetSnapshot;
  window.stockOptionsCrossAssetSetExpiry=crossAssetSetExpiry;
  window.stockOptionsDebug=()=>Object.fromEntries(Object.values(sessions).map(s=>{const c=calc(s);return [s.cfg.symbol,{expiry:s.expiry,quotes:s.quotes.size,contracts:c.totalContracts,quotesExpiry:s.quotesExpiry,complete:c.complete,hydrating:s.hydrating,missingQuoteSymbols:c.missingQuoteSymbols.slice(0,20),lastHydrationIncompleteSymbols:s.lastHydrationIncompleteSymbols||[],incompleteContractDetails:(s.lastHydrationIncompleteSymbols||[]).slice(0,12).map(symbol=>{const q=s.quotes.get(symbol)||{},m=s.contractMeta?.get(symbol)||{};return {symbol,side:q.side??m.side,strike:q.strike??m.strike,oi:q.openInterest??m.openInterest,iv:q.iv??m.iv,gamma:q.gamma??m.gamma,multiplier:q.multiplier??m.multiplier,effectiveMultiplier:effectiveMultiplier(q.optionSymbol?q:m)}}),quoteSamples:[...s.quotes.values()].slice(0,3).map(q=>({symbol:q.optionSymbol,side:q.side,strike:q.strike,oi:q.openInterest,iv:q.iv,gamma:q.gamma,multiplier:q.multiplier,effectiveMultiplier:effectiveMultiplier(q)})),chainListInvalidCount:s.chainListInvalidCount,chainListDuplicateCount:s.chainListDuplicateCount,displayStrikes:s.displayStrikes,oiKnown:c.oiKnown,oiMissing:c.oiMissing,oiAssumedZero:c.oiAssumedZero,volumeKnown:c.volumeKnown,volumeAssumedZero:c.volumeAssumedZero,oiObservedCoverage:c.coverage,oiAnalyticsCoverage:c.oiAnalyticsCoverage,oiMissingSamples:c.oiMissingSamples,multiplierKnown:c.multiplierKnown,multiplierAssumed:c.multiplierAssumed,multiplierMissing:c.multiplierMissing,missingMultiplierSamples:c.missingMultiplierSamples,iv:[...s.quotes.values()].filter(q=>q.iv!==null).length,providerGamma:[...s.quotes.values()].filter(q=>q.gamma!==null).length,bsmGamma:c.gammaDerivedKnown,missingGreekSamples:c.missingGreekSamples,gexCoverage:c.gexCoverage,gexKnown:c.gexKnown,gexMissing:c.gexMissing,gexComplete:c.gexComplete,oiComplete:c.oiComplete,callOIWall:c.callOIWall?.strike??null,putOIWall:c.putOIWall?.strike??null,gexCW:c.gexCallWall?.strike??null,gexPW:c.gexPutWall?.strike??null,gexLevels:c.gexLevels.map(x=>x.strike),gexLadderExcludedLevels:c.gexLadderExcludedLevels,gammaFlip:c.gammaFlip,maxPain:c.maxPain?.strike??null,maxPainTiedStrikes:c.maxPain?.tiedStrikes||[],maxPainComplete:c.maxPainComplete,gexRatio:c.gexRatio,price:s.price}] }));
})();
