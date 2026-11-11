/* Phần thuần của Killzones & Pivots (js/killzones.js, trước dòng "vẽ"): đọc cài đặt, phiên, pivot, range level, D/W/M, giờ mở cửa */
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const full=fs.readFileSync(path.join(__dirname,'..','js','killzones.js'),'utf8'),pure=full.split('/* ===== vẽ ===== */')[0];
const ctx={Math,Number,Array,Set,Map,String,Float64Array,Uint8Array,Date,isFinite,Infinity,parseFloat,RegExp,JSON};vm.createContext(ctx);
vm.runInContext(pure.replace(/\bconst (\w+)=/g,'var $1=').replace(/\bconst (\w+),/g,'var $1,'),ctx);
let n=0;const ok=x=>console.log('ok  ',x)||n++;const run=c=>vm.runInContext(c,ctx);const J=x=>JSON.parse(JSON.stringify(x));

// ---------- đọc cài đặt ----------
assert.deepStrictEqual(J(run('kzSes("2000-0000")')),[1200,0]);
assert.deepStrictEqual(J(run('kzSes("09:30-11:00")')),[570,660]);
assert.deepStrictEqual(J(run('kzSes("930-1100")')),[570,660]);
assert.deepStrictEqual(J(run('kzSes("0000-2400")')),[0,1440]);
assert.strictEqual(run('kzSes("abc")'),null);assert.strictEqual(run('kzSes("2560-0000")'),null);
ok('kzSes: HHMM-HHMM, có dấu hai chấm, 3 chữ số, 2400; sai thì null');
assert.strictEqual(run('kzIn(1300,[1200,0])'),true);assert.strictEqual(run('kzIn(30,[1200,0])'),false);
assert.strictEqual(run('kzIn(30,[1380,120])'),true);assert.strictEqual(run('kzIn(700,[570,660])'),false);assert.strictEqual(run('kzIn(570,[570,660])'),true);assert.strictEqual(run('kzIn(660,[570,660])'),false);
ok('kzIn: phiên thường, qua nửa đêm, biên [bắt đầu, kết thúc)');
assert.strictEqual(run('kzColor("red","#000000")'),'#f23645');assert.strictEqual(run('kzColor("#AbCdEf","#000000")'),'#abcdef');
assert.strictEqual(run('kzColor("#abcdef80","#000000")'),'#abcdef');assert.strictEqual(run('kzColor("zzz","#123456")'),'#123456');assert.strictEqual(run('kzColor("","#123456")'),'#123456');
ok('kzColor: tên Pine, hex 6/8 ký tự, mặc định khi sai');
const P0=()=>({u1:true,n1:"ASIA",s1:"2000-0000",u2:true,n2:"NYAM",s2:"0930-1100",u3:false,n3:"x",s3:"bad",u4:false,n4:"",s4:"",u5:false,n5:"",s5:"",u6:true,n6:"",s6:"zz",
  lvl:"0.5\n// 1.5\n2.0, purple\nabc\n-1",otxt:"0930, red, NY Open\n// 0000\n1200\n9x30, blue",ttxt:"0930, green\n1200\nxx",cut:true,cutS:"1800-1801",tz:"GMT+7",tfl:"1800"});
ctx.P0=P0();const Q=J(run('kzParse(P0,["#111111","#222222"])'));
assert.strictEqual(Q.kz[0].name,'ASIA');assert.deepStrictEqual(Q.kz[0].rg,[1200,0]);assert.strictEqual(Q.kz[3].on,false);
assert.strictEqual(Q.kz[5].on,true);assert.strictEqual(Q.kz[5].rg,null);assert.strictEqual(Q.kz[5].name,'KZ6');
assert.strictEqual(Q.bad.ses,1);                                  // chỉ tính killzone đang bật mà phiên sai
assert.deepStrictEqual(Q.lv.map(x=>x.mult),[0.5,2]);assert.strictEqual(Q.lv[1].col,'#9c27b0');assert.strictEqual(Q.lv[0].col,null);assert.strictEqual(Q.bad.levels,2);
assert.strictEqual(Q.op.length,2);assert.strictEqual(Q.op[0].col,'#f23645');assert.strictEqual(Q.op[0].txt,'NY Open');assert.strictEqual(Q.op[1].col,'#111111');assert.strictEqual(Q.op[1].tip,'1200 Open');assert.strictEqual(Q.bad.opens,1);
assert.strictEqual(Q.st.length,2);assert.strictEqual(Q.st[1].col,'#222222');assert.strictEqual(Q.bad.stamps,1);
assert.strictEqual(Q.gmt,7);assert.deepStrictEqual(Q.cutR,[1080,1081]);assert.strictEqual(Q.tfl,1800);
ok('kzParse: killzone, level, giờ mở cửa, timestamp, GMT, cutoff, đếm dòng lỗi');

