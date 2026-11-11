const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const J=path.join(__dirname,'..','js')+'/';
const full=fs.readFileSync(J+'orderflow-dom.js','utf8'),pure=full.split('/* ===== vẽ ===== */')[0];
const strip=s=>s.replace(/\bconst (\w+)=/g,'var $1=');
const ctx={Math,Number,Array,Map,Set,String,isFinite,Infinity,Date};vm.createContext(ctx);
vm.runInContext(strip(pure),ctx);
let n=0;const ok=x=>console.log('ok  ',x)||n++;const run=c=>vm.runInContext(c,ctx);
const J2=x=>JSON.parse(JSON.stringify(x));
const E=(p,nq,dq)=>({newQuotes:nq||[],deletedQuotes:dq||[]});

// domNice
assert.strictEqual(run('domNice(0.125)'),0.2);assert.strictEqual(run('domNice(0.3)'),0.5);assert.strictEqual(run('domNice(0.01)'),0.01);assert.strictEqual(run('domNice(7)'),10);
ok('domNice: làm tròn lên 1/2/5');

// domApply: ảnh chụp đầu tiên không tạo "thay đổi", tuổi chưa biết
ctx.S={q:new Map(),ch:[],seen:false};
run('domApply(S,{newQuotes:[{id:1,size:500,bid:200000},{id:2,size:300,bid:199900},{id:3,size:400,ask:200100}]},1000)');
assert.strictEqual(ctx.S.q.size,3);assert.strictEqual(ctx.S.ch.length,0);assert.strictEqual(ctx.S.q.get('1').t0,0);
ok('domApply: ảnh chụp đầu không ghi thay đổi, t0 = 0');

// thêm lệnh mới, tăng/giảm size, xoá
run('domApply(S,{newQuotes:[{id:4,size:100,ask:200200},{id:1,size:800,bid:200000}],deletedQuotes:[3]},2000)');
assert.strictEqual(ctx.S.q.size,3);assert.strictEqual(ctx.S.q.get('1').size,800);assert.strictEqual(ctx.S.q.get('4').t0,2000);
const ch=J2(ctx.S.ch);
assert.deepStrictEqual(ch.map(c=>[c.p,c.s,c.d]).sort(),[[200000,1,300],[200100,-1,-400],[200200,-1,100]].sort());
ok('domApply: thêm / đổi size / xoá ghi đúng thay đổi theo giá và phía');

// đổi giá của cùng ID = rút lệnh cũ + đặt lệnh mới
ctx.S.ch.length=0;
run('domApply(S,{newQuotes:[{id:2,size:300,bid:199800}]},2500)');
assert.deepStrictEqual(J2(ctx.S.ch).map(c=>[c.p,c.d]),[[199900,-300],[199800,300]]);
assert.strictEqual(ctx.S.q.get('2').t0,2500);
ok('domApply: đổi giá cùng ID tính là rút + đặt lại');

// size 0 hoặc thiếu giá = xoá
run('domApply(S,{newQuotes:[{id:2,size:0,bid:199800},{id:9,size:50}]},2600)');
assert(!ctx.S.q.has('2'));assert(!ctx.S.q.has('9'));
ok('domApply: size 0 / không có giá thì bỏ');

// cắt lịch sử thay đổi > 6s
run('domApply(S,{newQuotes:[{id:5,size:10,bid:199000}]},20000)');
assert(ctx.S.ch.every(c=>c.t>=14000));
ok('domApply: bỏ thay đổi cũ hơn 6 giây');

// domBuild: gộp theo bước, tách từng lệnh, lệnh lớn trước
ctx.Q=new Map([['a',{size:500,bid:200030,ask:0,t0:100}],['b',{size:300,bid:200090,ask:0,t0:0}],['c',{size:200,bid:0,ask:200130,t0:0}]]);
const B=J2(run('(()=>{const r=domBuild(Q,100,100,1100);return{arr:r.arr,nb:r.nb,na:r.na,sb:r.sb,sa:r.sa}})()'));
assert.strictEqual(B.nb,2);assert.strictEqual(B.na,1);assert.strictEqual(B.sb,8);assert.strictEqual(B.sa,2);
assert.deepStrictEqual(B.arr.map(L=>[L.p,L.bid,L.ask]),[[200000,8,0],[200100,0,2]]);
assert.deepStrictEqual(B.arr[0].bo,[5,3]);assert.strictEqual(B.arr[0].age,1000);
ok('domBuild: gộp mức giá, tách từng lệnh (MBO), tuổi lệnh');

// domThr
const L=(...v)=>v.map(x=>({bid:x,ask:0}));
assert.strictEqual(run('domThr([],2,0)'),Infinity);
ctx.A1=L(1,1,1,1,1,1,1,1,1,1);assert.strictEqual(run('domThr(A1,2,0)'),Infinity);
ctx.A2=L(1,1,1,1,1,1,1,1,1,20);const t=run('domThr(A2,2,0)');assert(t>1&&t<20);
assert.strictEqual(run('domThr(A2,2,50)'),50);
ok('domThr: ít mức / đều tăm tắp thì không có mức mạnh; mức nổi bật vượt ngưỡng; có size tối thiểu');

// domFlow
ctx.S2={ch:[{t:900,p:200030,d:300},{t:950,p:200050,d:-100},{t:100,p:200030,d:999},{t:990,p:200130,d:200}]};
const F=run('domFlow(S2,100,100,1000,200)');
assert.strictEqual(F.get(200000),2);assert.strictEqual(F.get(200100),2);assert.strictEqual(F.size,2);
ok('domFlow: cộng thay đổi theo mức giá trong cửa sổ thời gian');

console.log(n+' test pass');

// domSnap
ctx.Q2=new Map([['a',{size:500,bid:200030,ask:0}],['b',{size:300,bid:200090,ask:0}],['c',{size:200,bid:0,ask:200130}],['d',{size:100,bid:0,ask:900000}]]);
const SN=J2(run('domSnap(Q2,100,100,200060,5)')).sort((x,y)=>x[0]-y[0]||x[2]-y[2]);
assert.deepStrictEqual(SN,[[200000,8,1],[200100,2,-1]]);
console.log('ok   domSnap: gộp theo hàng/phía, bỏ mức ngoài khoảng');
