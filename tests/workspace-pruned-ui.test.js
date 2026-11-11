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
  assert.match(theme,/@keyframes exposure-grow/);
  assert.match(stock,/exposure-axis-head/);
  assert.match(stock,/CALL RESISTANCE/);
  assert.match(stock,/PUT SUPPORT/);
  assert.match(stock,/so-exposure-dots/);
  assert.match(stock,/MAX_ROWS=44/);
});