// ---------- dữ liệu mẫu: nến M30 liên tục, giờ "đồng hồ" = st (wall = st) ----------
const TF=1800,DAY=86400;
const mkBars=(days,fn)=>{const B=[];for(let d=0;d<days;d++)for(let i=0;i<48;i++){const st=d*DAY+i*TF,v=fn(d,i,st);B.push(Object.assign({st},v))}return B};
// giá phẳng 100, trừ đỉnh/đáy ghi đè
const flat=(d,i)=>({open:100,high:101,low:99,close:100});
ctx.wall=st=>st;ctx.bucket=(t,tf)=>Math.floor(t/tf)*tf;ctx.monthKey=st=>Math.floor(st/DAY/30);
const baseQ=(o)=>Object.assign(run('kzParse')(Object.assign(P0(),{u1:false,u6:false,u2:true,s2:"0930-1100",n2:"NYAM"}),["#111111","#222222"]),{piv:true,maxd:3,extw:"recent",ext:"mit",cut:false,cutR:null,lbk:20,meas:"Average",lv_on:false,opn:false,tsh:false,dow:false,
  dopen:false,dhl:false,dmid:false,dsep:false,wopen:false,whl:false,wmid:false,wsep:false,mopen:false,mhl:false,mmid:false,msep:false},o||{});
const build=(B,Q,tf)=>{ctx.B=B;ctx.Q=Q;return run('kzBuild(B,Q,{wall,bucket,monthKey,lookup:null,tf:'+(tf||TF)+'})')};

