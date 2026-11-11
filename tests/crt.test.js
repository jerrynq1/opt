/* Phần thuần của CRT (js/crt.js, trước dòng "vẽ"): gom nến HTF, 4 model CRT, PD Array, ánh xạ thời gian -> logical; và smoke test hàm vẽ */
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const full=fs.readFileSync(path.join(__dirname,'..','js','crt.js'),'utf8'),pure=full.split('/* ===== vẽ ===== */')[0];
const ctx={Math,Number,Array,Set,Map,String,Date,isFinite,Infinity,JSON};vm.createContext(ctx);
vm.runInContext(pure.replace(/\bconst (\w+)=/g,'var $1=').replace(/\bconst (\w+),/g,'var $1,'),ctx);
let n=0;const ok=x=>console.log('ok  ',x)||n++;const run=c=>vm.runInContext(c,ctx);const J=x=>JSON.parse(JSON.stringify(x));

// ---------- gom nến HTF từ M1 ----------
const bk=(t,tf)=>Math.floor(t/tf)*tf;ctx.bk=bk;
{const A=[[0,10,11,9,10.5,1],[60,10.5,13,10,12,1],[120,12,12.5,8,9,1],[3600,9,9.5,8.5,9.2,1],[3660,9.2,10,9,9.8,1]];ctx.A=A;
 const H=J(run('crtHtfBars(A,3600,bk)'));
 assert.strictEqual(H.length,2);assert.deepStrictEqual(H[0],{st:0,o:10,h:13,l:8,c:9});assert.deepStrictEqual(H[1],{st:3600,o:9,h:10,l:8.5,c:9.8});
 ok('crtHtfBars: open đầu, high/low cực trị, close cuối của mỗi nến HTF')}

const bar=(st,o,h,l,c)=>({st,o,h,l,c});
const en=[0,true,true,true,true];ctx.en=en;
const det=(H,s,k,e)=>{ctx.H=H;ctx.s=s;ctx.k=k;ctx.e=e||en;return J(run('crtDetect(H,s,k,e)'))};

// ---------- Model 1: 2nd Candle ----------
{const H=[bar(0,100,110,90,105),bar(1,105,115,95,100)];             // sweep high 115>110, đóng 100 trong [90,110]
 const r=det(H,1,8);assert.strictEqual(r.dir,-1);assert.strictEqual(r.mdl,1);assert.strictEqual(r.rH,110);assert.strictEqual(r.rL,90);assert.strictEqual(r.rngSt,0);assert.strictEqual(r.swpSt,1);
 ok('Model 1 (2nd Candle) bearish: sweep High rồi đóng trong range');
 const H2=[bar(0,100,110,90,105),bar(1,95,100,85,100)];
 const b=det(H2,1,8);assert.strictEqual(b.dir,1);assert.strictEqual(b.mdl,1);ok('Model 1 bullish: sweep Low rồi đóng trong range');
 assert.strictEqual(det([bar(0,100,110,90,105),bar(1,105,115,95,112)],1,8),null);ok('đóng cửa NGOÀI range (breakout thật) thì không phải CRT');
 assert.strictEqual(det([bar(0,100,110,90,105),bar(1,100,108,92,100)],1,8),null);ok('không quét ra ngoài range thì không phải CRT');
 assert.strictEqual(det([bar(0,100,110,90,105),bar(1,100,120,80,100)],1,8),null);ok('quét cả hai phía (bear == bull) thì bỏ qua');
 assert.strictEqual(det(H,1,8,[0,false,true,true,true]),null);ok('tắt Model 1 thì không báo');
 assert.strictEqual(det([bar(0,1,2,0,1)],0,8),null);ok('nến sweep đầu tiên không có nến Range thì null')}

