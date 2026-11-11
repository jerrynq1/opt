const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const J=path.join(__dirname,'..','js')+'/';
const full=fs.readFileSync(J+'hvn-profile.js','utf8'),pure=full.split('/* ===== vẽ ===== */')[0];
const strip=s=>s.replace(/\bconst (\w+)=/g,'var $1=');
const ctx={Math,Float64Array,Uint8Array,Number,Array,isFinite,SMP:()=>[]};vm.createContext(ctx);vm.runInContext(strip(pure),ctx);
let n=0;const ok=x=>console.log('ok  ',x)||n++;
const run=c=>vm.runInContext(c,ctx);
const Q0={thr:60,smooth:2,gapr:1,minr:1,prom:15,mins:0,meth:'peak'};
ctx.Q0=Q0;

// ---------- profile ----------
const m=[];
for(let i=0;i<60;i++){const c=(i%2?100:110);m.push([i*60,c,c+.5,c-.5,c,100])}
for(let i=0;i<60;i++)m.push([3600+i*60,120,120.5,119.5,120,10]);
ctx.m=m;
const P=run('hvnProfile(m,0,3600,100,0.01)');
assert(P&&P.n>5);ok('hvnProfile: dựng được profile, '+P.n+' hàng');
assert(Math.abs(P.tot-6000)<1e-6&&Math.abs(Array.from(P.vol).reduce((a,b)=>a+b,0)-6000)<1e-6);ok('hvnProfile: bảo toàn tổng volume');
assert.strictEqual(run('hvnProfile(m,7200,10800,100,0.01)'),null);ok('hvnProfile: không có nến thì null');
// tick thật: 1 nến rộng 100..110, volume 100, nhưng tick nói toàn bộ khớp ở 105
ctx.mt=[[0,100,110,100,110,100]];ctx.fpf=t=>{const r=[[105,50,50]];r.sp=0;return r};
const PT=run('hvnProfile(mt,0,60,50,0.01,fpf)');
const mxRow=Array.from(PT.vol).indexOf(Math.max(...PT.vol));
assert(Math.abs(PT.base+(mxRow+.5)*PT.bin-105)<=PT.bin&&PT.cov===1);ok('hvnProfile: dùng tick thật khi có (volume dồn về 105, cov=100%)');
const PU=run('hvnProfile(mt,0,60,50,0.01)');
assert(PU.cov===0&&Math.max(...PU.vol)<30);ok('hvnProfile: không có tick thì trải đều theo đường giá');

// ---------- nhận diện ----------
const cl=run('hvnFind(P=hvnProfile(m,0,3600,100,0.01),Q0)');
assert.strictEqual(cl.length,2);
const pocs=cl.map(c=>P.base+(c.poc+.5)*P.bin).sort((a,b)=>a-b);
assert(Math.abs(pocs[0]-100)<1&&Math.abs(pocs[1]-110)<1);ok('peak: 2 node, POC ≈ '+pocs.map(x=>x.toFixed(2)).join(' và '));
console.log('   sh =',cl.map(z=>z.sh.toFixed(1)));assert(cl.every(z=>z.sh>15&&z.sh<=50)&&Math.abs(cl[0].sh-cl[1].sh)<5&&cl.every(z=>Math.abs(z.rel-1)<.1));ok('hvnFind: 2 node đối xứng có % volume gần bằng nhau (mỗi node chiếm một phần lõi của 50%), rel ≈ 1');