// ---------- phiên + pivot ----------
{const B=mkBars(4,(d,i)=>{const o=flat(d,i);if(d===0&&i===20)o.high=105;if(d===0&&i===21)o.low=95;       // ngày 0: NYAM 09:30 = bar 19, 11:00 = bar 22 (loại)
    if(d===1&&i===30)o.high=106;if(d===2&&i===5)o.low=94;return o});
  const M=build(B,baseQ());const S=M.kz[1].S;
  assert.strictEqual(S.length,4);assert.strictEqual(S[0].i0,19);assert.strictEqual(S[0].i1,21);                 // 09:30, 10:00, 10:30
  assert.strictEqual(S[0].hi,105);assert.strictEqual(S[0].hiI,20);assert.strictEqual(S[0].lo,95);assert.strictEqual(S[0].loI,21);
  ok('kzSessions: ranh giới phiên, đỉnh/đáy và nến chạm đỉnh/đáy đầu tiên');
  // chế độ mặc định (Most Recent): chỉ theo dõi đến nến 66, trước phiên kế (nến 67), nên cú phá ở nến 78 chưa tính
  assert.strictEqual(S[0].hiB,-1);assert.strictEqual(S[0].loB,-1);assert.strictEqual(S[0].scan,66);ok('pivot (Most Recent): không tính cú phá sau khi phiên kế đã bắt đầu');
  }
{const B=mkBars(4,(d,i)=>{const o=flat(d,i);if(d===0&&i===20)o.high=105;if(d===0&&i===21)o.low=95;if(d===1&&i===5)o.high=106;if(d===2&&i===30)o.low=94;return o});
  let M=build(B,baseQ({extw:"recent"}));let s=M.kz[1].S[0];
  assert.strictEqual(s.hiB,48+5);assert.strictEqual(s.loB,-1);assert.strictEqual(s.scan,48+19-1);
  assert.strictEqual(s.hiE,48+5);assert.strictEqual(s.loE,s.scan);ok('Most Recent: chỉ quét đến nến trước phiên kế; low 95 chưa bị phá nên đường đến hết cửa sổ');
  M=build(B,baseQ({extw:"all",maxd:3}));s=M.kz[1].S[0];
  assert.strictEqual(s.loB,2*48+30);assert.strictEqual(s.loE,2*48+30);assert.strictEqual(s.scan,3*48+19-1);ok('All: quét qua các phiên sau đến khi bị Session Limit loại');
  M=build(B,baseQ({extw:"all",maxd:2}));s=M.kz[1].S[0];assert.strictEqual(s.loB,-1);assert.strictEqual(s.scan,2*48+19-1);
  ok('All + maxd=2: phiên cũ bị loại khi phiên thứ 3 bắt đầu nên không bắt được cú phá sau đó');
  M=build(B,baseQ({extw:"all",maxd:3,ext:"past"}));s=M.kz[1].S[0];assert.strictEqual(s.hiB,48+5);assert.strictEqual(s.hiE,s.scan);ok('Qua điểm bị phá: đường vẫn kéo tới hết cửa sổ');
  M=build(B,baseQ({extw:"all",maxd:3,cut:true,cutR:[180,210]}));s=M.kz[1].S[0];                                  // cutoff 03:00-03:30 ngày 1 = nến 54, sau cú phá ở nến 53
  assert.strictEqual(s.scan,54);assert.strictEqual(s.hiB,48+5);ok('Cutoff: dừng ở nến cutoff đầu tiên, nến đó vẫn xét phá');
  M=build(B,baseQ({extw:"all",maxd:3,cut:true,cutR:[780,810]}));s=M.kz[1].S[0];assert.strictEqual(s.scan,26);assert.strictEqual(s.hiB,-1);assert.strictEqual(s.hiE,26);
  ok('Cutoff trước khi bị phá: pivot trượt, đường dừng tại nến cutoff');
  const H=M.kz[1].H;assert.strictEqual(H.hi.length,4);ok('Thống kê: mỗi phiên một phần tử lịch sử');
  // midpoint: kéo đến trước phiên kế rồi lùi về nến cuối không thuộc phiên
  M=build(B,baseQ({extw:"recent"}));s=M.kz[1].S[0];assert.strictEqual(s.mid,100);assert.strictEqual(s.midE,48+19-1);ok('Midpoint: kéo đến nến cuối không thuộc phiên');
}
// phiên qua nửa đêm + tách theo ngày
{const B=mkBars(3,flat);const Qm=baseQ({});Qm.kz[0]={on:true,name:"ASIA",rg:[1200,0]};Qm.kz[1]={on:false,name:"x",rg:null};const M=build(B,Qm);const S=M.kz[0].S;
  assert.strictEqual(S.length,3);assert.strictEqual(S[0].i0,40);assert.strictEqual(S[0].i1,47);assert.strictEqual(S[1].i0,88);ok('Phiên 20:00-00:00: mỗi ngày một phiên 8 nến M30');
  const Qm2=baseQ({});Qm2.kz[0]={on:true,name:"X",rg:[1380,120]};Qm2.kz[1]={on:false,name:"x",rg:null};const S2=build(B,Qm2).kz[0].S;
  assert.strictEqual(S2[0].i0,0);assert.strictEqual(S2[0].i1,3);assert.strictEqual(S2[1].i0,46);assert.strictEqual(S2[1].i1,51);assert.strictEqual(S2.length,4);assert.strictEqual(S2[3].i0,142);
  ok('Phiên 23:00-02:00: không bị cắt đôi ở nửa đêm, nến sớm của ngày đầu thành phiên riêng');}

// ---------- đo range + Range Levels ----------
{const B=mkBars(5,(d,i)=>{const o={open:100,high:101,low:99,close:100};if(i>=19&&i<=21){o.high=100+(d+1);o.low=100-(d+1)}return o});          // range phiên d = 2(d+1)
  ctx.S0=build(B,baseQ()).kz[1].S;
  assert.deepStrictEqual(J(ctx.S0.map(s=>s.rg)),[2,4,6,8,10]);
  assert.strictEqual(run('kzMeasure(S0,3,20,"Average")'),4);assert.strictEqual(run('kzMeasure(S0,4,2,"Average")'),7);assert.strictEqual(run('kzMeasure(S0,4,20,"Median")'),5);
  assert.strictEqual(run('kzMeasure(S0,0,20,"Average")'),null);ok('kzMeasure: trung bình / trung vị / lookback / chưa có phiên');
  ctx.SS=[{rg:1,sd:[1,-1]},{rg:1,sd:[2,-2]}];const sd=run('kzMeasure(SS,2,20,"Standard Deviation")');assert(Math.abs(sd-Math.sqrt(2.5))<1e-12);assert.strictEqual(run('kzMeasure([{rg:1,sd:[3]}],1,20,"Standard Deviation")'),null);ok('kzMeasure: độ lệch chuẩn tổng thể trên mọi mẫu, null khi dưới 2 mẫu');
  const M=build(B,baseQ({lv_on:true,lv:[{mult:0.5,col:null},{mult:1,col:null}]}));const S=M.kz[1].S,LH=M.kz[1].LH;
  assert.strictEqual(S[0].lv,null);assert.strictEqual(S[1].m,2);                                                    // phiên 1: trung bình của phiên 0 = 2
  assert.strictEqual(S[1].lv[0].hiP,101);assert.strictEqual(S[1].lv[0].loP,99);assert.strictEqual(S[1].lv[1].hiP,102);
  assert.strictEqual(S[1].lv[0].hB,48+19);                                                                           // high 101... phiên 1 high=102 >= 101 ngay nến đầu
  assert.strictEqual(S[1].lv[1].hB,48+19);assert.strictEqual(S[1].lv[0].end,48+21);
  assert.strictEqual(LH[0].hi.length,4);ok('Range levels: bỏ phiên chưa đủ dữ liệu, mức = open ± mult × số đo, hit ở nến đầu tiên chạm, sống đến hết phiên');}

