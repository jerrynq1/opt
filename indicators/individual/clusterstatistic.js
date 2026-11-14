/* ATAS indicator module: Cluster Statistic (ClusterStatistic) | source: Technical/ClusterStatistic.cs */
(function(){
  'use strict';
  window.ATASIndicatorFiles = window.ATASIndicatorFiles || {};
  // Implemented by an existing QuantLab feature module, not by an ATAS formula port.
  // Required registry key: dst.
  window.ATASIndicatorFiles["clusterstatistic"] = { ...{"id": "clusterstatistic", "name": "Cluster Statistic", "sourceClass": "ClusterStatistic", "sourceFile": "Technical/ClusterStatistic.cs", "group": "orderflow", "requirement": "quote_footprint", "status": "existing", "conversion": "quote_tick_proxy", "addKey": "dst"}, moduleFile: "indicators/individual/clusterstatistic.js", moduleType: "existing" };
})();
