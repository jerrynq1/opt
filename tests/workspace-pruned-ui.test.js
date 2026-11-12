'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('removed tools are not present in the page or loaded as runtime modules',()=>{
  const html=read('index.html');
  for(const id of ['pvtToggle','pvtPanel','dttSettings','rpB']) assert.doesNotMatch(html,new RegExp(`id=["']${id}["']`));
  for(const src of ['js/price-variation.js','js/dtt.js','js/replay.js','js/kinematics.js','js/vsa.js']) assert.doesNotMatch(html,new RegExp(`src=["']${src.replaceAll('/','\\/')}["']`));
  for(const file of ['js/price-variation.js','js/dtt.js','js/replay.js','js/kinematics.js','js/vsa.js']) assert.equal(fs.existsSync(path.join(root,file)),false,`${file} should be removed`);
  assert.doesNotMatch(html,/Replay|Price Variation|DTT/);
});

test('indicator source registry keeps only Orderflow and Market Model definitions',()=>{
  const sandbox={IND:{ema:{t:'ov'},rsi:{t:'osc'},footprint:{t:'of'},ict:{t:'of'}}};
  vm.createContext(sandbox);
  vm.runInContext(read('js/pine-indicators-defs.js'),sandbox);
  const defs=Object.values(sandbox.IND);
  assert.ok(defs.length>=6);
  assert.ok(defs.every(d=>['of','mm'].includes(d.t)));
  for(const key of ['crtSoup','ssmtPlus','sdRangePlus','wyckoffPlus','po3Plus']) assert.equal(sandbox.IND[key].t,'mm');
  assert.equal('ema' in sandbox.IND,false);
  assert.equal('rsi' in sandbox.IND,false);
});

