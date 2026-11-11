/* Khung giờ tuỳ chọn: kiểm tra hợp lệ / tên / danh sách dùng chung (core.js) và phần dựng nến giây (chart.js: bucket, sbBuild, sbJoin). */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const J=require('path').join(__dirname,'..','js')+'/';
const store={};
const ctx={console,Math,Date,JSON,Map,Set,Number,Array,Object,String,Promise,RegExp,
  location:{search:''},URLSearchParams,matchMedia:()=>({matches:true}),
  localStorage:{getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)}}};
vm.createContext(ctx);
const strip=s=>s.replace(/\bconst (\w+)=/g,'var $1=').replace(/^let /gm,'var ');
vm.runInContext(strip(fs.readFileSync(J+'core.js','utf8')),ctx);
const run=c=>vm.runInContext(c,ctx);
let n=0;const ok=x=>console.log('ok  ',x)||n++;

// hợp lệ
for(const s of [1,5,30,59,60,420,5400,7200,259200,604800,1209600])assert(run(`okTf(${s})`),s+' phải hợp lệ');
for(const s of [0,-5,61,90,100,2419201,1.5,NaN])assert(!run(`okTf(${s})`),s+' phải bị từ chối');
ok('okTf: 1–59 giây hoặc bội số 60 giây, tối đa 4 tuần');

// tên
const nm=s=>run(`tfName(${s})`);
assert.deepStrictEqual([nm(60),nm(900),nm(604800),nm(5),nm(420),nm(7200),nm(259200),nm(1209600),nm(5400)],['M1','M15','W1','S5','M7','H2','D3','W2','M90']);
ok('tfName: S5 M7 H2 D3 W2 M90, khung có sẵn giữ tên cũ');

// danh sách tuỳ chọn dùng chung: lọc trùng khung có sẵn, khung sai, sắp xếp
store.tp_ctf=JSON.stringify([420,15,900,61,420,5]);run('loadCtf()');
assert.strictEqual(run('JSON.stringify(CTF)'),'[5,15,420]');
assert.deepStrictEqual(run('allTfs().map(t=>t[0]).join()'),'S5,S15,M1,M5,M7,M15,M30,H1,H4,D1,W1');
ok('loadCtf/allTfs: bỏ trùng + khung sai, sắp theo độ dài');
run('CTF.push(30);saveCtf()');assert.deepStrictEqual(JSON.parse(store.tp_ctf),[5,15,420,30]);
ok('saveCtf ghi vào tp_ctf (dùng chung mọi chart)');

// khung đã lưu trong localStorage không hợp lệ thì về M15
store.tp_tf='61';const c2={...ctx};vm.createContext(c2);vm.runInContext(strip(fs.readFileSync(J+'core.js','utf8')),c2);
assert.strictEqual(vm.runInContext('C.tf',c2),900);ok('C.tf không hợp lệ -> M15');
store.tp_tf='7';const c3={...ctx};vm.createContext(c3);vm.runInContext(strip(fs.readFileSync(J+'core.js','utf8')),c3);
assert.strictEqual(vm.runInContext('C.tf',c3),7);ok('C.tf giây tuỳ chọn được giữ');

// chart.js: lấy đúng các hàm thuần
const src=fs.readFileSync(J+'chart.js','utf8');
const pick=re=>{const m=re.exec(src);assert(m,'không thấy '+re);return m[0]};
const code=[pick(/const bucket=.*\n/),pick(/function sbBuild\(T\)\{[\s\S]*?\n\}\n/),pick(/function sbJoin\(a,b\)\{[\s\S]*?\n\}\n/)].join('\n');
const k={Math};vm.createContext(k);
vm.runInContext('var sbOff=u=>0;'+code.replace(/\bconst bucket/,'var bucket'),k);
const B=(t,tf)=>vm.runInContext(`bucket(${t},${tf})`,k);
assert.strictEqual(B(1000,60),960);assert.strictEqual(B(1000,420),840);               // 420s = 7 phút, mốc theo epoch
assert.strictEqual(B(345600+604800*3+5,604800),345600+604800*3);                   // W1 vẫn bắt đầu thứ Hai
assert.strictEqual(B(345600+1209600*2+9999,1209600),345600+1209600*2);             // 2 tuần cũng neo vào thứ Hai
assert.strictEqual(B(86400*7+5,259200),Math.floor((86400*7+5)/259200)*259200);     // 3 ngày
ok('bucket: phút/giờ/ngày tuỳ chọn, tuần (và bội số tuần) neo thứ Hai');

const T=[[1000,100000],[1400,100200],[1999,99900],[2000,100100],[2500,100300],[5100,100000]];   // [ms, giá*1e5]
const S=vm.runInContext(`sbBuild(${JSON.stringify(T)})`,k);
assert.deepStrictEqual(JSON.parse(JSON.stringify(S)),[[1,1,1.002,.999,.999,3],[2,1.001,1.003,1.001,1.003,2],[5,1,1,1,1,1]]);
ok('sbBuild: gom tick bid thành nến 1 giây (o/h/l/c + số tick)');
const J2=JSON.parse(JSON.stringify(vm.runInContext(`sbJoin([[1,1,1.5,.9,1.2,2],[2,1.2,1.3,1.1,1.25,3]],[[2,9,9.5,.1,9.9,4],[3,1,1,1,1,1]])`,k)));
assert.deepStrictEqual(J2,[[1,1,1.5,.9,1.2,2],[2,1.2,9.5,.1,9.9,7],[3,1,1,1,1,1]]);
ok('sbJoin: nến 1 giây vắt qua ranh giới được gộp đúng (open cũ, close mới, volume cộng)');

// nến giây -> khung 5s: gom đúng
const agg=vm.runInContext(`(()=>{const sb=[[10,1,2,.5,1.5,1],[11,1.5,3,1,2,1],[14,2,2.5,1.8,2.2,2],[15,2.2,2.3,2.1,2.2,1]];const raw=[];let cur=null;
 for(const x of sb){const k=bucket(x[0],5);if(!cur||cur.st!==k){cur={st:k,open:x[1],high:x[2],low:x[3],close:x[4],v:x[5]};raw.push(cur)}else{if(x[2]>cur.high)cur.high=x[2];if(x[3]<cur.low)cur.low=x[3];cur.close=x[4];cur.v+=x[5]}}return JSON.stringify(raw)})()`,k);
assert.deepStrictEqual(JSON.parse(agg),[{st:10,open:1,high:3,low:.5,close:2.2,v:4},{st:15,open:2.2,high:2.3,low:2.1,close:2.2,v:1}]);
ok('gom nến 1 giây thành khung 5 giây');
console.log('\n'+n+' kiểm tra đạt');
