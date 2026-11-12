/* ICT QuantLab PWA: iOS Add to Home Screen + install prompt for supported browsers. */
(()=>{
  const $=id=>document.getElementById(id);
  const btn=$("pwaInstallButton"),status=$("pwaInstallStatus"),dialog=$("pwaHelpDialog");
  const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(
    navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
  const isStandalone=()=>window.matchMedia?.("(display-mode: standalone)").matches||navigator.standalone===true;
  let installPrompt=null;

  if(isStandalone()){
    if(status)status.textContent="QuantLab đang chạy dưới dạng ứng dụng đã cài trên thiết bị này.";
    if(btn){btn.textContent="Đã cài ứng dụng";btn.disabled=true;}
  }else if(isIOS()){
    if(status)status.textContent="Trên iPhone: mở bằng Safari → Chia sẻ → Thêm vào Màn hình chính.";
    if(btn)btn.textContent="Hướng dẫn cài iPhone";
  }

  window.addEventListener("beforeinstallprompt",event=>{
    event.preventDefault();installPrompt=event;
    if(btn){btn.textContent="Cài QuantLab";btn.disabled=false;}
    if(status)status.textContent="Thiết bị hỗ trợ cài ứng dụng trực tiếp từ trình duyệt.";
  });
  window.addEventListener("appinstalled",()=>{
    installPrompt=null;
    if(status)status.textContent="QuantLab đã được cài trên thiết bị này.";
    if(btn){btn.textContent="Đã cài ứng dụng";btn.disabled=true;}
  });

  btn?.addEventListener("click",async()=>{
    if(installPrompt){
      const prompt=installPrompt;installPrompt=null;
      try{await prompt.prompt();const choice=await prompt.userChoice;if(status)status.textContent=choice?.outcome==="accepted"?"Đã gửi yêu cầu cài QuantLab.":"Bạn có thể cài ứng dụng sau trong menu trình duyệt.";}
      catch(e){if(status)status.textContent="Không mở được hộp thoại cài đặt. Hãy dùng menu trình duyệt.";}
      return;
    }
    if(dialog?.showModal){if(!dialog.open)dialog.showModal();}
    else if(dialog){dialog.setAttribute("open","");dialog.hidden=false;}
  });
  dialog?.querySelectorAll("[data-pwa-close]").forEach(el=>el.addEventListener("click",()=>{
    if(typeof dialog.close==="function")dialog.close();else{dialog.removeAttribute("open");dialog.hidden=true;}
  }));
  dialog?.addEventListener("click",event=>{if(event.target===dialog)dialog.close?.()});

  // Service workers require HTTPS, except localhost during development.
  const secure=location.protocol==="https:"||["localhost","127.0.0.1"].includes(location.hostname);
  if("serviceWorker" in navigator&&secure){
    window.addEventListener("load",()=>{
      navigator.serviceWorker.register("./sw.js",{scope:"./"})
        .then(reg=>{reg.update().catch(()=>{});})
        .catch(error=>console.info("QuantLab PWA: service worker unavailable",error));
    },{once:true});
  }else if(status){
    status.textContent="PWA cần HTTPS (GitHub Pages đã hỗ trợ HTTPS).";
  }
})();
