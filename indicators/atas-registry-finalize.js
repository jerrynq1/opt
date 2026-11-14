/* Finalize the ATAS port registry after all individual indicator modules load. */
(function(){
  'use strict';
  const keys = Object.keys(IND).filter(k => IND[k] && IND[k].cat === 'at');
  if (window.ATASIndicatorPorts) window.ATASIndicatorPorts.registeredKeys = keys;
  if (window.ATASQuoteTickPorts) {
    window.ATASQuoteTickPorts.registeredKeys = Object.keys(IND).filter(k => window.ATASQuoteTickPorts.keys.includes(k));
  }
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  window.ATASIndicatorFiles.summary = {
    catalogCount: window.ATAS_INDICATOR_CATALOG.length,
    moduleCount: Object.keys(window.ATASIndicatorFiles).filter(k => k !== 'summary').length,
    implementedCount: window.ATAS_INDICATOR_CATALOG.filter(x => x.addKey && !!IND[x.addKey]).length,
    quoteTickKeys: window.ATASQuoteTickPorts ? window.ATASQuoteTickPorts.registeredKeys.slice() : []
  };
})();
