/* Phần thuần của Goldbach Levels (js/goldbach.js, trước dòng "vẽ"): Decimate, PO3 tự động, range, level, fractal */
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const full=fs.readFileSync(path.join(__dirname,'..','js','goldbach.js'),'utf8'),pure=full.split('/* ===== vẽ ===== */')[0];
const ctx={Math,Number,Array,String,isFinite,Infinity,JSON};vm.createContext(ctx);
vm.runInContext(pure.replace(/\bconst (\w+)=/g,'var $1=').replace(/\bconst (\w+),/g,'var $1,'),ctx);
let n=0;const ok=x=>console.log('ok  ',x)||n++;const run=c=>vm.runInContext(c,ctx);const J=x=>JSON.parse(JSON.stringify(x));
const near=(a,b,e=1e-9)=>assert.ok(Math.abs(a-b)<e,a+' != '+b);

// ---------- phân nhóm level ----------
assert.deepStrictEqual(J(run('[3,11,89,97].map(gbKind)')),['liq','liq','liq','liq']);
assert.deepStrictEqual(J(run('[17,83].map(gbKind)')),['gip','gip']);
assert.deepStrictEqual(J(run('[23,29,35,65,71,77].map(gbKind)')),Array(6).fill('flow'));
assert.deepStrictEqual(J(run('[41,47,50,53,59].map(gbKind)')),Array(5).fill('reb'));
assert.strictEqual(run('gbLbl(3)'),'[03]');assert.strictEqual(run('gbLbl(97)'),'[97]');assert.strictEqual(run('gbLbl(50)'),'[50]');
assert.strictEqual(run('GB_LVL.length'),16);assert.strictEqual(run('GB_ALL.length'),18);
ok('gbKind / gbLbl: 4 nhóm màu và nhãn [03]..[97]');

// ---------- Decimate ----------
assert.strictEqual(run('gbDec("XAUUSD",2650,0)'),1);assert.strictEqual(run('gbDec("EURUSD",1.08,0)'),10000);
assert.strictEqual(run('gbDec("USDJPY",150.2,0)'),100);assert.strictEqual(run('gbDec("BTCUSD",65000,0)'),1);
assert.strictEqual(run('gbDec("US30",42000,0)'),1);assert.strictEqual(run('gbDec("EURUSD",1.08,7)'),7);
ok('gbDec: tự đoán Forex 10000, JPY 100, vàng/chỉ số/crypto 1; giá trị > 0 được tôn trọng');

// ---------- PO3 tự động ----------
const AQ={aY:'6561',aQ:'6561',aMo:'6561',aW:'2187',aD:'729',a4:'729',a1h:'243',a15:'81',a3:'27',a1:'27'};ctx.AQ=AQ;
const au=tf=>run('gbAutoPo3('+tf+',AQ)');
assert.strictEqual(au(60),27);assert.strictEqual(au(120),27);assert.strictEqual(au(180),27);assert.strictEqual(au(300),27);
assert.strictEqual(au(900),81);assert.strictEqual(au(1800),81);assert.strictEqual(au(3600),243);assert.strictEqual(au(14400),729);
assert.strictEqual(au(86400),729);assert.strictEqual(au(604800),2187);assert.strictEqual(au(2592000),6561);
ctx.AQ=Object.assign({},AQ,{a15:'243',aD:'27'});assert.strictEqual(au(1800),243);assert.strictEqual(au(86400),27);
ok('gbAutoPo3: bảng khung giờ -> PO3, đọc theo cài đặt');

// ---------- range ----------
let R=run('gbRanges(2650,81,1,0,2)');
assert.strictEqual(R.baseLow,2592);assert.strictEqual(R.sz,81);assert.strictEqual(R.list.length,5);
assert.deepStrictEqual(J(R.list.map(r=>r.k)),[-2,-1,0,1,2]);assert.deepStrictEqual(J(R.list.map(r=>r.lo)),[2430,2511,2592,2673,2754]);
R=run('gbRanges(2673,81,1,0,0)');assert.strictEqual(R.baseLow,2673);assert.strictEqual(R.list.length,1);           // đúng biên dưới
R=run('gbRanges(2672.99,81,1,0,0)');assert.strictEqual(R.baseLow,2592);
ok('gbRanges: range chứa giá, ± n range, biên dưới thuộc range trên');
R=run('gbRanges(1.0850,81,10000,0,1)');near(R.sz,0.0081);near(R.baseLow,1.0773);                                   // 10850 -> floor(10850/81)=133 -> 10773
near(R.list[0].lo,1.0692);near(R.list[2].lo,1.0854);
ok('gbRanges: Decimate cho Forex');
R=run('gbRanges(2650,81,1,0.5,0)');near(R.baseLow,Math.floor((2650-40.5)/81)*81+40.5);
assert.ok(R.baseLow<=2650&&2650<R.baseLow+R.sz);
ok('gbRanges: Shift Range dịch lưới nhưng giá vẫn nằm trong range');
assert.strictEqual(run('gbRanges(NaN,81,1,0,2)'),null);assert.strictEqual(run('gbRanges(100,0,1,0,2)'),null);assert.strictEqual(run('gbRanges(100,81,0,0,2)'),null);
ok('gbRanges: đầu vào sai trả null');

// ---------- level ----------
const Lv=J(run('gbLevels(100,100,true)'));
assert.strictEqual(Lv.length,17);assert.deepStrictEqual(Lv.map(l=>l.p),[3,11,17,23,29,35,41,47,50,53,59,65,71,77,83,89,97]);
assert.strictEqual(Lv[0].y,103);assert.strictEqual(Lv[16].y,197);assert.strictEqual(Lv[8].y,150);
assert.strictEqual(run('gbLevels(0,1,false)').length,16);
ok('gbLevels: 16 level + EQ [50], đúng vị trí theo % của range');

// ---------- fractal ----------
const F=J(run('gbChild(2650,2592,81)'));near(F.sz,27);near(F.lo,2646);assert.ok(F.lo<=2650&&2650<F.lo+F.sz);
const F2=J(run('gbChild(2592,2592,81)'));near(F2.lo,2592);
ok('gbChild: range con PO3/3 chứa giá');

console.log('\n'+n+' nhóm kiểm thử đạt');