// profile dựng tay: 2 đỉnh kề nhau chung một thung lũng + 1 gợn nhỏ trên sườn
const mk=v=>({n:v.length,vol:Float64Array.from(v),tot:v.reduce((a,b)=>a+b,0),base:0,bin:1});
ctx.PA=mk([1,2,10,30,60,90,60,40,35,38,45,80,100,80,40,10,2,1]);
const adj=run('hvnNodes(PA,{thr:30,smooth:0,prom:15,minr:1})');
assert.strictEqual(adj.length,2);assert(adj[0].hi<adj[1].lo);ok('peak: 2 node kề nhau tách ở thung lũng, không chồng ('+adj.map(c=>c.lo+'-'+c.hi)+')');
const lv=run('hvnClusters(PA,{thr:30,smooth:0,gapr:1,minr:1})');
assert.strictEqual(lv.length,1);ok('level: cùng dữ liệu thì cách theo ngưỡng dính thành 1 cụm (đúng là điểm yếu của cách cũ)');
ctx.PB=mk([1,2,10,30,60,90,60,40,35,38,45,41,40,38,10,2,1]);       // đỉnh thứ 2 chỉ cao hơn thung lũng 10/90
assert.strictEqual(run('hvnNodes(PB,{thr:30,smooth:0,prom:15,minr:1})').length,1);
assert.strictEqual(run('hvnNodes(PB,{thr:30,smooth:0,prom:5,minr:1})').length,2);ok('peak: prominence loại gợn nhỏ, hạ ngưỡng thì giữ lại');
ctx.PC=mk([0,0,5,5,5,5,5,0,0,0,1,0]);
const pl=run('hvnNodes(PC,{thr:60,smooth:0,prom:15,minr:1})');
assert.strictEqual(pl.length,1);assert.strictEqual(pl[0].lo,2);assert.strictEqual(pl[0].hi,6);ok('peak: cao nguyên phẳng thành 1 node đủ rộng');
ctx.P0=mk([0,0,0]);assert.strictEqual(run('hvnNodes(P0,{thr:60,smooth:2,prom:15,minr:1})').length,0);ok('peak: profile rỗng không lỗi');
assert.strictEqual(run('hvnNodes(PA,{thr:30,smooth:0,prom:15,minr:99})').length,0);ok('minr loại vùng quá hẹp');
ctx.PD=mk([100,100,100,100,100,100,100,100]);
assert.strictEqual(run('hvnNodes(PD,{thr:60,smooth:0,prom:15,minr:1})').length,0);ok('peak: profile phẳng hoàn toàn thì không có node nào nổi bật (đúng)');
const fm=m_=>run(`hvnFind(PA,{meth:"peak",thr:30,smooth:0,prom:15,minr:1,mins:${m_}})`).length;
assert.strictEqual(fm(0),2);assert.strictEqual(fm(50),1);assert.strictEqual(fm(60),0);ok('hvnFind: lọc vùng yếu theo % volume (node 43.5% và 52.9%: mins 50 giữ 1, mins 60 bỏ hết)');

// ---------- chạm vùng ----------
const bar=(st,o,h,l,c)=>({st,open:o,high:h,low:l,close:c});
const Z=(zb,zt,sd)=>({zb,zt,pp:(zb+zt)/2,sd});
const hit=(z,b,p,mode)=>{ctx.z=z;ctx.b=b;ctx.p=p;return run(`hvnHit(z,b,p,"${mode}")`)};
assert(hit(Z(100,102,1),bar(0,99,101,98,99),null,'edge'));ok('edge: râu chạm mép là đủ');
assert(!hit(Z(100,102,1),bar(0,95,99,94,98),null,'edge'));ok('edge: chưa tới vùng thì chưa chạm');
assert(!hit(Z(100,102,1),bar(0,99,100.5,98,99),null,'poc'));assert(hit(Z(100,102,1),bar(0,99,101.5,98,99),null,'poc'));ok('poc: phải chạm tới POC mới tính');
assert(!hit(Z(100,102,1),bar(0,99,103,98,99),null,'close'));assert(hit(Z(100,102,1),bar(0,99,103,98,101),null,'close'));ok('close: râu xuyên qua mà đóng cửa ngoài vùng thì chưa tính');
assert(hit(Z(100,102,-1),bar(0,99,99.5,90,95),null,'close'));ok('close: hỗ trợ bị đóng cửa xuyên xuống dưới thì tính');
assert(hit(Z(110,111,1),bar(10,120,121,119,120),bar(0,99,101,98,100),'edge'));ok('gap: giá nhảy qua vùng (từ dưới lên) tính là đã dùng hết');
assert(hit(Z(110,111,-1),bar(10,100,101,99,100),bar(0,121,122,120,121),'edge'));ok('gap: nhảy xuống qua vùng cũng tính');
assert(!hit(Z(110,111,1),bar(10,100,101,99,100),bar(0,99,101,98,100),'edge'));ok('không gap, không chạm thì không tính');
ctx.z=Z(100,102,1);assert.strictEqual(run('hvnOut(z,{close:103})'),'b');assert.strictEqual(run('hvnOut(z,{close:101})'),'h');
ctx.z=Z(100,102,-1);assert.strictEqual(run('hvnOut(z,{close:99})'),'b');assert.strictEqual(run('hvnOut(z,{close:101})'),'h');
ctx.z=Z(100,102,0);assert.strictEqual(run('hvnOut(z,{close:101})'),'');ok('hvnOut: kháng cự bị đóng cửa trên = phá, hỗ trợ đóng cửa dưới = phá, trung tính = rỗng');