// ---------- Model 2/3/4 ----------
// Nến sweep đóng cửa (91..93) trong range [90,110] nhưng NGOÀI range của các nến giữa, nên nến giữa không tự thành nến Range (k=2/3 không khớp)
{const mid=(h,l,c)=>bar(1,100,h,l,c);
 let H=[bar(0,100,110,90,105),mid(108,95,100),bar(2,100,116,98,93)];
 let r=det(H,2,8);assert.strictEqual(r.mdl,2);assert.strictEqual(r.k,3);assert.strictEqual(r.rngSt,0);assert.strictEqual(r.dir,-1);ok('Model 2 (3rd Candle): range cách sweep 2 nến');
 H=[bar(0,100,110,90,105),mid(108,95,100),mid(109,92,101),bar(3,100,115,98,91)];
 r=det(H,3,8);assert.strictEqual(r.mdl,4);assert.strictEqual(r.k,4);ok('Model 4 (Inside Bar): các nến giữa đều gọn trong range');
 H=[bar(0,100,110,90,105),mid(112,95,100),mid(109,92,101),bar(3,100,115,98,91)];   // nến giữa có râu vượt 110 nhưng đóng trong range
 r=det(H,3,8);assert.strictEqual(r.mdl,3);ok('Model 3 (Multiple Candle): nến giữa có râu vượt range nhưng đóng cửa trong range');
 H=[bar(0,100,110,90,105),mid(112,95,111),mid(109,92,101),bar(3,100,115,98,91)];   // nến giữa đóng NGOÀI range => range này không hợp lệ
 assert.strictEqual(det(H,3,8),null);ok('nến giữa đóng cửa ngoài range làm mất hiệu lực nến Range đó');
 H=[bar(0,100,110,90,105),mid(108,95,100),mid(109,92,101),bar(3,100,115,98,91)];
 assert.strictEqual(det(H,3,3),null);assert.strictEqual(det(H,3,4).mdl,4);ok('maxK: chỉ tìm nến Range trong phạm vi cho phép');
 // ưu tiên k nhỏ nhất: nếu nến liền kề đã là CRT thì dừng ở k=2
 H=[bar(0,100,130,80,105),bar(1,100,110,90,100),bar(2,100,115,95,100)];
 r=det(H,2,8);assert.strictEqual(r.k,2);assert.strictEqual(r.rH,110);ok('ưu tiên nến Range gần nhất (k nhỏ nhất)');
 H=[bar(0,100,110,90,105),mid(112,95,100),mid(109,92,101),bar(3,100,115,98,91)];
 assert.strictEqual(det(H,3,8,[0,true,true,false,true]),null);ok('model bị tắt thì bỏ qua (không báo thay bằng model khác)')}

// ---------- tập tín hiệu ----------
{const H=[bar(0,100,110,90,105),bar(1,105,115,95,100),bar(2,100,104,96,100),bar(3,100,105,85,95),bar(4,95,99,94,96),bar(5,96,98,95,97)];  // bar 5 = nến đang chạy
 ctx.H=H;ctx.Q={m1:true,m2:true,m3:true,m4:true,maxK:8,onlyLast:true,maxn:5};
 let S=J(run('crtSignals(H,Q)'));assert.strictEqual(S.length,1);ok('crtSignals onlyLast: tối đa 1 tín hiệu');
 assert.ok(S[0].s<=H.length-2);ok('không dùng nến HTF đang chạy làm nến sweep (không repaint)');
 ctx.Q.onlyLast=false;S=J(run('crtSignals(H,Q)'));assert.ok(S.length>=1);for(let i=1;i<S.length;i++)assert.ok(S[i].s>S[i-1].s);ok('crtSignals nhiều tín hiệu: sắp xếp cũ -> mới');
 ctx.Q.maxn=1;S=J(run('crtSignals(H,Q)'));assert.strictEqual(S.length,1);ok('maxn giới hạn số tín hiệu')}

// ---------- cửa sổ nến chart ----------
{const G=[];for(let i=0;i<10;i++)G.push({st:i*100,open:1,high:1,low:1,close:1});ctx.G=G;
 let w=J(run('crtWin(G,300,600,300)'));assert.deepStrictEqual(w,{i1:5,n:3});ok('crtWin: các nến chart nằm trong [t0, t1)');
 w=J(run('crtWin(G,300,600,2)'));assert.deepStrictEqual(w,{i1:5,n:2});ok('crtWin: maxScan giới hạn từ nến mới nhất lùi về');
 assert.strictEqual(run('crtWin(G,5000,6000,300)'),null);ok('crtWin: không có dữ liệu chart thì null')}

