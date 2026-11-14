/* ICT QuantLab session/period helpers.
   Uses the chart's A.s server-time axis (the app's New-York-close-normalized clock).
   It does not import an exchange holiday/session calendar. */
(function(){
  'use strict';
  const num=(v,d=0)=>Number.isFinite(+v)?+v:d;
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  function sessionOffset(p={}){
    const hour=clamp(Math.round(num(p.sessionStartHour,0)),0,23);
    const minute=clamp(Math.round(num(p.sessionStartMinute,0)),0,59);
    return (hour*60+minute)*60;
  }
  function collect(A,p={}){
    const offset=sessionOffset(p);
    const duration=Math.max(60,Math.round(num(p.sessionMinutes,1440))*60);
    const ts=A.s||A.t||[];
    const keys=ts.map(s=>Number.isFinite(+s)?Math.floor((+s-offset)/duration):null);
    const groups=[];let last=null,g=null;
    for(let i=0;i<keys.length;i++){
      const k=keys[i];if(k==null)continue;
      if(k!==last){g={key:k,first:i,last:i,start:k*duration+offset,open:num(A.o[i]),high:num(A.h[i]),low:num(A.l[i]),close:num(A.c[i]),indices:[]};groups.push(g);last=k;}
      g.last=i;g.close=num(A.c[i]);g.high=Math.max(g.high,num(A.h[i]));g.low=Math.min(g.low,num(A.l[i]));g.indices.push(i);
    }
    return {keys,groups,duration,offset};
  }
  function collectPeriods(A,p={},period='day'){
    const offset=sessionOffset(p),ts=A.s||A.t||[],keys=[],groups=[];let last=null,g=null;
    for(let i=0;i<ts.length;i++){
      const raw=Number(ts[i]);if(!Number.isFinite(raw)){keys.push(null);continue;}
      const shifted=raw-offset,day=Math.floor(shifted/86400);let key;
      if(period==='week') key=Math.floor((day+3)/7); // Monday-based UTC/server calendar week
      else if(period==='month'){const d=new Date(shifted*1000);key=d.getUTCFullYear()*12+d.getUTCMonth();}
      else key=day;
      keys.push(key);
      if(key!==last){g={key,first:i,last:i,start:shifted,open:num(A.o[i]),high:num(A.h[i]),low:num(A.l[i]),close:num(A.c[i]),indices:[]};groups.push(g);last=key;}
      g.last=i;g.close=num(A.c[i]);g.high=Math.max(g.high,num(A.h[i]));g.low=Math.min(g.low,num(A.l[i]));g.indices.push(i);
    }
    return {keys,groups,period,offset};
  }
  function currentAndPrevious(A,p={}){
    const x=collect(A,p),n=(A.c||[]).length;
    const open=Array(n).fill(null),high=Array(n).fill(null),low=Array(n).fill(null),close=Array(n).fill(null);
    const prevHigh=Array(n).fill(null),prevLow=Array(n).fill(null),prevClose=Array(n).fill(null);
    x.groups.forEach((g,gi)=>{
      const prev=x.groups[gi-1];let hi=-Infinity,lo=Infinity;
      for(const i of g.indices){hi=Math.max(hi,num(A.h[i]));lo=Math.min(lo,num(A.l[i]));open[i]=g.open;high[i]=hi;low[i]=lo;close[i]=num(A.c[i]);
        if(prev){prevHigh[i]=prev.high;prevLow[i]=prev.low;prevClose[i]=prev.close;}}
    });
    return {...x,open,high,low,close,prevHigh,prevLow,prevClose};
  }
  window.ATASSessionRuntime={collect,collectPeriods,currentAndPrevious,num,sessionOffset};
})();
