buildTfs();applyTfOpts();applyTz();clk();setTheme();setSide();
{const hv=(location.hash||"").slice(1),v0=V.some(([k])=>k===hv)?hv:(ctHasKey()?"chart":"conn");show(v0)}   // chưa có key: mở thẳng mục Kết nối
loadM1();
setInterval(poll,250);setInterval(clk,1000);
requestAnimationFrame(()=>requestAnimationFrame(()=>document.body.classList.remove("nt")));