test('Options layout loads its base stylesheet and explicit responsive styling',()=>{
  const html=read('index.html');
  const base=read('css/options.css');
  const polish=read('css/simple-options-polish.css');
  assert.match(html,/href=["']css\/options\.css["']/);
  assert.match(html,/href=["']css\/stock-options\.css["']/);
  assert.match(html,/href=["']css\/simple-options-polish\.css["']/);
  assert.match(base,/\.opt-metric span\{display:block/);
  assert.match(polish,/\.stock-options-view \.opt-metric>span[^}]*display:block/);
  assert.match(polish,/\.kl-summary-grid\{display:grid/);
  assert.match(polish,/\.kl-gex-list\{display:grid/);
  assert.match(polish,/\.so-chain-table td\.strike\{width:82px;min-width:82px/);
  assert.match(polish,/\.so-chain-table thead tr:nth-child\(2\) th\{min-width:72px/);
});

test('ICT QuantLab theme and bilateral Exposure panel are loaded after the workspace polish',()=>{
  const html=read('index.html');
  const theme=read('css/ict-quantlab-theme.css');
  const stock=read('js/stock-options.js');
  assert.match(html,/href=["']css\/ict-quantlab-theme\.css["']/);
  assert.ok(html.indexOf('css/ict-quantlab-theme.css')>html.indexOf('css/simple-options-polish.css'));
  for(const font of ['DM Sans','Space Grotesk','DM Mono']) assert.ok(theme.includes(font));
  assert.match(theme,/--bg:#080d16/);
  assert.match(theme,/--cyan:#65d6e8/);
  assert.match(theme,/@keyframes fade/);
  assert.match(theme,/exposure-put-track i[^}]*opacity:1;transform:none/);
  assert.match(stock,/exposure-axis-head/);
  assert.match(stock,/CALL OI WALL/);
  assert.match(stock,/PUT OI WALL/);
  assert.match(stock,/CW · MAX \+GEX/);
  assert.match(stock,/PW · MAX −GEX/);
  assert.match(stock,/so-exposure-dots/);
  assert.match(stock,/MAX_ROWS=44/);
  assert.match(stock,/callOIWall,putOIWall,gexCallWall,gexPutWall/);
  const defs=read('js/indicators-custom.js');
  assert.match(defs,/\[\"gexWalls\",\"CW \/ PW · Net GEX Walls\"/);
});


test('Paper Trading / Buy-Sell ticket and embedded ETF charts are fully removed',()=>{
  const html=read('index.html');
  const stock=read('js/stock-options.js');
  const style=read('css/style.css');
  assert.doesNotMatch(html,/js\/paper-trading\.js/);
  assert.equal(fs.existsSync(path.join(root,'js/paper-trading.js')),false);
  assert.doesNotMatch(style,/paperPanel|paperQuick|paperLines|paper-buy|paper-sell/);
  assert.doesNotMatch(stock,/Candlestick Chart|Underlying Snapshot|data-so-interval|@kline_/);
  assert.doesNotMatch(stock,/so-chart-grid|so-quote-card|so-chart-wrap/);
});

test('Exposure bars and Spot/Wall markers stay visible during frequent underlying ticks',()=>{
  const theme=read('css/ict-quantlab-theme.css');
  assert.match(theme,/exposure-put-track i[^}]*opacity:1;transform:none/);
  assert.match(theme,/\.exposure-put-track,.stock-options-view \.exposure-call-track\{[^}]*width:100%/);
  assert.match(theme,/\.exposure-marker\{[^}]*opacity:1/);
  assert.doesNotMatch(theme,/exposure-grow|exposure-marker-in|scaleX\(0\)/);
});


test('mobile Options controls use a two-column grid and OI legend can wrap without collision', () => {
  const polish = read('css/simple-options-polish.css');
  assert.match(polish, /\.stock-options-view \.opt-toolbar\s*\{\s*display:\s*grid/s);
  assert.match(polish, /grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(polish, /small\.opt-chart-meta\s*\{[^}]*display:\s*flex/s);
  assert.match(polish, /\.opt-chart-meta \.opt-legend-item/);
});

test('chart shows an actionable empty state while cTrader has not supplied bars', () => {
  const html = read('index.html');
  const chart = read('js/chart.js');
  const theme = read('css/ict-quantlab-theme.css');
  assert.match(html, /id="chartEmptyState"/);
  assert.match(html, /data-go="conn"/);
  assert.match(chart, /empty\.hidden=hasBars/);
  assert.match(theme, /\.chart-empty-state\[hidden\]\{display:none!important\}/);
});


test('default workspace theme is dark and the chart feed pill is width-bounded', () => {
  const core = read('js/core.js');
  const theme = read('css/ict-quantlab-theme.css');
  assert.match(core, /ld\("tp_theme",""\)\|\|"dark"/);
  assert.match(theme, /#st\{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap/);
});

test('Options methodology panel is populated before market data loads', () => {
  const stock = read('js/stock-options.js');
  const theme = read('css/ict-quantlab-theme.css');
  for (const text of ['Binance Stock Options', 'Binance Equity WebSocket', 'OI × Greek × multiplier', 'Giữ null, không thay bằng 0']) {
    assert.ok(stock.includes(text), `missing methodology/status item: ${text}`);
  }
  assert.match(theme, /so-method-card \.opt-meta\{display:grid/);
  assert.match(theme, /so-method-card \.opt-meta-item/);
});

test('Aggregate Greeks remains readable in the narrow desktop side panel', () => {
  const theme = read('css/ict-quantlab-theme.css');
  assert.match(theme, /so-greeks-card \.opt-greeks\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(theme, /so-greeks-card \.opt-empty\{grid-column:1\/-1/);
});

test('tablet feed pill stays inside its status column and narrow-phone indicator cards fit', () => {
  const theme = read('css/ict-quantlab-theme.css');
  assert.match(theme, /body\.simple-ui #st\{width:100%;max-width:100%;min-width:0;\}/);
  assert.match(theme, /#v-ind #indGrid\{grid-template-columns:minmax\(0,1fr\);\}/);
});

test('live Options metadata keeps the same styled chips after quotes load', () => {
  const stock = read('js/stock-options.js');
  assert.match(stock, /meta\.innerHTML=items\.map\(\(\[label,value\]\)=>`<span class="opt-meta-item">/);
  for (const label of ['OPTIONS FEED', 'REST SOURCE', 'CONTRACT MULTIPLIER', 'OI COVERAGE', 'MISSING DATA', 'SPOT WEBSOCKET']) {
    assert.ok(stock.includes(label));
  }
});

test('Exposure legend explains both directional wall markers and separates their labels', () => {
  const stock = read('js/stock-options.js');
  const theme = read('css/ict-quantlab-theme.css');
  assert.match(stock, /CALL OI WALL/);
  assert.match(stock, /PUT OI WALL/);
  assert.match(stock, /CW · MAX \+GEX/);
  assert.match(stock, /PW · MAX −GEX/);
  assert.match(theme, /exposure-marker\.is-call-wall span\{left:4px;right:auto/);
  assert.match(theme, /exposure-marker\.is-put-wall span\{right:4px;top:1px/);
  assert.match(theme, /exposure-marker\.is-gex-call-wall/);
  assert.match(theme, /exposure-marker\.is-gex-put-wall/);
});

test('Options network errors show a concise summary and escaped technical detail', () => {
  const stock = read('js/stock-options.js');
  const theme = read('css/ict-quantlab-theme.css');
  assert.match(stock, /Không tải được Option Chain/);
  assert.match(stock, /opt-error-details/);
  assert.match(stock, /\$\{esc\(detail\)\}/);
  assert.match(theme, /opt-errors:not\(\[hidden\]\)/);
});
