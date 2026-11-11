/* ICT 2022 overlay rendering smoke test with a mocked canvas/chart host. */
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','js','ict-2022.js'),'utf8');
const calls={};
const proxy=new Proxy({},{get:(t,k)=>k==='measureText'?(s=>({width:String(s).length*6})):(k in t?t[k]:(...a)=>{calls[k]=(calls[k]||0)+1}),set:(t,k,v)=>(t[k]=v,true)});
const mkEl=()=>({id:'',style:{},innerHTML:'',appendChild(){},getBoundingClientRect:()=>({width:1000,height:600})});
const els={chart:mkEl()};els.chart.appendChild=e=>{els[e.id]=e};const doc={head:{appendChild(){}},getElementById:id=>els[id]||null,createElement:mkEl};
const bars=[];const start=Date.UTC(2026,10,2,0,0,0)/1000;for(let i=0;i<160;i++){const c=100+Math.sin(i/3)*3+i*.015;bars.push({st:start+i*1800,time:start+i*1800,open:c-.35,high:c+1.1,low:c-1.05,close:c,v:12});}
const defs=[['visualMode','clean'],['closedOnly',true],['maxBars',6000],['maxM1',140000],['atrLen',14],['pivotL',2],['pivotR',2],['eqTol',.08],['fvgStrict',true],['fvgATR',.08],['lvATR',1.25],['obWick',true],['rbWick',1.4],['maxZones',8],['extend',25],['showFilled',false],['structure',true],['pivots',true],['eq',true],['sweeps',true],['prevLevels',true],['opens',true],['dailySwings',true],['adr',true],['planOn',true],['planDir','long'],['planEntry',100],['planStop',98],['planTarget',104],['beAtR',1],['range',true],['ote',true],['fvg',true],['ifvg',true],['bpr',true],['blocks',true],['rb',true],['mb',false],['vi',false],['sessions',true],['models',true],['cbdr',true],['gaps',true],['ipda',false],['quarter',true],['newsOn',false],['newsText',''],['dashboard',true],['dashPos','tr']];
const g={Intl,Date,Math,Number,Array,Map,Set,String,JSON,Object,isFinite,Infinity,RegExp,console,document:doc,ctx:proxy,
  agg:bars,m1:[],C:{tf:1800,sym:'TEST'},ACT:[{key:'ict22',on:true,p:Object.fromEntries(defs),c:[]}],IND:{ict22:{p:defs.map(([k,v])=>[k,k,v])}},
  isOn:a=>a.on,pdef:d=>Object.fromEntries(d.p.map(x=>[x[0],x[2]])),$:id=>els[id]||(els[id]=mkEl()),
  ts:{logicalToCoordinate:i=>40+i*5},cs:{priceToCoordinate:p=>400-(p-90)*4},font:()=>'11px sans-serif',hexA:(c,a)=>c,pd:()=>2,s2u:t=>t,u2s:t=>t};
g.window={};vm.createContext(g);vm.runInContext(src,g);
g.window.drawICT(900,500);
assert.ok(els.ict22Dash);assert.strictEqual(els.ict22Dash.style.display,'block');assert.ok(/ICT 2022/.test(els.ict22Dash.innerHTML));assert.ok(/BULLISH|BEARISH|NEUTRAL/.test(els.ict22Dash.innerHTML));assert.ok(/Cấu trúc/.test(els.ict22Dash.innerHTML));assert.ok(/MỤC TIÊU THANH KHOẢN/.test(els.ict22Dash.innerHTML));assert.ok(!/CBDR TP theo PDF|Trade Plan/.test(els.ict22Dash.innerHTML));
assert.ok((calls.stroke||0)>0);const cleanLabels=calls.fillText||0;assert.ok(cleanLabels<=24,'clean chart should not flood the canvas with labels');
g.ACT[0].p.visualMode='full';g.window.drawICT(900,500);assert.ok((calls.fillText||0)>cleanLabels,'full mode should expose the extra labels when requested');
console.log('ok  ICT 2022 compact dashboard + clean/full canvas modes render without exception.');