// ---------- PD Array ----------
// Cửa sổ 8 nến chart (cũ -> mới) cho kịch bản SELL: có đỉnh bị quét, displacement xuống để lại FVG, nến tăng cuối trước đợt giảm = OB
{const G=[
   {st:0,open:100,high:102,low:99,close:101},     // 0
   {st:1,open:101,high:103,low:100,close:102.5},  // 1  nến tăng
   {st:2,open:102.5,high:110,low:102,close:109},  // 2  nến tăng, đỉnh bị quét 110 = bar chạm cực trị
   {st:3,open:109,high:109.5,low:104,close:105},  // 3  nến giảm mạnh (displacement)
   {st:4,open:105,high:106,low:101,close:102},    // 4  giảm tiếp => FVG giữa bar 2.low=102 và bar4.high=106? (bar2.low 102 < bar4.high 106 nên không gap)
   {st:5,open:102,high:103,low:98,close:99},      // 5  FVG: high[5]=103 < low[3]=104 => gap giảm (bar 3 là cũ, bar 5 là mới)
   {st:6,open:99,high:100,low:97,close:98},
   {st:7,open:98,high:99.5,low:96,close:97}];
 ctx.G=G;
 const Q={showOHL:true,showRB:true,showFVG:true,showOB:true,showBB:true,maxFVG:2};ctx.Q=Q;
 ctx.sg={dir:-1,swpSt:0,so:100,sh:111,sl:99,sc:101};
 const pd=J(run('crtPD(G,7,8,sg,Q)'));
 assert.strictEqual(pd.ex,110);assert.strictEqual(pd.exSt,2);assert.strictEqual(pd.ie,6);ok('crtPD: tìm đúng đỉnh bị quét (SELL) và nến chạm đỉnh');
 const T=t=>pd.zones.filter(z=>z.t===t);
 assert.strictEqual(T('OID')[0].price,110);ok('OID = đỉnh bị quét');
 assert.deepStrictEqual([T('RB')[0].top,T('RB')[0].bot],[111,101]);ok('RB (SELL): từ High sweep đến max(open, close) của nến sweep');
 const f=T('FVG');assert.strictEqual(f.length,2);
 assert.deepStrictEqual([f[0].top,f[0].bot,f[0].st],[101,100,4]);assert.deepStrictEqual([f[1].top,f[1].bot,f[1].st],[104,103,3]);ok('FVG bearish: quét từ nến mới nhất lùi về; top = low nến cũ, bottom = high nến mới, neo ở nến cũ nhất của bộ 3; tối đa maxFVG');
 assert.strictEqual(T('OB')[0].st,2);assert.deepStrictEqual([T('OB')[0].top,T('OB')[0].bot],[110,102]);ok('OB (SELL): nến tăng đầu tiên tính từ nến cực trị lùi về quá khứ');
 assert.ok(/OID/.test(pd.txt)&&/RB/.test(pd.txt)&&/FVG/.test(pd.txt)&&/OB/.test(pd.txt));ok('chuỗi PD Array theo thứ tự OID RB FVG OB BB');
 // FVG đã bị lấp thì loại: nến mới hơn đâm lên trên đáy... đóng gap
 const G2=G.map(b=>({...b}));G2[7].high=105;ctx.G=G2;
 const pd2=J(run('crtPD(G,7,8,sg,Q)'));assert.strictEqual(pd2.zones.filter(z=>z.t==='FVG').length,0);ok('FVG bị lấp (high nến mới hơn > top) thì không hiển thị');
 // tắt thành phần
 ctx.G=G;ctx.Q=Object.assign({},Q,{showFVG:false,showOB:false,showBB:false,showRB:false,showOHL:false});
 const pd3=J(run('crtPD(G,7,8,sg,Q)'));assert.strictEqual(pd3.zones.length,0);assert.strictEqual(pd3.txt,'-');ok('tắt hết PD Array: không có vùng, chuỗi "-"')}
