/* Phần thuần của Quarterly Theory (js/qt.js, trước dòng "vẽ"): mốc chu kỳ theo giờ New York và đổi giờ -> vị trí trên trục nến */
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const full=fs.readFileSync(path.join(__dirname,'..','js','qt.js'),'utf8'),pure=full.split('/* ===== vẽ ===== */')[0];
const ctx={Math,Number,Array,String,Date,isFinite,JSON};vm.createContext(ctx);
vm.runInContext(pure.replace(/\bconst (\w+)=/g,'var $1=').replace(/\bconst (\w+),/g,'var $1,'),ctx);
let n=0;const ok=x=>console.log('ok  ',x)||n++;const run=c=>vm.runInContext(c,ctx);const J=x=>JSON.parse(JSON.stringify(x));
const U=(y,m,d,h=0,mi=0)=>Date.UTC(y,m-1,d,h,mi)/1000;           // giờ treo tường New York dạng giây (tháng từ 1)
const ALL={hist:false,y:true,mo:true,w:true,d:true,m90:true,mc:true};ctx.ALL=ALL;
const lane=(now,o,id)=>{ctx.NOW=now;ctx.O=Object.assign({},ALL,o||{});return J(run('qtCycles(NOW,O)')).find(l=>l.id===id)};

// ---------- thứ Hai thứ n / thứ Hai của tuần ----------
assert.strictEqual(run('qtNthMon(2026,9,1)'),U(2026,10,5));      // 1/10/2026 là thứ Năm -> thứ Hai đầu là 5/10
assert.strictEqual(run('qtNthMon(2026,9,4)'),U(2026,10,26));
assert.strictEqual(run('qtNthMon(2026,10,1)'),U(2026,11,2));     // 1/11/2026 là Chủ Nhật -> thứ Hai là 2/11
assert.strictEqual(run('qtNthMon(2026,5,1)'),U(2026,6,1));       // 1/6/2026 đúng thứ Hai
assert.strictEqual(run('qtNthMon(2026,0,1)'),U(2026,1,5));       // 1/1/2026 là thứ Năm
ok('qtNthMon: thứ Hai đầu tiên khi ngày 1 rơi vào Chủ Nhật, thứ Hai, thứ Năm');
ctx.T1=U(2026,10,27,15,30);assert.strictEqual(run('qtMonday(T1)'),U(2026,10,26));                              // thứ Ba 27/10 15:30 -> thứ Hai 26/10 00:00
ctx.T2=U(2026,11,1,23,0);assert.strictEqual(run('qtMonday(T2)'),U(2026,10,26));                                // Chủ Nhật -> thứ Hai trước đó
ctx.T3=U(2026,10,26,0,0);assert.strictEqual(run('qtMonday(T3)'),U(2026,10,26));
ok('qtMonday: về 00:00 thứ Hai của tuần (sửa lỗi giữ nguyên giờ của bản Pine)');

// ---------- năm ----------
let L=lane(U(2026,10,27),{hist:false},'y');
assert.strictEqual(L.S.length,4);assert.deepStrictEqual(L.S.map(s=>s.q),[1,2,3,4]);
assert.strictEqual(L.S[0].a,U(2026,1,1));assert.strictEqual(L.S[1].a,U(2026,4,1));assert.strictEqual(L.S[2].a,U(2026,7,1));assert.strictEqual(L.S[3].a,U(2026,10,1));assert.strictEqual(L.S[3].b,U(2027,1,1));
assert.strictEqual(lane(U(2026,10,27),{hist:true},'y').S.length,16);
ok('qtCycles năm: 4 quý, lịch sử 3 năm trước');

// ---------- tháng ----------
L=lane(U(2026,10,27),{hist:false},'mo');                                                     // tháng trước + tháng này = 8 ô
assert.strictEqual(L.S.length,8);
const cur=L.S.find(s=>s.a<=U(2026,10,27)&&U(2026,10,27)<s.b);assert.strictEqual(cur.q,4);assert.strictEqual(cur.a,U(2026,10,26));assert.strictEqual(cur.b,U(2026,11,2));
for(let i=1;i<L.S.length;i++)assert.strictEqual(L.S[i].a,L.S[i-1].b);                         // liền mạch, không hở
assert.strictEqual(lane(U(2026,10,27),{hist:true},'mo').S.length,28);
// đầu tháng nhưng trước thứ Hai đầu tiên: ô đang chạy thuộc Q4 của tháng trước
const c2=lane(U(2026,10,2),{hist:false},'mo').S.find(s=>s.a<=U(2026,10,2)&&U(2026,10,2)<s.b);assert.strictEqual(c2.q,4);assert.strictEqual(c2.b,U(2026,10,5));
// qua năm
L=lane(U(2026,1,10),{hist:true},'mo');
assert.ok(L.S[0].a<U(2025,8,1)&&L.S[L.S.length-1].b>=U(2026,2,1));
ok('qtCycles tháng: 4 tuần theo thứ Hai, liền mạch, ô hiện tại đúng, qua năm');