// ---------- D / W / M ----------
{const B=mkBars(6,(d,i)=>({open:100+d,high:101+d,low:99+d,close:100+d}));ctx.B6=B;
  const M=build(B,baseQ({dhl:true,dmid:true,dopen:true,piv:false}));const D=M.dwm.D;
  assert.strictEqual(D.P.length,6);assert.strictEqual(D.P[1].ph,101);assert.strictEqual(D.P[1].pl,99);assert.strictEqual(D.P[1].pm,100);
  assert.strictEqual(D.P[1].hB,48+0);                                                                                   // high 102 > 101 ngay nến đầu của ngày 1
  assert.strictEqual(D.P[1].lB,-1);assert.strictEqual(D.hiH.length,5);assert.strictEqual(D.loH.filter(Boolean).length,0);
  ok('D/W/M: high/low/mid kỳ trước, nến đầu tiên phá, lịch sử hit');
  assert.strictEqual(M.dwm.W,undefined);ok('Loại không bật thì không tính');}

// ---------- giờ mở cửa + timestamp + thứ ----------
{const B=mkBars(3,flat);ctx.look=T=>T%DAY===9*3600+30*60?123.45:null;
  const Q2=baseQ({opn:true,ohist:"limit",maxd:2,tsh:true,thist:"recent",dow:true,dowx:"mn",dowh:true,piv:false});Q2.op=[{min:570,col:'#ff0000',txt:'NY Open',tip:'x'}];Q2.st=[{min:720,col:'#00ff00'}];
  ctx.B=B;ctx.Q=Q2;const M=run('kzBuild(B,Q,{wall,bucket,monthKey,lookup:look,tf:1800})');
  assert.strictEqual(M.opens[0].L.length,2);assert.strictEqual(M.opens[0].L[1].price,123.45);assert.strictEqual(M.opens[0].L[1].i0,2*48+19);
  assert.strictEqual(M.opens[0].L[0].i1,2*48+19-1);assert.strictEqual(M.opens[0].L[1].i1,B.length-1);ok('Giá mở cửa: lấy từ M1, đường kéo đến lần mở kế tiếp, giới hạn theo maxd');
  assert.deepStrictEqual(J(M.stamps[0].L),[2*48+24]);ok('Timestamp: nến chứa phút 12:00, Most Recent chỉ giữ một');
  ctx.B=B;Q2.st=[];Q2.op=[{min:575,col:'#ff0000',txt:'',tip:''}];const M2=run('kzBuild(B,Q,{wall,bucket,monthKey,lookup:null,tf:1800})');
  assert.strictEqual(M2.opens[0].L.length,0);ok('Giờ mở cửa lệch nến mà không có M1: bỏ qua thay vì lấy giá sai');
  assert.strictEqual(M.dow.length,1);assert.strictEqual(M.dow[0].txt,'FRIDAY');assert.strictEqual(M.dow[0].i,48);ok('Nhãn thứ: ngày 0 = Thứ Năm, ngày 1 = Thứ Sáu, ngày 2 = Thứ Bảy bị ẩn');}

// ---------- tiện ích hiển thị ----------
assert.strictEqual(run('kzPct(3,4)'),'75%');assert.strictEqual(run('kzPct(0,0)'),'-');
assert.strictEqual(run('kzEvents([true,false,true],20)'),'🟩🟥🟩');
assert.strictEqual(run('kzEvents(Array.from({length:12},()=>true),20)').split('\n').length,2);ok('kzPct, kzEvents (xuống dòng mỗi 10 mục)');
console.log('\n'+n+' nhóm kiểm thử đạt');