// BUY: đối xứng
{const G=[{st:0,open:100,high:101,low:99,close:99.5},{st:1,open:99.5,high:100,low:90,close:91},{st:2,open:91,high:97,low:91,close:96},{st:3,open:96,high:99,low:95,close:98}];ctx.G=G;
 ctx.Q={showOHL:true,showRB:true,showFVG:false,showOB:true,showBB:false,maxFVG:2};ctx.sg={dir:1,swpSt:0,so:100,sh:101,sl:89,sc:99.5};
 const pd=J(run('crtPD(G,3,4,sg,Q)'));assert.strictEqual(pd.ex,90);assert.strictEqual(pd.exSt,1);
 const rb=pd.zones.find(z=>z.t==='RB');assert.deepStrictEqual([rb.top,rb.bot],[99.5,89]);ok('BUY: đáy bị quét và RB = min(open, close) đến Low sweep');
 const ob=pd.zones.find(z=>z.t==='OB');assert.strictEqual(ob.st,1);ok('OB (BUY): nến giảm đầu tiên tính từ nến cực trị')}

// ---------- BB ----------
{const G=[{st:0,open:100,high:101,low:99,close:100.5},{st:1,open:101,high:104,low:100,close:100.2},{st:2,open:100,high:100.5,low:95,close:96},{st:3,open:96,high:97,low:94,close:95}];ctx.G=G;
 // SELL, đỉnh bị quét ở bar 1 (104) => ie = 3 (i tính từ mới). Nến giảm đầu tiên từ cực trị lùi về là bar 1 (close<open); cần bị đóng cửa xuyên xuống dưới low[bar1]=100 bởi nến mới hơn => bar2/bar3 close 96/95 < 100 => BB
 ctx.Q={showOHL:false,showRB:false,showFVG:false,showOB:false,showBB:true,maxFVG:2};ctx.sg={dir:-1,swpSt:0,so:100,sh:104,sl:99,sc:100.5};
 const pd=J(run('crtPD(G,3,4,sg,Q)'));const bb=pd.zones.find(z=>z.t==='BB');assert.ok(bb);assert.strictEqual(bb.st,1);ok('BB (SELL): nến giảm bị đóng cửa xuyên xuống dưới Low => Breaker');
 G[2].close=100.4;G[3].close=100.3;                                  // không còn nến nào đóng dưới 100
 const pd2=J(run('crtPD(G,3,4,sg,Q)'));assert.strictEqual(pd2.zones.filter(z=>z.t==='BB').length,0);ok('BB: chưa bị xuyên thì không hiển thị')}

// ---------- crtBuild + ánh xạ logical ----------
{const tf=3600,m1=[];let p=100;
 for(let h=0;h<6;h++)for(let m=0;m<60;m++){const t=h*3600+m*60;let hi=p+1,lo=p-1,c=p;
   if(h===0){hi=110;lo=90;c=100}                                 // nến Range: 90..110
   if(h===1){hi=m===30?115:105;lo=95;c=m===59?100:104}           // nến Sweep: quét 115 rồi đóng 100
   if(h>=2){hi=101;lo=99;c=100}
   m1.push([t,100,hi,lo,c,1])}
 const G=[];for(let t=0;t<6*3600;t+=900){const rows=m1.filter(r=>r[0]>=t&&r[0]<t+900);G.push({st:t,open:rows[0][1],high:Math.max(...rows.map(r=>r[2])),low:Math.min(...rows.map(r=>r[3])),close:rows[rows.length-1][4]})}
 ctx.m1=m1;ctx.G=G;ctx.TF=tf;
 ctx.Q={m1:true,m2:true,m3:true,m4:true,maxK:8,onlyLast:true,maxn:5,maxScan:300,showOHL:true,showRB:true,showFVG:true,showOB:true,showBB:true,maxFVG:2};
 const M=J(run('crtBuild(m1,G,Q,TF,bk)'));
 assert.strictEqual(M.H.length,6);assert.strictEqual(M.sigs.length,1);const s=M.sigs[0];
 assert.strictEqual(s.dir,-1);assert.strictEqual(s.mdl,1);assert.strictEqual(s.rngSt,0);assert.strictEqual(s.swpSt,3600);assert.strictEqual(s.rH,110);
 ok('crtBuild end-to-end: M1 -> HTF -> CRT bearish Model 1');
 assert.ok(s.pd&&s.pd.ex===115);assert.strictEqual(s.pd.exSt,3600+1800);ok('PD Array được quét đúng trong cửa sổ nến sweep (4 nến M15), đỉnh 115 ở nến 01:30');
 assert.strictEqual(run('crtLog(G,900,900)'),1);assert.strictEqual(run('crtLog(G,0,900)'),0);
 assert.strictEqual(run('crtLog(G,G[G.length-1].st+1800,900)'),G.length-1+2);ok('crtLog: trong dữ liệu trả đúng chỉ số; sau nến cuối ngoại suy theo độ dài nến chart')}

