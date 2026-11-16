/* ICT QuantLab chart-style transforms.
 * Time-based styles preserve source OHLC. Synthetic styles are explicitly derived
 * from the selected source bars; OHLC-only inputs cannot reconstruct intrabar tick order.
 */
(function (root) {
  "use strict";
  const DEFINITIONS = [
    { id: "candles", label: "Candlesticks", group: "Standard" },
    { id: "ohlc", label: "OHLC Bars", group: "Standard" },
    { id: "line", label: "Line", group: "Standard" },
    { id: "area", label: "Area", group: "Standard" },
    { id: "baseline", label: "Baseline", group: "Standard" },
    { id: "hollow", label: "Hollow Candles", group: "Candle variants" },
    { id: "heikin", label: "Heikin Ashi", group: "Candle variants" },
    { id: "step", label: "Step Line", group: "Line variants" },
    { id: "trend", label: "Colored Trend Line", group: "Line variants" },
    { id: "range", label: "Range Bars", group: "Price-based" },
    { id: "renko", label: "Renko", group: "Price-based" },
    { id: "tick", label: "Tick Bars · M1 proxy", group: "Activity-based" },
    { id: "volume", label: "Volume Bars · tick-volume proxy", group: "Activity-based" },
    { id: "linebreak", label: "Three Line Break", group: "Price-based" },
    { id: "kagi", label: "Kagi", group: "Price-based" },
    { id: "pnf", label: "Point & Figure", group: "Price-based" },
  ];
  const byId = Object.fromEntries(DEFINITIONS.map(x => [x.id, x]));
  const finite = v => Number.isFinite(+v);
  const clone = b => ({ ...b });
  const makeBar = (source, open, high, low, close, v, extra = {}) => ({
    st: source.st, time: source.time, open, high, low, close,
    v: Number.isFinite(+v) ? +v : 0, ...extra,
    _sourceSt: source.st,
  });
  const setUniqueSyntheticTimes = bars => {
    const groups = new Map();
    bars.forEach((b, i) => {
      const k = String(b._sourceSt ?? b.st ?? b.time);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push({ b, i });
    });
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const base = +group[0].b._sourceSt;
      group.forEach(({ b }, i) => {
        const t = base + ((i + 1) / (group.length + 1)) * 0.9;
        b.st = t;
        b.time = t;
      });
    }
    for (const b of bars) delete b._sourceSt;
    return bars;
  };
  function heikinAshi(src) {
    let prevOpen = null, prevClose = null;
    return src.map(b => {
      const close = (b.open + b.high + b.low + b.close) / 4;
      const open = prevOpen == null ? (b.open + b.close) / 2 : (prevOpen + prevClose) / 2;
      const out = { ...b, open, close, high: Math.max(b.high, open, close), low: Math.min(b.low, open, close) };
      prevOpen = open; prevClose = close;
      return out;
    });
  }
  function rangeBars(src, opt) {
    const size = Math.max(1e-12, +opt.rangeSize || 0);
    if (!src.length || !finite(size)) return src.map(clone);
    const out = [];
    let anchor = src[0].open, cur = null, lastPrice = anchor;
    const start = (b, p) => { cur = { _sourceSt: b.st, open: anchor, high: Math.max(anchor, p), low: Math.min(anchor, p), close: p, v: 0 }; };
    for (const b of src) {
      const priorVolume=cur?cur.v:0,completedAtStart=out.length;
      if(cur)cur.v=0;
      const path = b.close >= b.open ? [b.open, b.low, b.high, b.close] : [b.open, b.high, b.low, b.close];
      if (!cur) start(b, path[0]);
      for (let pi = 1; pi < path.length; pi++) {
        const target = path[pi], from = lastPrice;
        if (!cur) start(b, from);
        cur.high = Math.max(cur.high, from, target);
        cur.low = Math.min(cur.low, from, target);
        cur.close = target;
        let guard = 0;
        while (Math.abs(target - anchor) >= size && guard++ < 2000) {
          const dir = target > anchor ? 1 : -1;
          const next = anchor + dir * size;
          const completed = makeBar({ st: b.st, time: b.st }, anchor, Math.max(anchor, next), Math.min(anchor, next), next, 0);
          completed._sourceSt = b.st;
          out.push(completed);
          anchor = next;
          cur = { _sourceSt: b.st, open: anchor, high: Math.max(anchor, target), low: Math.min(anchor, target), close: target, v: 0 };
        }
        lastPrice = target;
      }
      const completedNow=out.length-completedAtStart,volumeToAllocate=priorVolume+Math.max(0,+b.v||0);
      if(completedNow>0){const each=volumeToAllocate/completedNow;for(let i=completedAtStart;i<out.length;i++)out[i].v+=each;if(cur)cur.v=0;}
      else if(cur)cur.v=volumeToAllocate;
      if (cur) cur._sourceSt = b.st;
    }
    if (cur && (cur.high !== cur.open || cur.low !== cur.open || cur.close !== cur.open)) {
      out.push(makeBar({ st: cur._sourceSt, time: cur._sourceSt }, cur.open, cur.high, cur.low, cur.close, cur.v, { forming: true }));
    }
    return setUniqueSyntheticTimes(out);
  }
  function renko(src, opt) {
    const size = Math.max(1e-12, +opt.renkoSize || 0);
    if (!src.length || !finite(size)) return src.map(clone);
    const out = [];
    let anchor = src[0].open, dir = 0;
    for (const b of src) {
      const p = b.close;
      let guard = 0;
      while (guard++ < 2000) {
        let nextDir = 0, open = anchor, close = anchor;
        if (!dir) {
          if (p >= anchor + size) nextDir = 1;
          else if (p <= anchor - size) nextDir = -1;
        } else if (dir > 0) {
          if (p >= anchor + size) nextDir = 1;
          else if (p <= anchor - 2 * size) { nextDir = -1; open = anchor - size; close = anchor - 2 * size; }
        } else {
          if (p <= anchor - size) nextDir = -1;
          else if (p >= anchor + 2 * size) { nextDir = 1; open = anchor + size; close = anchor + 2 * size; }
        }
        if (!nextDir) break;
        if (close === anchor) close = anchor + nextDir * size;
        const bar = makeBar(b, open, Math.max(open, close), Math.min(open, close), close, 0, { direction: nextDir });
        bar._sourceSt = b.st; out.push(bar); anchor = close; dir = nextDir;
      }
    }
    return setUniqueSyntheticTimes(out);
  }
  function activityBars(src, threshold) {
    const target = Math.max(1, Math.floor(+threshold || 1));
    const out = []; let cur = null;
    for (const b of src) {
      if (!cur) cur = { _sourceSt: b.st, open: b.open, high: b.high, low: b.low, close: b.close, v: 0 };
      else { cur.high = Math.max(cur.high, b.high); cur.low = Math.min(cur.low, b.low); cur.close = b.close; }
      cur.v += Math.max(0, +b.v || 0); cur._sourceSt = b.st;
      if (cur.v >= target) {
        out.push(makeBar({ st: cur._sourceSt, time: cur._sourceSt }, cur.open, cur.high, cur.low, cur.close, cur.v, { completed: true }));
        out[out.length - 1]._sourceSt = cur._sourceSt;
        cur = null;
      }
    }
    if (cur) out.push(makeBar({ st: cur._sourceSt, time: cur._sourceSt }, cur.open, cur.high, cur.low, cur.close, cur.v, { forming: true }));
    return setUniqueSyntheticTimes(out);
  }
  function lineBreak(src, count) {
    const n = Math.max(1, Math.floor(+count || 3)), out = [];
    for (const b of src) {
      if (!out.length) { const first = makeBar(b, b.open, b.high, b.low, b.close, b.v); first._sourceSt = b.st; out.push(first); continue; }
      const hist = out.slice(-n), top = Math.max(...hist.map(x => x.high)), bot = Math.min(...hist.map(x => x.low));
      const prev = out[out.length - 1];
      let dir = 0;
      if (b.close > top) dir = 1;
      else if (b.close < bot) dir = -1;
      if (!dir) continue;
      const open = prev.close, close = b.close;
      const q = makeBar(b, open, Math.max(open, close), Math.min(open, close), close, b.v, { direction: dir });
      q._sourceSt = b.st; out.push(q);
    }
    return setUniqueSyntheticTimes(out);
  }
  function kagi(src, reversal) {
    const rev = Math.max(1e-12, +reversal || 0), out = [];
    if (!src.length) return out;
    let direction = 0, extreme = src[0].close, anchor = extreme;
    const add = (source, from, to, dir) => { const q=makeBar(source,from,Math.max(from,to),Math.min(from,to),to,source.v,{direction:dir});q._sourceSt=source.st;out.push(q); };
    for (let i=1;i<src.length;i++) {
      const b=src[i],p=b.close;
      if (!direction) {
        if (p >= anchor + rev) { direction=1; extreme=p; add(b,anchor,p,direction); }
        else if (p <= anchor - rev) { direction=-1; extreme=p; add(b,anchor,p,direction); }
      } else if (direction>0) {
        if (p>extreme) { extreme=p; if(out.length){const z=out[out.length-1];z.high=Math.max(z.high,p);z.close=p;z._sourceSt=b.st;z.st=b.st;z.time=b.time;} }
        else if (extreme-p>=rev) { add(b,extreme,p,-1); direction=-1; anchor=extreme; extreme=p; }
      } else {
        if (p<extreme) { extreme=p; if(out.length){const z=out[out.length-1];z.low=Math.min(z.low,p);z.close=p;z._sourceSt=b.st;z.st=b.st;z.time=b.time;} }
        else if (p-extreme>=rev) { add(b,extreme,p,1); direction=1; anchor=extreme; extreme=p; }
      }
    }
    return setUniqueSyntheticTimes(out);
  }
  function pointFigure(src, boxSize, reversal) {
    const box = Math.max(1e-12,+boxSize||0), rev = Math.max(1,Math.floor(+reversal||3)), out=[];
    if(!src.length)return out;
    let dir=0, top=src[0].close, bottom=top;
    for(let i=1;i<src.length;i++){
      const b=src[i],p=b.close;
      if(!dir){
        if(p>=bottom+box){dir=1;top=bottom+Math.floor((p-bottom)/box)*box;const q=makeBar(b,bottom,top,bottom,top,b.v,{direction:1,column:"X"});q._sourceSt=b.st;out.push(q)}
        else if(p<=top-box){dir=-1;bottom=top-Math.floor((top-p)/box)*box;const q=makeBar(b,top,top,bottom,bottom,b.v,{direction:-1,column:"O"});q._sourceSt=b.st;out.push(q)}
      }else if(dir>0){
        if(p>=top+box){top+=Math.floor((p-top)/box)*box;const q=makeBar(b,bottom,top,bottom,top,b.v,{direction:1,column:"X"});q._sourceSt=b.st;out[out.length-1]=q}
        else if(top-p>=rev*box){dir=-1;bottom=top-box;bottom-=Math.floor((bottom-p)/box)*box;const q=makeBar(b,top,top,bottom,bottom,b.v,{direction:-1,column:"O"});q._sourceSt=b.st;out.push(q)}
      }else{
        if(p<=bottom-box){bottom-=Math.floor((bottom-p)/box)*box;const q=makeBar(b,top,top,bottom,bottom,b.v,{direction:-1,column:"O"});q._sourceSt=b.st;out[out.length-1]=q}
        else if(p-bottom>=rev*box){dir=1;top=bottom+box;top+=Math.floor((p-top)/box)*box;const q=makeBar(b,bottom,top,bottom,top,b.v,{direction:1,column:"X"});q._sourceSt=b.st;out.push(q)}
      }
    }
    return setUniqueSyntheticTimes(out);
  }
  function transform(source, type, options = {}) {
    const bars = Array.isArray(source) ? source : [];
    switch (type) {
      case "heikin": return heikinAshi(bars);
      case "range": return rangeBars(bars, options);
      case "renko": return renko(bars, options);
      case "tick": return activityBars(bars, options.tickSize || 250);
      case "volume": return activityBars(bars, options.volumeSize || 500);
      case "linebreak": return lineBreak(bars, options.lineBreakCount || 3);
      case "kagi": return kagi(bars, options.kagiReversal || 1);
      case "pnf": return pointFigure(bars, options.pnfBoxSize || 1, options.pnfReversal || 3);
      default: return bars.map(clone);
    }
  }
  function isSynthetic(type) { return ["range","renko","tick","volume","linebreak","kagi","pnf"].includes(type); }
  function isCandleLike(type) { return ["candles","hollow","heikin","range","renko","linebreak","pnf"].includes(type); }
  function dataForSeries(bars, type, colors = {}) {
    switch (type) {
      case "ohlc": return bars.map(b => ({ time:b.time, open:b.open, high:b.high, low:b.low, close:b.close }));
      case "line": case "step": case "kagi": return bars.map(b => ({ time:b.time, value:b.close }));
      case "area": return bars.map(b => ({ time:b.time, value:b.close }));
      case "baseline": return bars.map(b => ({ time:b.time, value:b.close }));
      case "trend": return bars.map((b,i) => ({ time:b.time, value:b.close, color:i && b.close < bars[i-1].close ? (colors.down||"#ff5c8a") : (colors.up||"#3df5c0") }));
      default: return bars.map(b => ({ time:b.time, open:b.open, high:b.high, low:b.low, close:b.close }));
    }
  }
  function dataForVolume(bars, colors = {}) {
    return bars.map(b => ({ time:b.time, value:+b.v||0, color:(b.close>=b.open?(colors.up||"#3df5c0"):(colors.down||"#ff5c8a"))+"55" }));
  }
  const api = { DEFINITIONS, byId, transform, isSynthetic, isCandleLike, dataForSeries, dataForVolume };
  root.QLChartTypes = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