// ---------- tuần ----------
L=lane(U(2026,10,27,15,0),{hist:false},'w');
assert.strictEqual(L.S.length,4);assert.strictEqual(L.S[0].a,U(2026,10,26));assert.strictEqual(L.S[3].b,U(2026,10,30));assert.deepStrictEqual(L.S.map(s=>s.q),[1,2,3,4]);
assert.strictEqual(lane(U(2026,10,27,15,0),{hist:true},'w').S.length,44);
ok('qtCycles tuần: Thứ 2 = A ... Thứ 5 = X, bắt đầu 00:00');

// ---------- ngày ----------
L=lane(U(2026,10,27,15,0),{hist:false},'d');
assert.strictEqual(L.S.length,4);assert.strictEqual(L.S[0].a,U(2026,10,26,18));assert.strictEqual(L.S[1].a,U(2026,10,27,0));assert.strictEqual(L.S[2].a,U(2026,10,27,6));assert.strictEqual(L.S[3].a,U(2026,10,27,12));assert.strictEqual(L.S[3].b,U(2026,10,27,18));
const at=(t,l)=>l.S.find(s=>s.a<=t&&t<s.b);
assert.strictEqual(at(U(2026,10,27,15),L).q,4);
L=lane(U(2026,10,27,20,0),{hist:false},'d');                                                // sau 18:00 vẫn có ô đang chạy
assert.strictEqual(at(U(2026,10,27,20),L).q,1);assert.strictEqual(at(U(2026,10,27,20),L).a,U(2026,10,27,18));
assert.strictEqual(at(U(2026,10,27,3),lane(U(2026,10,27,3),{},'d')).q,2);
assert.strictEqual(lane(U(2026,10,27,15,0),{hist:true},'d').S.length,44);
ok('qtCycles ngày: 4 khối 6 giờ từ 18:00, sau 18:00 chuyển sang ngày giao dịch kế');

// ---------- 90 phút / 22.5 phút ----------
L=lane(U(2026,10,27,15,0),{hist:false},'m90');
assert.strictEqual(L.S.length,16);assert.strictEqual(L.S[0].a,U(2026,10,26,18));assert.strictEqual(L.S[15].b,U(2026,10,27,18));
assert.deepStrictEqual(L.S.slice(0,5).map(s=>s.q),[1,2,3,4,1]);for(const s of L.S)assert.strictEqual(s.b-s.a,5400);
assert.strictEqual(lane(U(2026,10,27,15,0),{hist:true},'m90').S.length,96);
L=lane(U(2026,10,27,15,0),{hist:false},'mc');assert.strictEqual(L.S.length,64);for(const s of L.S)assert.strictEqual(s.b-s.a,1350);assert.strictEqual(L.S[63].b,U(2026,10,27,18));
assert.strictEqual(lane(U(2026,10,27,15,0),{hist:true},'mc').S.length,192);
ok('qtCycles 90 phút (16 ô/ngày) và 22.5 phút (64 ô/ngày), chu kỳ q 1-2-3-4');

// ---------- bật/tắt làn ----------
ctx.NOW=U(2026,10,27,15);ctx.O={hist:false,y:false,mo:false,w:true,d:false,m90:false,mc:false};
assert.deepStrictEqual(J(run('qtCycles(NOW,O).map(l=>l.id)')),['w']);
ctx.O={hist:false};assert.strictEqual(run('qtCycles(NOW,O).length'),0);
ok('qtCycles: chỉ trả các làn được bật');

// ---------- giờ -> trục nến ----------
ctx.A=[1000,1060,1120,1180];                                      // 4 nến M1 liên tục
const lg=t=>run('qtLogical(A,'+t+',60)');
assert.strictEqual(lg(1000),-.5);assert.strictEqual(lg(1030),0);assert.strictEqual(lg(1060),.5);assert.strictEqual(lg(1090),1);
assert.strictEqual(lg(1180),2.5);assert.strictEqual(lg(1240),3.5);assert.strictEqual(lg(1480),7.5);                 // tương lai: tuyến tính theo độ dài nến
assert.strictEqual(lg(940),-1.5);                                                                                  // trước nến đầu
ctx.A=[1000,1060,2000];                                            // khoảng trống giữa nến 2 và 3 (vd. cuối tuần)
assert.strictEqual(run('qtLogical(A,1500,60)'),1.5);assert.strictEqual(run('qtLogical(A,2000,60)'),1.5);
assert.strictEqual(run('qtLogical(A,1100,60)'),1+(40/60)-.5);
ok('qtLogical: vị trí trong nến, cạnh nến, tương lai, trước nến đầu, khoảng trống không bị kéo giãn');

console.log('\n'+n+' nhóm kiểm thử đạt');