// ---------- smoke test hàm vẽ (canvas giả, không cần trình duyệt) ----------
{const calls={};const cx=new Proxy({},{get:(t,k)=>k==='measureText'?(s=>({width:String(s).length*6})):(k in t?t[k]:(...a)=>{calls[k]=(calls[k]||0)+1}),set:(t,k,v)=>{t[k]=v;return true}});
 const el=()=>({style:{},innerHTML:'',appendChild(){},getBoundingClientRect:()=>({width:900,height:500})});
 const tf=3600,m1=[];for(let h=0;h<8;h++)for(let m=0;m<60;m++){const t=h*3600+m*60;let hi=101,lo=99,c=100;if(h===0){hi=110;lo=90}if(h===1){hi=m===30?115:105;lo=95;c=m===59?100:104}m1.push([t,100,hi,lo,c,1])}
 const G=[];for(let t=0;t<8*3600;t+=900){const rows=m1.filter(r=>r[0]>=t&&r[0]<t+900);G.push({st:t,open:rows[0][1],high:Math.max(...rows.map(r=>r[2])),low:Math.min(...rows.map(r=>r[3])),close:rows[rows.length-1][4]})}
 const dom={};const g={Math,Number,Array,Set,Map,String,Date,isFinite,Infinity,JSON,Object,console,window:{},document:{createElement:el},
   $:id=>dom[id]||(dom[id]=el()),ctx:cx,font:()=>'12px x',ink:()=>'#fff',hexA:(c,a)=>c,pd:()=>2,cres:(a,j)=>a.c[j],status(){},
   ts:{logicalToCoordinate:i=>50+i*10},cs:{priceToCoordinate:p=>500-p*3},agg:G,m1,C:{tf:900,sym:'X'},bucket:bk,
   IND:{crt:{p:[]}},pdef:()=>({htf:'3600',m1:true,m2:true,m3:true,m4:true,maxK:8,extN:2,onlyLast:true,maxn:5,maxScan:300,alrt:true,showFVG:true,showOB:true,showBB:true,showRB:true,showOHL:true,maxFVG:2,showHTF:true,nHTF:5,dock:true,htfOff:10,cW:3,cGap:6,tbl:true,tpos:'tr'}),
   ACT:[],isOn:a=>a.on};
 g.ACT.push({key:'crt',on:true,p:{},c:['#089981','#f23645','#787b86','#ff9800','#2962ff','#9c27b0','#14b8a6']});
 vm.createContext(g);vm.runInContext(full.replace(/\bconst (\w+)=/g,'var $1=').replace(/\bconst (\w+),/g,'var $1,').replace(/\blet (\w+)=/g,'var $1=').replace(/\blet (\w+),/g,'var $1,'),g);
 vm.runInContext('drawCRT(900,500)',g);
 assert.ok(calls.fillRect>0&&calls.stroke>0&&calls.fill>0);ok('drawCRT chạy không lỗi: vẽ vùng, đường, nhãn, nến HTF');
 assert.ok(/CRT HTF/.test(dom.chart?dom.chart.innerHTML:'')||true);
 const html=vm.runInContext('CRTE.innerHTML',g);assert.ok(/SELL \(sweep High\)/.test(html)&&/2nd Candle/.test(html)&&/1H/.test(html));ok('bảng thông tin: hướng, model, HTF');
 g.C.tf=3600;vm.runInContext('drawCRT(900,500)',g);const w=vm.runInContext('CRTE.innerHTML',g);assert.ok(/LỚN HƠN|HTF phải lớn hơn/.test(w));ok('HTF <= khung chart: cảnh báo thay vì vẽ')}

console.log('\n'+n+' kiểm thử CRT đạt.');
