/* ATAS indicator module: Depth Of Market (DOM) | source: Technical/DOM.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  // Implemented by an existing QuantLab feature module, not by an ATAS formula port.
  // Required registry key: dom.
  window.ATASIndicatorFiles["dom"] = { ...{"id": "dom", "name": "DOM / Level II", "sourceClass": "DOM", "sourceFile": "Technical/DOM.cs", "group": "orderflow", "requirement": "depth", "status": "existing", "conversion": "existing_module", "addKey": "dom"}, moduleFile: "indicators/individual/dom.js", moduleType: "existing" };
})();
