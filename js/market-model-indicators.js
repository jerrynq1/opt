/*
 * Market Model indicators — native JavaScript ports of the five user-supplied Pine v6 scripts.
 * Source notices: CRT Turtle Soup+, SDRange+, Wyckoff+ and PO3 Plus declare Mozilla Public
 * License 2.0. Wyckoff+ also carries © arleay attribution. SSMT+ has no explicit licence header in
 * the supplied file. This file is a platform port; TradingView Pine execution is not reproduced
 * byte-for-byte. Calculations use the chart's available cTrader OHLCV history.
 */
(function(){
  'use strict';
  const KEY=['crtSoup','ssmtPlus','sdRangePlus','wyckoffPlus','po3Plus'];
  const CACHE=new Map();
  const PAIR={data:[],symbol:'',request:'',from:0,to:0,at:0,loading:false,error:'',version:0};
  const NY='America/New_York';
  const NYFMT=new Intl.DateTimeFormat('en-CA',{timeZone:NY,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const NYCACHE=new Map();
  const $bars=()=>Array.isArray(agg)?agg:[];
  const active=k=>(ACT||[]).find(a=>a.key===k&&a.on&&(!a.vis||a.vis.includes(C.tf)))||null;
  const p=(a,k,d)=>a&&a.p&&a.p[k]!==undefined?a.p[k]:d;
  const num=(a,k,d)=>{const x=+p(a,k,d);return Number.isFinite(x)?x:d};
  const yes=(a,k,d=false)=>!!p(a,k,d);
  const str=(a,k,d='')=>String(p(a,k,d));
  const color=(a,i,d)=>a&&a.c&&a.c[i]||d;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const tf=()=>Math.max(1,+C.tf||60);
  const fmt=(v)=>Number.isFinite(v)?v.toFixed(PDIG()):'–';
  const xI=i=>{const B=$bars(),b=B[clamp(Math.round(i),0,B.length-1)];try{return b?ts.timeToCoordinate(b.time):null}catch{return null}};
  const xF=(i)=>{const B=$bars();if(!B.length)return null;const j=clamp(i,0,B.length-1),x=xI(j);if(x==null)return null;return x+(i-j)*(xI(Math.min(j+1,B.length-1))-x||8)};
  const yP=v=>{try{return Number.isFinite(v)?cs.priceToCoordinate(v):null}catch{return null}};
  const view=()=>{try{return ts.getVisibleLogicalRange()||{from:0,to:$bars().length-1}}catch{return{from:0,to:$bars().length-1}}};
  const nyParts=st=>{
    const key=+st;if(NYCACHE.has(key))return NYCACHE.get(key);
    const u=typeof s2u==='function'?s2u(st):st,d=new Date(u*1000),q=NYFMT.formatToParts(d),o={};
    q.forEach(x=>{if(x.type!=='literal')o[x.type]=x.value});
    const result={y:+o.year,m:+o.month,d:+o.day,h:+o.hour,mi:+o.minute,date:`${o.year}-${o.month}-${o.day}`,minute:+o.hour*60 + +o.minute,utc:u};
    NYCACHE.set(key,result);if(NYCACHE.size>50000){const it=NYCACHE.keys();for(let i=0;i<10000;i++)NYCACHE.delete(it.next().value)}
    return result;
  };
  const tradingDay=st=>{const n=nyParts(st);return n.minute>=1080?dateShift(n.date,1):n.date};
  const dateShift=(date,days)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
  const nyWallTime=(date,hour,minute=0)=>{const [y,m,d]=date.split('-').map(Number),wall=Date.UTC(y,m-1,d,hour,minute,0)/1000;let guess=wall;for(let i=0;i<3;i++){const n=nyParts(guess),actual=Date.UTC(n.y,n.m-1,n.d,n.h,n.mi,0)/1000;guess+=wall-actual}return guess};
  const indexAtOrAfter=st=>{const B=$bars(),target=typeof u2s==='function'?u2s(st):st;let lo=0,hi=B.length;while(lo<hi){const mid=(lo+hi)>>1;if(B[mid].st<target)lo=mid+1;else hi=mid}return lo<B.length?lo:B.length-1};
  const sessionInfo=(st,session)=>{
    const m=String(session||'0600-0900').replace(/:/g,'');
    const a=m.slice(0,4),b=m.slice(5,9);if(!/^\d{4}$/.test(a)||!/^\d{4}$/.test(b))return null;
    const start=+a.slice(0,2)*60 + +a.slice(2),end=+b.slice(0,2)*60 + +b.slice(2),n=nyParts(st);
    let inS=start<end?(n.minute>=start&&n.minute<end):(n.minute>=start||n.minute<end);
    let day=n.date;if(start>=end&&n.minute<end)day=dateShift(day,-1);
    return{inS,day,start,end,n};
  };
  const line=(x1,x2,price,col,width=1,dash='solid')=>{
    const y=yP(price);if(x1==null||x2==null||y==null||x2<x1-2)return;
    ctx.save();ctx.strokeStyle=col;ctx.lineWidth=width;ctx.setLineDash(dash==='dotted'?[2,4]:dash==='dashed'?[7,4]:[]);ctx.beginPath();ctx.moveTo(x1,y);ctx.lineTo(x2,y);ctx.stroke();ctx.restore();
  };
  const trend=(i1,pr1,i2,pr2,col,width=1,dash='solid')=>{
    const x1=xF(i1),x2=xF(i2),y1=yP(pr1),y2=yP(pr2);if([x1,x2,y1,y2].some(v=>v==null))return;
    ctx.save();ctx.strokeStyle=col;ctx.lineWidth=width;ctx.setLineDash(dash==='dotted'?[2,4]:dash==='dashed'?[7,4]:[]);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.restore();
  };
  const sizePx=(a,k,d='Small')=>({Tiny:9,Small:10,Normal:11,Large:12,Huge:14}[str(a,k,d)]||10);
  const tag=(i,price,text,col,bg='rgba(12,18,27,.82)',up=false,fontPx=10)=>{
    const x=xF(i),y=yP(price);if(x==null||y==null)return;
    ctx.save();ctx.font=`600 ${fontPx}px Space Grotesk, sans-serif`;const w=ctx.measureText(text).width+10,h=18,xx=clamp(x+4,2,Math.max(2,plot()[0]-w-2)),yy=clamp(y+(up?-h-5:5),2,Math.max(2,plot()[1]-h-2));
    ctx.fillStyle=bg;ctx.beginPath();ctx.roundRect(xx,yy,w,h,4);ctx.fill();ctx.fillStyle=col;ctx.textBaseline='middle';ctx.fillText(text,xx+5,yy+h/2+.5);ctx.restore();
  };
  const box=(i1,i2,top,bottom,bg,border,text='')=>{
    const x1=xF(i1),x2=xF(i2),y1=yP(top),y2=yP(bottom);if([x1,x2,y1,y2].some(v=>v==null))return;
    ctx.save();ctx.fillStyle=bg;ctx.strokeStyle=border||bg;ctx.lineWidth=1;ctx.fillRect(Math.min(x1,x2),Math.min(y1,y2),Math.max(1,Math.abs(x2-x1)),Math.max(1,Math.abs(y2-y1)));ctx.strokeRect(Math.min(x1,x2),Math.min(y1,y2),Math.max(1,Math.abs(x2-x1)),Math.max(1,Math.abs(y2-y1)));
    if(text){ctx.font='600 10px Space Grotesk,sans-serif';ctx.fillStyle=border||'#ddd';ctx.fillText(text,Math.min(x1,x2)+4,Math.min(y1,y2)+12)}ctx.restore();
  };
  const marker=(i,price,text,col,up,fontPx=10)=>{const x=xF(i),y=yP(price);if(x==null||y==null)return;ctx.save();ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();tag(i,price,text,col,'rgba(12,18,27,.84)',up,fontPx);ctx.restore()};
  const rightX=()=>{const w=plot()[0];return Math.max(0,w-5)};
  const drawPanel=(a,lines,defaultSpot='Top Left',sizeKey='tableSize')=>{
    const fs=sizePx(a,sizeKey,'Normal'),lineH=fs+5;ctx.save();ctx.font=`${fs}px Space Grotesk,sans-serif`;
    const width=Math.max(100,...lines.map(t=>ctx.measureText(String(t)).width))+16,height=lines.length*lineH+12,[w,h]=plot(),spot=str(a,'tableSpot',defaultSpot);
    let x=spot.includes('Right')?w-width-8:spot.includes('Center')?(w-width)/2:8;let y=spot.startsWith('Bottom')?h-height-8:8;
    x=clamp(x,4,Math.max(4,w-width-4));y=clamp(y,4,Math.max(4,h-height-4));ctx.fillStyle='rgba(12,18,27,.84)';ctx.fillRect(x,y,width,height);ctx.fillStyle='#ddd';
    lines.forEach((t,i)=>ctx.fillText(String(t),x+8,y+fs+3+i*lineH));ctx.restore();
  };
  const maxX=i=>Math.max(xF(i)||0,rightX());
  const lineStyle=a=>({Solid:'solid',Dashed:'dashed',Dotted:'dotted'}[str(a,'lineStyle','Dotted')]||'dotted');
  const mkSig=a=>[a.id,a.on,JSON.stringify(a.p||{}),(a.c||[]).join(',')].join('|');
  const barSig=()=>{const B=$bars(),b=B[B.length-1];return b?[b.st,b.open,b.high,b.low,b.close,b.v,B.length,C.tf,C.sym].join(':'):'empty'};
  const cacheGet=(a,fn)=>{const k=a.key,sg=mkSig(a)+'#'+barSig()+(a.key==='ssmtPlus'?'#PAIR'+PAIR.version:'');let q=CACHE.get(k);if(!q||q.sig!==sg){q={sig:sg,data:fn(a)};CACHE.set(k,q)}return q.data};
  const parseNums=s=>String(s||'').replace(/,/g,' ').split(/\s+/).map(Number).filter(x=>Number.isFinite(x)&&x>0);
  function sessionRanges(B,session){
    const out=[];let cur=null,was=false;
    for(let i=0;i<B.length;i++){
      const b=B[i],s=sessionInfo(b.st,session);if(!s)continue;
      if(s.inS){if(!cur||cur.day!==s.day){if(cur)out.push(cur);cur={day:s.day,start:i,end:i,open:b.open,hi:b.high,hiI:i,lo:b.low,loI:i,complete:false}}
        else{cur.end=i;if(b.high>cur.hi){cur.hi=b.high;cur.hiI=i}if(b.low<cur.lo){cur.lo=b.low;cur.loI=i}}
      }else if(cur&&!cur.complete){cur.complete=true;cur.end=i-1;out.push(cur);cur=null}
    }
    if(cur)out.push(cur);return out;
  }
  // ===== SDRange+ (NY session range, projections, zones and swept session pivots) =====
  function calcSD(a){
    const B=$bars(),ranges=sessionRanges(B,str(a,'rngSess','0600-0900'));
    const p1=yes(a,'pvOn1'),p2=yes(a,'pvOn2'),sess=[];
    if(p1)sess.push({name:str(a,'pvName1','Asia'),color:color(a,7,'#787B86'),items:sessionRanges(B,str(a,'pvSess1','2000-0000'))});
    if(p2)sess.push({name:str(a,'pvName2','London'),color:color(a,8,'#089981'),items:sessionRanges(B,str(a,'pvSess2','0200-0500'))});
    for(const s of sess){s.items=s.items.filter(x=>x.complete).slice(-num(a,'pvBack',3));for(const r of s.items){r.hiSw=-1;r.loSw=-1;for(let i=r.end+1;i<B.length;i++){if(r.hiSw<0&&B[i].high>r.hi)r.hiSw=i;if(r.loSw<0&&B[i].low<r.lo)r.loSw=i}}}
    return{ranges:ranges.filter(x=>x.complete||x===ranges[ranges.length-1]).slice(-Math.max(10,num(a,'shown',1)+3)),sess};
  }
  function drawSD(a,d,w){
    const B=$bars();if(!B.length||C.tf>3600||C.tf<60){tag(B.length-1,B[B.length-1]?.close||0,'SDRange: dùng chart 1m–1h',color(a,0,'#aaa'));return}
    const Rs=d.ranges.slice(-num(a,'shown',1));
    Rs.forEach((r,k)=>{const h=r.hi-r.lo;if(!(h>0))return;
      const pastHour=clamp(num(a,'pastHour',17),10,23),endUtc=s2u(B[r.end].st),candidate=nyWallTime(r.day,pastHour,0),oldEnd=candidate>endUtc?candidate:candidate+86400,x2Old=xF(indexAtOrAfter(oldEnd));
      const x1=xF(r.end),x2=k===Rs.length-1?Math.min(rightX(),xF(B.length-1+num(a,'extBars',8))||rightX()):x2Old;if(x1==null||x2==null)return;
      const proj=parseNums(str(a,'projStr','0.5 1 2 2.5')),pz=parseNums(str(a,'pzStr','0.1 0.2 0.3'));
      if(yes(a,'showVline',true)){const yh=yP(r.hi),yl=yP(r.lo);if(yh!=null&&yl!=null){ctx.save();ctx.strokeStyle=color(a,3,'#000');ctx.setLineDash([2,4]);ctx.beginPath();ctx.moveTo(x1,yh);ctx.lineTo(x1,yl);ctx.stroke();ctx.restore()}}
      if(yes(a,'showHL',true)){line(xF(r.hiI),x2,r.hi,color(a,0,'#131722'),num(a,'hlWidth',2));line(xF(r.loI),x2,r.lo,color(a,0,'#131722'),num(a,'hlWidth',2));if(yes(a,'showLabels',true)){tag(r.end,r.hi,'HIGH'+(yes(a,'showPrices')?' '+fmt(r.hi):''),color(a,0,'#ddd'),undefined,false,sizePx(a,'textSize'));tag(r.end,r.lo,'LOW'+(yes(a,'showPrices')?' '+fmt(r.lo):''),color(a,0,'#ddd'),undefined,true,sizePx(a,'textSize'))}}
      if(yes(a,'showMid',true)){const m=(r.hi+r.lo)/2;line(x1,x2,m,color(a,1,'#2E7D32'));if(yes(a,'showLabels',true))tag(r.end,m,'EQ'+(yes(a,'showPrices')?' '+fmt(m):''),color(a,1,'#2E7D32'),undefined,false,sizePx(a,'textSize'))}
      if(yes(a,'showQuart',true)){[.25,.75].forEach((q,j)=>{const v=r.lo+h*q;line(x1,x2,v,color(a,2,'#E24B4B'),1,'dotted');if(yes(a,'showLabels',true))tag(r.end,v,(q*100)+'%',color(a,2,'#E24B4B'),undefined,false,sizePx(a,'textSize'))})}
      if(yes(a,'showOpen')){line(x1,x2,r.open,color(a,0,'#ddd'),1,'dashed');if(yes(a,'showLabels',true))tag(r.end,r.open,'OPEN'+(yes(a,'showPrices')?' '+fmt(r.open):''),color(a,0,'#ddd'),undefined,false,sizePx(a,'textSize'))}
      if(yes(a,'showProj',true))proj.forEach(m=>{const up=r.hi+h*m,dn=r.lo-h*m;line(x1,x2,up,color(a,3,'#000'),1,'dotted');line(x1,x2,dn,color(a,3,'#000'),1,'dotted');if(yes(a,'showLabels',true)){tag(r.end,up,'+'+m+'RNG',color(a,3,'#aaa'),undefined,false,sizePx(a,'textSize'));tag(r.end,dn,'-'+m+'RNG',color(a,3,'#aaa'),'rgba(12,18,27,.82)',true,sizePx(a,'textSize'))}});
      if(yes(a,'zoneOn',true)){const za=num(a,'zoneA',1.33),zb=num(a,'zoneB',1.66);box(r.end,B.length-1,r.hi+h*zb,r.hi+h*za,'rgba(38,166,91,.08)',color(a,4,'#26A65B'),yes(a,'showLabels',true)?'+'+za+'–'+zb+' SD':'');box(r.end,B.length-1,r.lo-h*za,r.lo-h*zb,'rgba(38,166,91,.08)',color(a,4,'#26A65B'),yes(a,'showLabels',true)?'-'+za+'–'+zb+' SD':'')}
      if(yes(a,'showPz',true))pz.forEach(m=>{line(x1,x2,r.hi+h*m,color(a,6,'#F23645'),1,'dotted');line(x1,x2,r.lo-h*m,color(a,6,'#F23645'),1,'dotted')});
      if(yes(a,'showTable',true)&&k===Rs.length-1)drawPanel(a,['SDRange '+str(a,'rngSess','0600-0900'),'Range: '+fmt(h)+' · '+(r.complete?'Closed':'Building')],'Bottom Center','tableSize')
    });
    d.sess.forEach(s=>s.items.forEach(r=>{[['H',r.hi,r.hiI,r.hiSw],['L',r.lo,r.loI,r.loSw]].forEach(([q,v,ii,sw])=>{if(sw>=0&&!yes(a,'pvKeep',true))return;const end=sw>=0?sw:B.length-1;line(xF(ii),xF(end),v,s.color,1,'dashed');if(sw<0&&yes(a,'showLabels',true))tag(end,v,s.name+' '+q,s.color)})}));
  }
  // ===== CRT Turtle Soup+ — previous CRT HTF range, sweep, CISD and trade management =====
  function htfBars(tfSec){
    const src=m1&&m1.length?m1:$bars().map(b=>[b.st,b.open,b.high,b.low,b.close,b.v]);const map=new Map();
    for(const q of src){const k=Math.floor(q[0]/tfSec)*tfSec;let z=map.get(k);if(!z){z={st:k,hi:q[2],lo:q[3],op:q[1],cl:q[4]};map.set(k,z)}else{z.hi=Math.max(z.hi,q[2]);z.lo=Math.min(z.lo,q[3]);z.cl=q[4]}}
    return [...map.values()].sort((a,b)=>a.st-b.st);
  }
  function calcCRT(a){
    const B=$bars();if(!B.length)return{trades:[],range:null,err:'No chart history'};
    const seconds=Math.max(1800,+str(a,'crtTf','3600')),H=htfBars(seconds);if(tf()>=seconds)return{trades:[],range:null,err:'Chart timeframe must be below CRT timeframe'};
    const byKey=new Map();for(let i=0;i<H.length;i++)byKey.set(H[i].st,{cur:H[i],prev:H[i-1]||null});
    let key=null,rH=null,rL=null,rT=0,exH=null,exL=null,exHi=-1,exLi=-1,cisdS=null,cisdL=null,upOpen=null,dnOpen=null,usedS=false,usedL=false,day='',dayCount=0,busy=false;
    const trades=[],tick=CT&&CT.sym&&Number.isFinite(+CT.sym.digits)?Math.pow(10,-CT.sym.digits):Math.pow(10,-PDIG()),buf=num(a,'bufTicks',2)*tick;
    let pdh=-Infinity,pdl=Infinity,priorDay='';const dayHL=new Map();
    B.forEach(b=>{const nd=tradingDay(b.st);let q=dayHL.get(nd);if(!q)q={hi:b.high,lo:b.low};else{q.hi=Math.max(q.hi,b.high);q.lo=Math.min(q.lo,b.low)}dayHL.set(nd,q)});
    for(let i=0;i<B.length;i++){
      const b=B[i],k=Math.floor(b.st/seconds)*seconds,hs=byKey.get(k);if(!hs)continue;
      const nd=tradingDay(b.st);if(nd!==day){day=nd;dayCount=0;busy=false;const prev=dayHL.get(dateShift(nd,-1));pdh=prev?.hi??-Infinity;pdl=prev?.lo??Infinity}
      const newH=k!==key;if(newH){key=k;rH=hs.prev?.hi??null;rL=hs.prev?.lo??null;rT=hs.prev?.st??b.st;exH=exL=cisdS=cisdL=null;exHi=exLi=-1;usedS=usedL=false}
      const prev=B[i-1];if(b.close>b.open&&(!prev||prev.close<=prev.open))upOpen=b.open;if(b.close<b.open&&(!prev||prev.close>=prev.open))dnOpen=b.open;
      if(rH!=null&&b.high>rH&&(exH==null||b.high>exH)){exH=b.high;exHi=i;cisdS=upOpen??b.open}
      if(rL!=null&&b.low<rL&&(exL==null||b.low<exL)){exL=b.low;exLi=i;cisdL=dnOpen??b.open}
      // Manage live positions before new entries.
      for(const tr of trades){if(!tr.live)continue;let end=false;if(tr.day!==nd)end=true;
        if(!end){if(tr.long){if(b.low<=tr.stop){end=true;tr.result=tr.hit1?'SL':'OUT'}else{if(!tr.hit1&&tr.tp1!=null&&b.high>=tr.tp1){tr.hit1=true;if(yes(a,'beAfter',true))tr.stop=tr.entry}if(b.high>=tr.tp2){end=true;tr.result='TP2'}}}
          else{if(b.high>=tr.stop){end=true;tr.result=tr.hit1?'SL':'OUT'}else{if(!tr.hit1&&tr.tp1!=null&&b.low<=tr.tp1){tr.hit1=true;if(yes(a,'beAfter',true))tr.stop=tr.entry}if(b.low<=tr.tp2){end=true;tr.result='TP2'}}}}
        if(end){tr.live=false;tr.end=i} }
      busy=trades.some(t=>t.live);
      const win= !yes(a,'limitWin')||(()=>{const q=nyParts(b.st).minute,[s,e]=str(a,'win','0200-1600').split('-').map(v=>+v.slice(0,2)*60 + +v.slice(2));return s<=e?q>=s&&q<e:q>=s||q<e})();
      if(yes(a,'useShort',true)&&!usedS&&cisdS!=null&&rH!=null&&b.close<cisdS&&b.close<rH&&b.close>rL){const sl=exH+buf,risk=sl-b.close,mid=(rH+rL)/2,ok=risk>0&&(b.close-rL)/risk>=num(a,'minRR',1.5)&&(!num(a,'maxStop',0)||risk<=num(a,'maxStop',0))&&win&&dayCount<num(a,'maxTrades',3)&&!busy;
        if(ok){trades.push({long:false,entry:b.close,stop:sl,stop0:sl,tp1:mid<b.close-tick?mid:null,tp2:rL,hit1:false,live:true,day:nd,from:i,sweep:exHi,range:rT,aGrade:exH>pdh});usedS=true;dayCount++;busy=true}cisdS=null;}
      if(yes(a,'useLong',true)&&!usedL&&cisdL!=null&&rL!=null&&b.close>cisdL&&b.close>rL&&b.close<rH){const sl=exL-buf,risk=b.close-sl,mid=(rH+rL)/2,ok=risk>0&&(rH-b.close)/risk>=num(a,'minRR',1.5)&&(!num(a,'maxStop',0)||risk<=num(a,'maxStop',0))&&win&&dayCount<num(a,'maxTrades',3)&&!busy;
        if(ok){trades.push({long:true,entry:b.close,stop:sl,stop0:sl,tp1:mid>b.close+tick?mid:null,tp2:rH,hit1:false,live:true,day:nd,from:i,sweep:exLi,range:rT,aGrade:exL<pdl});usedL=true;dayCount++;busy=true}cisdL=null;}
    }
    return{trades:trades.slice(-num(a,'maxVis',10)),range:{hi:rH,lo:rL,start:rT,cisdS,cisdL,exH,exL,exHi,exLi}};
  }
  function drawCRT(a,d){
    const B=$bars();if(d.err){ctx.save();ctx.fillStyle='#e7b85b';ctx.font='11px Space Grotesk';ctx.fillText('CRT TS+: '+d.err,10,18);ctx.restore();return}
    const full=str(a,'disp','Minimal')==='Full',last=B.length-1;
    if(full&&d.range&&d.range.hi!=null){const r=d.range,x1=xF(Math.max(0,B.findIndex(b=>b.st>=r.start))),x2=rightX();line(x1,x2,r.hi,color(a,3,'#000'),1,lineStyle(a));line(x1,x2,r.lo,color(a,3,'#000'),1,lineStyle(a));line(x1,x2,(r.hi+r.lo)/2,color(a,3,'#000'),1,'dotted');tag(last,r.hi,'CRT H',color(a,3,'#aaa'));tag(last,r.lo,'CRT L',color(a,3,'#aaa'));if(r.cisdS!=null)line(x1,x2,r.cisdS,color(a,1,'#F23645'),1,'dashed');if(r.cisdL!=null)line(x1,x2,r.cisdL,color(a,0,'#2962FF'),1,'dashed')}
    d.trades.forEach(tr=>{const c=tr.long?color(a,0,'#2962FF'):color(a,1,'#F23645'),end=tr.live?last:tr.end??last,x1=xF(tr.from),x2=tr.live?Math.min(rightX(),xF(last)+num(a,'extMin',15)/Math.max(1,tf())*8):xF(end);if(yes(a,'delOut',true)&&tr.result==='OUT'&&!tr.hit1)return;line(x1,x2,tr.entry,c,num(a,'eWidth',2));line(x1,x2,tr.stop,color(a,3,'#111'),num(a,'lvW',1),lineStyle(a));line(x1,x2,tr.tp2,color(a,3,'#111'),num(a,'lvW',1),lineStyle(a));if(tr.tp1!=null)line(x1,x2,tr.tp1,color(a,3,'#111'),num(a,'lvW',1),'dashed');tag(end,tr.entry,(tr.long?'CRT+':'CRT-')+' '+fmt(tr.entry)+(tr.aGrade&&yes(a,'aMark',true)?' ●':''),c,undefined,false,sizePx(a,'eSize','Tiny'));tag(end,tr.stop,'SL '+fmt(tr.stop),color(a,3,'#aaa'),undefined,false,sizePx(a,'lvSize','Tiny'));tag(end,tr.tp2,'TP2 '+fmt(tr.tp2),color(a,3,'#aaa'),undefined,false,sizePx(a,'lvSize','Tiny'));if(tr.tp1!=null)tag(end,tr.tp1,'TP1 '+fmt(tr.tp1),color(a,3,'#aaa'),undefined,false,sizePx(a,'lvSize','Tiny'));if(tr.hit1&&yes(a,'beAfter',true))tag(end,tr.entry,'BE',color(a,2,'#FF9800'),undefined,false,sizePx(a,'lvSize','Tiny'))});
    if(yes(a,'showPend')){const r=d.range;if(r?.exH!=null)tag(last,r.exH,'CRT sweep H',color(a,1,'#f44'));if(r?.exL!=null)tag(last,r.exL,'CRT sweep L',color(a,0,'#4af'))}
  }
  // ===== SSMT+ — pair history from cTrader without switching the active chart symbol =====
  function autoPairName(){const s=String(C.sym||'').toUpperCase();if(/MNQ/.test(s))return'MES';if(/MES/.test(s))return'MNQ';if(/MYM/.test(s))return'MES';if(/YM/.test(s))return'ES';if(/NQ|NAS100|USTEC|US100/.test(s))return'ES';if(/ES|SPX500|US500|SP500/.test(s))return'NQ';return''}
  async function fetchPairBars(symbolId,lo,hi,depth=0){
    const r=await ctHist(2137,{ctidTraderAccountId:CT.acc,symbolId,period:1,fromTimestamp:lo*1000,toTimestamp:hi*1000},'bar');
    const part=(r.trendbar||[]).map(tbToBar).filter(x=>x.u>=lo&&x.u<hi).map(x=>x.b).sort((x,y)=>x[0]-y[0]);
    if(r.hasMore&&hi-lo>120&&depth<8){const mid=Math.floor((lo+hi)/120)*60;if(mid>lo&&mid<hi)return(await fetchPairBars(symbolId,lo,mid,depth+1)).concat(await fetchPairBars(symbolId,mid,hi,depth+1))}
    return part;
  }
  async function loadPair(a){
    if(!agg.length||PAIR.loading)return;if(!CT?.ready||!CT.acc){PAIR.request=str(a,'pairMode','Auto')==='Manual'?str(a,'pairSymbol','US500'):autoPairName();PAIR.at=Date.now();PAIR.error='SSMT cần kết nối cTrader trước khi tải mã tương quan.';PAIR.version++;return}
    const want=str(a,'pairMode','Auto')==='Manual'?str(a,'pairSymbol','US500'):autoPairName();if(!want){PAIR.request='';PAIR.at=Date.now();PAIR.error='Không tìm được pair tự động cho '+C.sym+'; chuyển Pair mode = Manual.';PAIR.version++;return}
    const sym=ctFind(want);if(!sym){PAIR.request=want;PAIR.symbol=want;PAIR.at=Date.now();PAIR.data=[];PAIR.error='Broker không có mã đối chiếu '+want+'. Hãy nhập đúng symbolName trong cTrader.';PAIR.version++;return}
    const from=Math.floor(s2u(agg[0].st))-60,to=Math.floor(Date.now()/1000)+60;
    if(PAIR.request===want&&PAIR.symbol===sym.symbolName&&PAIR.from<=from&&Date.now()-PAIR.at<300000)return;
    PAIR.loading=true;PAIR.error='';PAIR.symbol=sym.symbolName;PAIR.request=want;PAIR.version++;
    try{const rows=await fetchPairBars(+sym.symbolId,from,to);PAIR.data=rows;PAIR.from=from;PAIR.to=to;PAIR.at=Date.now();PAIR.error=PAIR.data.length?'':'Mã '+sym.symbolName+' chưa có lịch sử M1 trong cửa sổ chart.';PAIR.version++;
    }catch(e){PAIR.at=Date.now();PAIR.error='Không tải được lịch sử '+sym.symbolName+': '+String(e.message||e);PAIR.version++}finally{PAIR.loading=false}
  }
  const pairBucket=()=>{const M=new Map();for(const q of PAIR.data){const k=bucket(q[0],tf());let x=M.get(k);if(!x){x={hi:q[2],lo:q[3]};M.set(k,x)}else{x.hi=Math.max(x.hi,q[2]);x.lo=Math.min(x.lo,q[3])}}return M};
  const isoWeek=d=>{const z=new Date(d+'T12:00:00Z'),day=(z.getUTCDay()+6)%7;z.setUTCDate(z.getUTCDate()-day+3);const y=z.getUTCFullYear(),first=new Date(Date.UTC(y,0,4)),fd=(first.getUTCDay()+6)%7;first.setUTCDate(first.getUTCDate()-fd+3);return y+'-'+String(1+Math.round((z-first)/604800000)).padStart(2,'0')};
  function cycKey(st,type){const q=nyParts(st),start=q.minute>=1080?dateShift(q.date,1):q.date,day=new Date(start+'T00:00:00Z'),mins=(q.minute-1080+1440)%1440;
    if(type==='Micro')return start+'-m'+Math.floor(mins/22.5);if(type==='90m')return start+'-90-'+Math.floor(mins/90);if(type==='Daily')return start+'-q'+Math.floor(mins/360);if(type==='Weekly')return isoWeek(start);return day.getUTCFullYear()+'-'+(day.getUTCMonth()+1)}
  function calcSSMT(a){
    const B=$bars(),PM=pairBucket();if(!PAIR.data.length)return{events:[],error:PAIR.loading?'Loading correlated symbol…':PAIR.error||'Pair history unavailable',pair:PAIR.symbol};
    const modes=[['Micro',yes(a,'showMicro'),22.5*60,300],['90m',yes(a,'show90',true),5400,900],['Daily',yes(a,'showDaily',true),21600,3600],['Weekly',yes(a,'showWeek',true),604800,86400],['Monthly',yes(a,'showMonth',true),2592000,86400]],events=[],boxes=[];
    for(const [name,on,sec,maxTf] of modes){if(!on||tf()>maxTf)continue;if(name==='Micro'&&tf()>300)continue;if(name==='90m'&&(tf()>900||5400%tf()!==0))continue;if(name==='Daily'&&(tf()>3600||21600%tf()!==0))continue;
      const groups=new Map();for(let i=0;i<B.length;i++){const b=B[i],wall=nyParts(b.st);if(wall.minute>=1020&&wall.minute<1080)continue;const key=cycKey(b.st,name);let g=groups.get(key);if(!g){g={key,from:i,to:i,hi:b.high,lo:b.low,hiI:i,loI:i,pairHi:PM.get(bucket(b.st,tf()))?.hi??null,pairLo:PM.get(bucket(b.st,tf()))?.lo??null};groups.set(key,g)}else{g.to=i;if(b.high>g.hi){g.hi=b.high;g.hiI=i}if(b.low<g.lo){g.lo=b.low;g.loI=i}const z=PM.get(bucket(b.st,tf()));if(z){g.pairHi=g.pairHi==null?z.hi:Math.max(g.pairHi,z.hi);g.pairLo=g.pairLo==null?z.lo:Math.min(g.pairLo,z.lo)}}}
      const G=[...groups.values()];if((name==='90m'&&yes(a,'box90m'))||(name==='Daily'&&yes(a,'boxDaily')))boxes.push(...G.slice(-40).map(g=>({...g,name})));for(let gi=1;gi<G.length;gi++){const prev=G[gi-1],cur=G[gi];if(prev.pairHi==null||prev.pairLo==null||cur.pairHi==null||cur.pairLo==null)continue;
        const hiTook=cur.hi>prev.hi,hiPair=cur.pairHi>prev.pairHi;if(hiTook!==hiPair){if(name!=='Daily'||yes(a,'showQ'+(Math.floor((nyParts(B[cur.to].st).minute-1080+1440)%1440/360)+1),true))events.push({name,dir:'bear',from:prev.hiI,to:cur.hiI,price:cur.hi,prev:prev.hi,pair:PAIR.symbol})}
        const loTook=cur.lo<prev.lo,loPair=cur.pairLo<prev.pairLo;if(loTook!==loPair){if(name!=='Daily'||yes(a,'showQ'+(Math.floor((nyParts(B[cur.to].st).minute-1080+1440)%1440/360)+1),true))events.push({name,dir:'bull',from:prev.loI,to:cur.loI,price:cur.lo,prev:prev.lo,pair:PAIR.symbol})}
      }
    }
    const lb=str(a,'lookback','1 Week'),limit=lb==='1 Day'?86400:lb==='1 Week'?604800:lb==='1 Month'?2678400:Infinity,last=B[B.length-1].st;
    return{events:events.filter(e=>last-B[e.to].st<=limit).slice(-num(a,'maxShown',20)),boxes,pair:PAIR.symbol};
  }
  function drawSSMT(a,d){
    if(d.error){ctx.save();ctx.fillStyle='#e7b85b';ctx.font='11px Space Grotesk';ctx.fillText('SSMT+: '+d.error,10,18);ctx.restore();return}
    const col=color(a,0,'#f4c15d'),style=lineStyle(a);d.boxes.forEach(g=>box(g.from,g.to,g.hi,g.lo,'rgba(244,193,93,.015)',col,g.name));d.events.forEach(e=>{const c=e.dir==='bear'?'#F23645':'#089981';trend(e.from,e.prev,e.to,e.price,col,1.5,style);marker(e.to,e.price,'SSMT '+e.name+' '+(e.dir==='bear'?'Bear':'Bull'),c,e.dir==='bull',sizePx(a,'labelSize'));});
  }
  // ===== Wyckoff+ — pivot/climax range, spring/sweep/volume entries and trade levels =====
  function avgRange(B,i,len,fn){let s=0,n=0;for(let j=Math.max(0,i-len+1);j<=i;j++){const v=fn(B[j]);if(Number.isFinite(v)){s+=v;n++}}return n?s/n:null}
  function calcWyckoff(a){
    const B=$bars(),N=B.length,atrLen=num(a,'atrLen',14),volLen=num(a,'volLen',20),sw=num(a,'swingLen',5),trendBars=Math.max(2*sw+1,Math.ceil(num(a,'trendMin',240)/tf())),mode=str(a,'mode','Spring'),filtered=str(a,'preset','Core')==='Filtered',dirMode=str(a,'dirMode','Both'),states=[],trades=[];
    if(N<Math.max(atrLen,trendBars,sw*2+3))return{states,trades,status:'Need more history'};
    const tr=[],atr=[],vav=[];for(let i=0;i<N;i++){const b=B[i],pr=B[i-1],r=Math.max(b.high-b.low,pr?Math.abs(b.high-pr.close):0,pr?Math.abs(b.low-pr.close):0);tr[i]=r;atr[i]=i?((atr[i-1]*(atrLen-1)+r)/atrLen):r;vav[i]=avgRange(B,i,volLen,x=>x.v)}
    const piv=[];for(let i=Math.max(sw,N-1500);i<N-sw;i++){let lo=true,hi=true;for(let j=i-sw;j<=i+sw;j++){if(j!==i&&B[j].low<=B[i].low)lo=false;if(j!==i&&B[j].high>=B[i].high)hi=false}if(lo)piv.push({i,d:1,p:B[i].low});if(hi)piv.push({i,d:-1,p:B[i].high})}
    const pivByConfirm=new Map();for(const z of piv){const k=z.i+sw;let q=pivByConfirm.get(k);if(!q){q=[];pivByConfirm.set(k,q)}q.push(z)}
    const lastBlock={1:-1,'-1':-1};
    for(const pv of piv){const pi=pv.i,confirm=pi+sw,d=pv.d;if(confirm>=N)continue;if(dirMode!=='Both'&&dirMode!==(d===1?'Long':'Short'))continue;if(pi<=lastBlock[d])continue;
      const w0=Math.max(0,pi-trendBars+1);let ext=d===1?-Infinity:Infinity;
      for(let j=w0;j<=pi;j++)ext=d===1?Math.max(ext,B[j].high):Math.min(ext,B[j].low);
      const depth=d===1?ext-pv.p:pv.p-ext;if(Math.abs((d===1?pv.p-ext:ext-pv.p))<num(a,'depthAtr',3)*(atr[pi]||1))continue;
      const needClimax=mode==='Volume'||filtered,rangeCandle=B[pi].high-B[pi].low,volOk=(B[pi].v||0)>0;
      if(needClimax&&(!(rangeCandle>=num(a,'climaxAtr',1.5)*(atr[pi]||1))||!volOk||(B[pi].v||0)<num(a,'climaxVol',1.5)*(vav[pi]||0)))continue;
      let nSup=d*pv.p,nCrk=-Infinity,crI=confirm;
      for(let j=Math.max(0,confirm-sw+1);j<=confirm;j++){const z=d===1?B[j].high:-B[j].low;if(z>nCrk){nCrk=z;crI=j}}
      if(!(nCrk>nSup))continue;
      const s={dir:d,from:pi,to:N-1,low:d===1?nSup:-nCrk,high:d===1?nCrk:-nSup,stage:'ACC/DIST',event:'',entry:null,stop:null,tp1:null,tp2:null,rangeTopI:crI,sweepI:-1};
      let frozen=false,armed=false,brk=false,nSpr=null,nImp=null,nSwing=null,tSt=-1,qual=false,tested=false,qualI=-1,phaseEnd=confirm,entryMade=false;
      const limit=Math.min(N-1,confirm+Math.ceil(num(a,'rngHours',48)*3600/tf()));
      for(let j=confirm;j<=limit;j++){
        const b=B[j],av=Math.max(1e-12,atr[j]||atr[pi]||1),nl=d===1?b.low:-b.high,nh=d===1?b.high:-b.low,nc=d*b.close,no=d*b.open,tol=num(a,'stTol',.5)*av,buf=num(a,'bufTicks',2)*Math.pow(10,-PDIG());
        if(!brk){
          for(const sp of pivByConfirm.get(j)||[]){if(sp.i>pi&&((d===1&&sp.d===-1)||(d===-1&&sp.d===1))){const sn=d===1?sp.p:-sp.p;if(sn>nSup&&sn<=nCrk)nSwing=sn}}
          s.nSwing=nSwing;
          if(nl<nSup){if(armed){brk=true;nSpr=nl;nImp=nh;s.sweepI=j;s.stage='Spring/Sweep';s.event=d===1?'SPRING':'UTAD';phaseEnd=j}else{ s.stage='Support/resistance broke before range formed';break}}
          else{
            if(nh>nCrk){nCrk=nh;crI=j;s.high=d===1?nCrk:s.high;s.low=d===1?s.low:-nCrk}
            const height=nCrk-nSup;if(!frozen&&height>num(a,'maxH',12)*av){s.stage='Range too tall';break}
            const tall=height>=num(a,'minH',2)*av&&j>crI;
            if(tSt<0&&tall&&nl<=nSup+tol){tSt=j;frozen=true}
            if(!frozen&&tall&&nc<(nSup+nCrk)/2)frozen=true;
            if(frozen&&nc>nCrk){s.stage='Breakout without spring';break}
            const oldEnough=(j-confirm)*tf()>= (filtered?num(a,'minRangeMin',60):0)*60;
            armed=armed||(frozen&&height>=num(a,'minH',2)*av&&(mode!=='Volume'&&!filtered||tSt>=0)&&oldEnough);
            s.high=d===1?nCrk:-nSup;s.low=d===1?nSup:-nCrk;
          }
        } else {
          if(nl<nSpr)nSpr=nl;nImp=Math.max(nImp??nh,nh);s.to=j;s.low=d===1?nSup:-nCrk;s.high=d===1?nCrk:-nSup;
          const candleRange=b.high-b.low,wide=candleRange>=num(a,'wideAtr',1.2)*av,lowV=(b.v||0)<num(a,'lowVol',.8)*(vav[j]||0),intent=nc>no&&candleRange>=num(a,'medAtr',.8)*av&&(b.v||0)>=num(a,'highVol',1)*(vav[j]||0)&&nc>nSup;
          const inWindow=(j-(qual?qualI:phaseEnd))*tf()<=num(a,'winMin',120)*60;
          let entN=null,stopN=null,tgtN=nCrk,pend=false,zTop=NaN,zBot=NaN;
          if(mode==='Spring'){
            const prev=B[j-1],engulf=!prev||d*prev.close<d*prev.open&&nc>d*prev.open,rec=nc>nSup&&nc>no&&(!filtered||engulf);
            if(rec&&inWindow){entN=nc;stopN=nSpr-buf;s.event=d===1?'SPRING LONG':'UTAD SHORT'}else if(!inWindow){s.stage='No recovery inside the window';break}
          } else if(mode==='Sweep'){
            const tooDeep=filtered&&(nSup-nSpr)>num(a,'maxSweepAtr',3)*av;
            if(tooDeep){s.stage='Sweep too deep';break}
            const sosLvl=str(a,'sosSrc','Range high')==='Swing high'&&Number.isFinite(s.nSwing)?s.nSwing:nCrk;
            if(nc>sosLvl){
              zTop=0;zBot=0;let found=false;for(let k=j-1;k>=Math.max(2,s.sweepI);k--){const q=B[k],q2=B[k-2],bear=d*q.close<d*q.open,gap=d===1?q2.low>q.high:q2.high<q.low;if(bear&&gap){zTop=d===1?q.high:-q.low;zBot=d===1?q.low:-q.high;found=true;break}}
              if(!found){zTop=nSup+(nCrk-nSup)*.5;zBot=nSup}
              entN=str(a,'entryAt','Zone top')==='Zone midpoint'?(zTop+zBot)/2:zTop;const sweepStop=nSpr-buf,zoneStop=zBot-buf;stopN=str(a,'stopAt','Sweep low')==='Sweep low'?sweepStop:zoneStop;
              const riskTry=entN-stopN;if(str(a,'stopAt','Sweep low')==='Sweep low'&&riskTry>0&&(nImp-entN)/riskTry<num(a,'minR',1))stopN=zoneStop;pend=true;s.event=d===1?'SWEEP LONG':'SWEEP SHORT';
            }else if((j-phaseEnd)*tf()>num(a,'sosMin',480)*60){s.stage='No break of range';break}
          } else {
            if(nl<nSup&&wide&&(str(a,'springVol','Low volume')==='Any'||lowV)&&!qual){qual=true;qualI=j;s.event='VOLUME BREAK'}
            if(qual&&j>qualI){
              if(str(a,'trigger','Intent candle')==='Intent candle'){if(intent){entN=nc;stopN=nSpr-buf;s.event=d===1?'VOLUME LONG':'VOLUME SHORT'}}
              else if(!tested){if(nl<=nSup+tol&&nc>=nSup&&candleRange<=num(a,'narrowAtr',.7)*av)tested=true}
              else if(intent){entN=nc;stopN=nSpr-buf;s.event=d===1?'VOLUME LONG':'VOLUME SHORT'}
            }
            if(qual&&!inWindow){s.stage='No trigger inside the window';break}
          }
          if(entN!=null&&stopN!=null){const risk=entN-stopN,tgtB=entN+num(a,'fixedR',2)*risk,tgtA=nCrk>entN?nCrk:tgtB,tp1=Math.min(tgtA,tgtB),tp2=Math.max(tgtA,tgtB),r1=risk>0?(tp1-entN)/risk:0;
            if(risk<=0||(filtered&&r1<num(a,'minR',1))){s.stage='Entry rejected by risk filter';break}
            if(filtered&&tSt>=0&&(phaseEnd-tSt)<(tSt-pi)){s.stage='Phase B shorter than phase A';break}
            s.entry=d*entN;s.entryI=j;s.stop=d*stopN;s.tp1=d*tp1;s.tp2=d*tp2;s.nEntry=entN;s.nStop=stopN;s.nBe=entN+num(a,'beR',1)*risk;s.nTp1=tp1;s.nTp2=tp2;s.zoneBotN=zBot;s.beDone=false;s.tp1Hit=false;s.bePrice=d*s.nBe;s.stage=pend?'Pending limit':'Entry';s.pending=pend;s.zoneTop=d*zTop;s.zoneBot=d*zBot;s.to=j;entryMade=true;break;
          }
        }
      }
      if(!brk&&s.stage==='ACC/DIST'&&frozen)s.stage='Frozen';
      if(s.event||s.stage==='Frozen'||s.stage==='ACC/DIST'||s.stage==='Entry'||s.stage==='Pending limit')states.push(s);
      if(entryMade){
        if(s.pending){for(let j=s.to+1;j<N;j++){const b=B[j],nl=d===1?b.low:-b.high,nh=d===1?b.high:-b.low;
          if(nl<=s.nEntry){s.stage='Entry';s.entryI=j;s.to=j;break}
          if(nh>=s.nTp1){s.stage='Limit cancelled: target first';s.to=j;break}
          if((j-s.to)*tf()>num(a,'pullMin',240)*60){s.stage='Limit expired';s.to=j;break}
        }}
        if(s.stage==='Entry'){const from=s.to;let nStop=s.nStop;for(let j=from+1;j<N;j++){const b=B[j],nl=d===1?b.low:-b.high,nh=d===1?b.high:-b.low,nc=d*b.close;
          if(nl<=nStop){s.stage=s.beDone?'BE':'SL';s.to=j;break}
          if(nh>=s.nTp2){s.stage='TP';s.to=j;break}
          if(!s.tp1Hit&&nh>=s.nTp1){s.tp1Hit=true;if(yes(a,'useBE',true)){s.beDone=true;nStop=s.nEntry}}
          if(yes(a,'useBE',true)&&!s.beDone&&nh>=s.nBe){s.beDone=true;nStop=s.nEntry}
          if(s.pending&&yes(a,'zoneExit',true)&&Number.isFinite(s.zoneBotN)&&nc<s.zoneBotN){s.stage='Zone exit';s.to=j;break}
          if((j-from)*tf()>num(a,'maxHold',24)*3600){s.stage='Expired';s.to=j;break}
        }s.stop=d*nStop;s.beStop=d*nStop;}
        trades.push(s);
      }
      lastBlock[d]=pi;
    }
    const lb=str(a,'lookback','Max'),secs=lb==='1 Day'?86400:lb==='1 Week'?604800:lb==='1 Month'?2592000:Infinity,last=B[N-1].st,keep=x=>last-x.st<=secs;
    const stateOut=states.filter(x=>keep(B[x.from]||B[N-1])).slice(-num(a,'pastSetups',6)),tradeOut=trades.filter(x=>keep(B[x.from]||B[N-1])).slice(-num(a,'pastSetups',6));
    return{states:stateOut,trades:tradeOut,status:filtered?'Filtered':'Core'};
  }
  function drawWyckoff(a,d){
    const B=$bars();if(!B.length)return;const full=str(a,'viewMode','Minimal')==='Full';d.states.forEach(s=>{if(yes(a,'delStopped',true)&&['SL','Stopped'].includes(s.stage))return;if(yes(a,'showRange',true)&&str(a,'viewMode','Minimal')!=='Entries only')box(s.from,s.to,s.high,s.low,color(a,4,'rgba(120,123,134,.08)'),color(a,4,'rgba(120,123,134,.5)'),yes(a,'showLabels',true)?(s.dir===1?'ACC':'DIST'):'');if(str(a,'viewMode','Minimal')!=='Entries only'&&yes(a,'showEvents',true)&&yes(a,'showLabels',true)&&s.event)tag(s.to,s.dir===1?s.low:s.high,s.event,s.dir===1?color(a,0,'#2962FF'):color(a,1,'#F23645'));
      if(s.pending&&yes(a,'showPending',true)&&str(a,'viewMode','Minimal')!=='Entries only'&&Number.isFinite(s.zoneTop)&&Number.isFinite(s.zoneBot))box(s.to,s.to+Math.ceil(num(a,'pullMin',240)*60/tf()),Math.max(s.zoneTop,s.zoneBot),Math.min(s.zoneTop,s.zoneBot),'rgba(120,123,134,.08)',color(a,4,'#787B86'),yes(a,'showLabels',true)?(s.dir===1?'DEMAND':'SUPPLY'):'');
      if(s.entry!=null&&yes(a,'showTrades',true)){const c=s.dir===1?color(a,0,'#2962FF'):color(a,1,'#F23645'),x1=xF(s.entryI??s.to);line(x1,rightX(),s.entry,c,2,s.stage==='Pending limit'?'dashed':'solid');line(x1,rightX(),s.stop,color(a,3,'#777'),1,'dotted');if(s.tp1!=null)line(x1,rightX(),s.tp1,color(a,3,'#777'),1,'dotted');line(x1,rightX(),s.tp2,color(a,3,'#777'),1,'dotted');if(yes(a,'useBE',true)&&yes(a,'showBeLine',true)&&Number.isFinite(s.bePrice))line(x1,rightX(),s.bePrice,color(a,2,'#FF9800'),1,'dotted');if(yes(a,'showLabels',true)){const mode=str(a,'sltpText','Off'),lr=(v)=>s.nEntry!==undefined?(s.dir*(v-s.entry)/Math.max(Math.abs(s.nEntry-s.nStop),1e-12)).toFixed(1)+'R':'';if(mode!=='Off'){tag(s.to,s.entry,s.event+(s.stage==='Pending limit'?' LIMIT?':'')+(yes(a,'showPrices',true)?' '+fmt(s.entry):''),c);tag(s.to,s.stop,mode==='R only'?lr(s.stop):'SL '+fmt(s.stop),color(a,3,'#aaa'));tag(s.to,s.tp2,mode==='R only'?lr(s.tp2):'TP2 '+fmt(s.tp2),color(a,3,'#aaa'));if(s.tp1!=null)tag(s.to,s.tp1,mode==='R only'?lr(s.tp1):'TP1 '+fmt(s.tp1),color(a,3,'#aaa'))}if(s.beDone&&yes(a,'showBeLine',true))tag(s.to,s.bePrice,'BE',color(a,2,'#FF9800'))}}
    });if(yes(a,'showTable',true))drawPanel(a,['Wyckoff+ · '+d.status,'Setups '+d.states.length+' · Trades '+d.trades.length],'Top Right','tableSize')}
  // ===== PO3 Plus — compact accumulation, one-sided manipulation and return / inversion =====
  function poKey(st,period){const n=nyParts(st),minute=n.minute,day=n.date;if(period==='30m'||period==='1H'){const span=period==='30m'?30:60;return day+'-'+period+'-'+Math.floor(minute/span)}if(period==='4H'){const slot=(minute>=1080?minute-1080:minute+360)/240;return day+'-4H-'+Math.floor(slot)}if(period==='Daily')return day+'-D';if(period==='Weekly')return isoWeek(day)+'-W';return day.slice(0,7)+'-M'}
  function calcPO3(a){
    const B=$bars(),N=B.length,period=str(a,'po3Tf','4H'),tfMin=tf()/60,tfLimit=num(a,'tfLimit',15),rangeMin=num(a,'rangeMin',8),rangeMax=num(a,'rangeMax',60),atrLen=14;
    const poSec=period==='30m'?1800:period==='1H'?3600:period==='4H'?14400:period==='Daily'?86400:604800;
    const effectiveLimit=Math.min(tfLimit,poSec/120);
    if(tfMin>effectiveLimit)return{groups:[],setups:[],error:'PO3 timeframe guard: chart phải ≤ '+effectiveLimit+' phút (nửa PO3 timeframe và giới hạn cài đặt)'};
    const tr=[],atr=[];for(let i=0;i<N;i++){const b=B[i],pr=B[i-1],r=Math.max(b.high-b.low,pr?Math.abs(b.high-pr.close):0,pr?Math.abs(b.low-pr.close):0);tr[i]=r;atr[i]=i?((atr[i-1]*(atrLen-1)+r)/atrLen):r}
    const groups=new Map();for(let i=0;i<N;i++){const k=poKey(B[i].st,period);let g=groups.get(k);if(!g){g={key:k,from:i,to:i,open:B[i].open,hi:B[i].high,lo:B[i].low};groups.set(k,g)}else{g.to=i;g.hi=Math.max(g.hi,B[i].high);g.lo=Math.min(g.lo,B[i].low)}}
    const G=[...groups.values()],setups=[],leg=num(a,'legStrength',3),pivH=[],pivL=[];
    for(let i=leg;i<N-leg;i++){let hi=true,lo=true;for(let j=i-leg;j<=i+leg;j++){if(j!==i&&B[j].high>=B[i].high)hi=false;if(j!==i&&B[j].low<=B[i].low)lo=false}if(hi)pivH.push({i,p:B[i].high,taken:false});if(lo)pivL.push({i,p:B[i].low,taken:false})}
    for(const g of G){let used=false;
      for(let i=Math.max(g.from+rangeMin,g.from+1);i<=g.to&&!used;i++){
        let hi=-Infinity,lo=Infinity,n=0,from=i;const cap=Math.min(rangeMax,i-g.from);
        for(let j=1;j<=cap;j++){const b=B[i-j],nh=Math.max(hi,b.high),nl=Math.min(lo,b.low);if(nh-nl>num(a,'rangeAtr',5)*(atr[i]||atr[i-j]||1))break;hi=nh;lo=nl;n=j;from=i-j}
        if(n<rangeMin||!(hi>lo))continue;
        const close1=B[i-1].close,closeN=B[from].close;if(Math.abs(close1-closeN)>num(a,'driftPct',50)/100*(hi-lo))continue;
        const up=B[i].high>hi,dn=B[i].low<lo;if(up===dn)continue;const dir=dn?1:-1;
        const poOpen=g.open,manExt=dir===1?B[i].low:B[i].high;
        const setup={dir,from,sweep:i,rangeHi:hi,rangeLo:lo,poOpen,poKey:g.key,manExt,manExtI:i,ret:null,entry:null,stop:null,tp1:null,tp2:null,stage:'Manipulation',to:i,how:'',origin:null};
        let state=1,done=false,retT=-1,fv=[];
        const endBound=Math.min(N-1,yes(a,'po3Gate',true)?g.to:g.to+Math.ceil(num(a,'entryWin',60)*60/tf()));
        for(let j=i;j<=endBound;j++){
          const b=B[j],av=Math.max(1e-12,atr[j]||1);setup.to=j;
          if(state===1){if(dir===1)setup.manExt=Math.min(setup.manExt,b.low);else setup.manExt=Math.max(setup.manExt,b.high);setup.manExtI=j;
            const farClose=dir===1?b.close>setup.rangeHi:b.close<setup.rangeLo;
            const backIn=dir===1?b.close>setup.rangeLo&&b.close<=setup.rangeHi:b.close<setup.rangeHi&&b.close>=setup.rangeLo;
            const strong=Math.abs(b.close-b.open)>=num(a,'dispAtr',.8)*av&&(dir===1?b.close>b.open:b.close<b.open);
            if(farClose){setup.stage='Invalid: far-side close';break}
            if(backIn&&strong){const pass=!yes(a,'po3Gate',true)||(dir===1?setup.manExt<poOpen:setup.manExt>poOpen);if(!pass){setup.stage='Invalid: PO3 open';break}state=2;retT=j;setup.ret=j;setup.stage='Distribution'}
            else if((j-i)*tf()>=num(a,'manipMin',30)*60){setup.stage='Manipulation expired';break}
          } else if(state===2){
            const breached=dir===1?b.low<setup.manExt:b.high>setup.manExt,farClose=dir===1?b.close>setup.rangeHi:b.close<setup.rangeLo;
            if(breached){setup.stage='Invalid: sweep extreme traded';break}if(farClose){setup.stage='Invalid: ran through range';break}if((j-retT)*tf()>=num(a,'entryWin',60)*60){setup.stage='Entry window expired';break}
            if(j>=2){const bear=B[j].high<B[j-2].low,bull=B[j].low>B[j-2].high;if(dir===1&&bear)fv.push({top:B[j-2].low,bot:B[j].high,i:j-2});else if(dir===-1&&bull)fv.push({top:B[j].low,bot:B[j-2].high,i:j-2});if(fv.length>20)fv.shift()}
            let inv=null;if(str(a,'entryMode','Inversion')!=='Retest'){for(let z=fv.length-1;z>=0;z--){const f=fv[z],hit=dir===1?b.close>f.top:b.close<f.bot;if(hit){inv=f;break}}}
            const ret=str(a,'entryMode','Inversion')!=='Inversion'&&j>retT&&(dir===1?b.low<=setup.rangeLo&&b.close>setup.rangeLo:b.high>=setup.rangeHi&&b.close<setup.rangeHi);
            const fire=str(a,'entryMode','Inversion')==='Inversion'?!!inv:str(a,'entryMode','Inversion')==='Retest'?ret:!!inv||ret;
            if(fire){const entry=b.close,stop=setup.manExt,risk=Math.abs(entry-stop);if(!(risk>0)){setup.stage='Invalid stop';break}
              setup.entry=entry;setup.stop=stop;setup.how=inv?'IFVG':'Retest';
              if(str(a,'targetMode','2R')==='2R'){setup.tp2=entry+dir*num(a,'rr',2)*risk;}
              else if(str(a,'targetMode','2R')==='Prior liquidity'){
                const src=dir===1?pivH:pivL;const ahead=src.filter(v=>v.i<j&&(v.p-entry)*dir>0&&!B.slice(v.i+1,j).some(q=>dir===1?q.high>v.p:q.low<v.p)).map(v=>v.p).sort((x,y)=>(x-entry)*dir-(y-entry)*dir);setup.tp2=ahead[0]??null;
              }else{
                let origin=dir===1?setup.rangeHi:setup.rangeLo,oi=i; // pivot list below approximates the last confirmed swing inside the range
                const src=dir===1?pivH:pivL,origins=src.filter(v=>v.i<setup.manExtI&&v.i>=from);if(origins.length){const q=origins[origins.length-1];origin=q.p;oi=q.i}
                const legSize=Math.abs(setup.manExt-origin);setup.origin=origin;setup.originI=oi;setup.tp1=origin+dir*2*legSize;setup.tp2=origin+dir*4*legSize;
              }
              if(!Number.isFinite(setup.tp2)||(setup.tp2-entry)*dir<=0){setup.stage='No valid target';setup.entry=null;break}
              setup.stage='Entry';const after=j;let stopNow=stop,tp1Hit=false;
              for(let z=after+1;z<N;z++){const q=B[z],stopped=dir===1?q.low<=stopNow:q.high>=stopNow,first=setup.tp1!=null&&!tp1Hit&&(dir===1?q.high>=setup.tp1:q.low<=setup.tp1),last=dir===1?q.high>=setup.tp2:q.low<=setup.tp2;if(stopped){setup.stage=tp1Hit&&yes(a,'useBE')?'BE':'SL';setup.to=z;break}if(first){tp1Hit=true;if(yes(a,'useBE'))stopNow=entry}if(last){setup.stage='TP';setup.to=z;break}if(z-after>Math.ceil(24*3600/tf())){setup.stage='Expired';setup.to=z;break}}
              setup.stopFinal=stopNow;done=true;break;
            }
          }
        }
        setups.push(setup);used=true;
      }
    }
    return{groups:G.slice(-num(a,'framesKept',3)),setups:setups.filter(s=>str(a,'viewMode','Minimal')==='Full'||!String(s.stage).startsWith('Invalid')).slice(-num(a,'maxSetups',4))};
  }
  function drawPO3(a,d){
    if(d.error){ctx.save();ctx.fillStyle='#e7b85b';ctx.font='11px Space Grotesk';ctx.fillText('PO3+: '+d.error,10,18);ctx.restore();return}
    if(yes(a,'showFrame',true))d.groups.forEach(g=>{box(g.from,g.to,g.hi,g.lo,'rgba(120,123,134,.015)',color(a,6,'#787B86'),yes(a,'showLabels',true)?'PO3 '+str(a,'po3Tf','4H'):'');if(yes(a,'showOpen',true))line(xF(g.from),xF(g.to),g.open,color(a,6,'#787B86'),1,'dotted')});
    d.setups.forEach(s=>{const c=s.dir===1?color(a,0,'#2962FF'):color(a,1,'#F23645');if(yes(a,'showBoxes',true)){box(s.from,s.sweep,s.rangeHi,s.rangeLo,'rgba(8,153,129,.08)',color(a,3,'#4CAF50'),yes(a,'showLabels',true)?'ACC':'');box(s.sweep,s.to,s.dir===1?s.rangeLo:s.rangeHi,s.manExt,'rgba(242,54,69,.08)',color(a,4,'#F23645'),yes(a,'showLabels',true)?'MANIP':'')}
      if(yes(a,'showLeg',true))trend(s.sweep,s.dir===1?s.rangeLo:s.rangeHi,s.manExtI,s.manExt,color(a,7,'#787B86'),2);if(yes(a,'showProj')&&s.origin!=null){const leg=Math.abs(s.manExt-s.origin),a2=s.origin+s.dir*2*leg,b2=s.origin+s.dir*2.5*leg,a4=s.origin+s.dir*4*leg,b4=s.origin+s.dir*4.5*leg;box(s.manExtI,s.to,Math.max(a2,b2),Math.min(a2,b2),'rgba(120,123,134,.06)',color(a,6,'#787B86'),'2 SD');box(s.manExtI,s.to,Math.max(a4,b4),Math.min(a4,b4),'rgba(120,123,134,.04)',color(a,6,'#787B86'),'4 SD')}
      if(s.ret!=null&&yes(a,'showPending',true))tag(s.ret,s.dir===1?s.rangeLo:s.rangeHi,'RETEST / IFVG?',c);
      if(s.entry!=null&&yes(a,'showTrades',true)){line(xF(s.sweep),rightX(),s.entry,c,2);line(xF(s.sweep),rightX(),s.stopFinal??s.stop,color(a,6,'#777'),1,'dotted');if(s.tp1!=null)line(xF(s.sweep),rightX(),s.tp1,color(a,6,'#777'),1,'dotted');line(xF(s.sweep),rightX(),s.tp2,color(a,6,'#777'),1,'dotted');if(yes(a,'showLabels',true)){tag(s.to,s.entry,'PO3 '+(s.dir===1?'LONG':'SHORT')+(yes(a,'showPrices')?' '+fmt(s.entry):''),c,undefined,false,sizePx(a,'textSize'));tag(s.to,s.stopFinal??s.stop,'SL'+(yes(a,'showPrices')?' '+fmt(s.stopFinal??s.stop):''),color(a,6,'#aaa'),undefined,false,sizePx(a,'textSize'));if(s.tp1!=null)tag(s.to,s.tp1,'TP1'+(yes(a,'showPrices')?' '+fmt(s.tp1):''),color(a,6,'#aaa'),undefined,false,sizePx(a,'textSize'));tag(s.to,s.tp2,'TP'+(yes(a,'showPrices')?' '+fmt(s.tp2):''),color(a,6,'#aaa'),undefined,false,sizePx(a,'textSize'))}}
      if(s.entry==null&&yes(a,'showPending',true)&&yes(a,'showLabels',true))tag(s.to,s.manExt,'MANIP? '+s.stage,c);
    });
    if(yes(a,'showTable',true))drawPanel(a,['PO3 '+str(a,'po3Tf','4H'),'Setups: '+d.setups.length],'Top Left','tableSize')}
  // Public hooks used by the chart's canvas renderer and its RAF invalidation signature.
  window.marketModelIndicatorsRenderKey=()=>{
    const ids=(ACT||[]).filter(a=>KEY.includes(a.key)).map(mkSig).join('~');return ids+'#'+barSig()+'#'+PAIR.version+'#'+PAIR.loading;
  };
  window.drawMarketModelIndicators=(w,h)=>{
    if(!Array.isArray(ACT)||!$bars().length)return;
    for(const k of KEY){const a=active(k);if(!a)continue;try{
      if(k==='ssmtPlus'){const wanted=str(a,'pairMode','Auto')==='Manual'?str(a,'pairSymbol','US500'):autoPairName();if(!PAIR.loading&&(PAIR.request!==wanted||Date.now()-PAIR.at>300000|| (PAIR.data.length&&PAIR.from>s2u(agg[0].st))||(CT?.ready&&!PAIR.data.length&&PAIR.error.includes('cTrader'))))loadPair(a).catch(e=>{PAIR.error=String(e.message||e);PAIR.loading=false;PAIR.version++});const d=cacheGet(a,calcSSMT);drawSSMT(a,d)}
      else if(k==='crtSoup')drawCRT(a,cacheGet(a,calcCRT));
      else if(k==='sdRangePlus')drawSD(a,cacheGet(a,calcSD),w);
      else if(k==='wyckoffPlus')drawWyckoff(a,cacheGet(a,calcWyckoff));
      else if(k==='po3Plus')drawPO3(a,cacheGet(a,calcPO3));
    }catch(e){if(typeof chErr==='function')chErr('market-model-'+k,e);else console.warn('[market-model]',k,e)}}
  };
  window.marketModelIndicatorsStatus=()=>({pair:{symbol:PAIR.symbol,error:PAIR.error,loading:PAIR.loading,bars:PAIR.data.length},active:(ACT||[]).filter(a=>KEY.includes(a.key)).map(a=>({key:a.key,on:a.on}))});
})();
