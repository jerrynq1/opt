buildTfs();applyTfOpts();applyTz();clk();setTheme();setSide();
{const hv=(location.hash||"").slice(1),v0=V.some(([k])=>k===hv)?hv:"chart";show(v0)}   // Mặc định mở Chart; cấu hình cTrader qua tab Connection khi cần.
loadM1();
setInterval(poll,250);setInterval(clk,1000);
requestAnimationFrame(()=>requestAnimationFrame(()=>document.body.classList.remove("nt")));