// ---------- chạy thử drawHVN với canvas giả ----------
{
  const calls=[],rec=new Proxy({},{get:(t,k)=>k in t?t[k]:(...a)=>{calls.push([k,...a])},set:(t,k,v)=>{t[k]=v;return true}});
  const M=[];
  for(let i=0;i<60;i++){const c=i%2?100:110;M.push([i*60,c,c+.5,c-.5,c,100])}
  for(let i=0;i<60;i++)M.push([3600+i*60,120,120.5,119.5,120,10]);
  for(let i=0;i<60;i++){const c=120-i/6;M.push([7200+i*60,c,c+.3,c-.3,c,10])}
  const tf=900,agg=[];
  for(let t=0;t<10800;t+=tf){const r=M.filter(x=>x[0]>=t&&x[0]<t+tf);agg.push({st:t,time:t,open:r[0][1],close:r[r.length-1][4],high:Math.max(...r.map(x=>x[2])),low:Math.min(...r.map(x=>x[3])),v:0})}
  const env={Math,Float64Array,Uint8Array,Number,Array,Object,Map,Set,isFinite,console,window:{},
    m1:M,agg,C:{sym:'T',tf},ACT:[],SMP:()=>[],isOn:()=>true,pdef:d=>Object.fromEntries(d.p.map(x=>[x[0],x[2]])),IND:{},
    cres:(a,j)=>a.c[j],hexA:(h,al)=>'rgba('+h+','+al+')',ctx:rec,pd:()=>2,vpTick:()=>0.01,font:()=>'10px x',status:()=>{},
    bucket:(t,f)=>Math.floor(t/f)*f,s2l:s=>s/tf,ts:{logicalToCoordinate:l=>l*10},cs:{priceToCoordinate:p=>1000-p*5}};
  vm.createContext(env);
  const cust=fs.readFileSync(J+'indicators-custom.js','utf8');
  vm.runInContext('var tfName=s=>"H"+s/3600;'+cust.slice(cust.indexOf('IND.hvn={')),env);
  vm.runInContext(strip(full),env);
  const a={key:'hvn',on:true,p:Object.assign(vm.runInContext('pdef(IND.hvn)',env),{grace:0,alert:false}),c:[...env.IND.hvn.c]};
  env.ACT.push(a);
  vm.runInContext('drawHVN(600,1000)',env);
  assert(calls.filter(c=>c[0]==='fillRect').length>0);ok('drawHVN: chạy không lỗi');
  const Qv=()=>vm.runInContext('Object.assign(pdef(IND.hvn),ACT[0].p)',env);
  env.Qv=Qv;
  const E=vm.runInContext('hvnGet(Qv(),3600,0,0.01,null,"")',env);
  assert.strictEqual(E.cl.length,2);
  const lo=E.cl.find(z=>z.pp<105),hi=E.cl.find(z=>z.pp>105);
  vm.runInContext('drawHVN(600,1000)',env);
  assert.strictEqual(lo.tc,null);assert.strictEqual(hi.tc,3600);ok('drawHVN: vùng 100 chưa chạm; vùng 110 bị giá nhảy qua ở nến t=3600');
  assert.strictEqual(hi.sd,1);assert.strictEqual(hi.out,'b');assert.strictEqual(lo.sd,0);ok('side/outcome: vùng 110 là kháng cự và bị phá; vùng 100 (giá đóng cuối chu kỳ nằm trong vùng) trung tính');
  // chu kỳ volume thấp bị loại: 3 chu kỳ [6000,600,600] -> trung vị 600; đặt ngưỡng 200% thì chỉ còn chu kỳ lớn không bị loại... kiểm tra không lỗi
  calls.length=0;a.p.mpv=200;vm.runInContext('drawHVN(600,1000)',env);ok('mpv lớn không gây lỗi ('+calls.filter(c=>c[0]==='fillRect').length+' fillRect)');
  a.p.mpv=30;a.p.meth='level';calls.length=0;vm.runInContext('drawHVN(600,1000)',env);assert(calls.length>0);ok('chế độ level vẫn vẽ được');
}
console.log('\n'+n+' kiểm tra đạt');
