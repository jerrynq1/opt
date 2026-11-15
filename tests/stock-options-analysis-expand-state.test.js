'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const sourcePath = path.join(__dirname, '..', 'js', 'stock-options.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const marker = '// Preserve each Analysis accordion state when live Spot/Options updates';
const start = source.indexOf(marker);
assert.notEqual(start, -1, 'accordion state-preservation helper must exist');
const endMarker = '  function renderOptionsAnalysis(s){';
const end = source.indexOf(endMarker, start);
assert.notEqual(end, -1, 'analysis renderer must follow accordion helpers');
const helperSource = source.slice(start, end);
assert.match(source.slice(end, end + 2400), /captureOptionsAnalysisSectionState\(host\)/);
assert.match(source.slice(end, end + 3000), /restoreOptionsAnalysisSectionState\(host,s\._optionsAnalysisSectionState\)/);

const context = {};
vm.runInNewContext(`${helperSource}\nthis.helpers = { captureOptionsAnalysisSectionState, restoreOptionsAnalysisSectionState };`, context);
const { captureOptionsAnalysisSectionState, restoreOptionsAnalysisSectionState } = context.helpers;

function makeSection(title, open) {
  const titleNode = { textContent: title };
  const summary = { querySelector: selector => selector === 'span' ? titleNode : null };
  return { open, querySelector: selector => selector === 'summary span' ? titleNode : selector === 'summary' ? summary : null };
}
function makeHost(sections) {
  return { querySelectorAll: selector => selector === 'details.so-ai-section' ? sections : [] };
}

// User opens two sections and explicitly closes the default-open section.
const currentSections = [
  makeSection('02 · MARKET REGIME & EXPOSURE STRUCTURE', false),
  makeSection('03 · GREEKS & OI-WEIGHTED SENSITIVITY', true),
  makeSection('04 · OPTIONS POSITIONING & ACTIVITY', true),
  makeSection('05 · VOLATILITY INTELLIGENCE', false)
];
const saved = captureOptionsAnalysisSectionState(makeHost(currentSections));
assert.equal(saved['02 · MARKET REGIME & EXPOSURE STRUCTURE'], false);
assert.equal(saved['03 · GREEKS & OI-WEIGHTED SENSITIVITY'], true);
assert.equal(saved['04 · OPTIONS POSITIONING & ACTIVITY'], true);
assert.equal(saved['05 · VOLATILITY INTELLIGENCE'], false);

// Simulate new markup created by a market-data refresh (all browser defaults closed).
const refreshedSections = [
  makeSection('02 · MARKET REGIME & EXPOSURE STRUCTURE', true),
  makeSection('03 · GREEKS & OI-WEIGHTED SENSITIVITY', false),
  makeSection('04 · OPTIONS POSITIONING & ACTIVITY', false),
  makeSection('05 · VOLATILITY INTELLIGENCE', true),
  makeSection('11 · FUTURE SECTION', true)
];
restoreOptionsAnalysisSectionState(makeHost(refreshedSections), saved);
assert.deepEqual(refreshedSections.map(section => section.open), [false, true, true, false, true],
  'existing section states are restored; new sections keep their default state');

// QQQ and GLD store state independently on their own session objects.
const qqqSession = { _optionsAnalysisSectionState: saved };
const gldSession = { _optionsAnalysisSectionState: { '03 · GREEKS & OI-WEIGHTED SENSITIVITY': false } };
const qqqFresh = [makeSection('03 · GREEKS & OI-WEIGHTED SENSITIVITY', false)];
const gldFresh = [makeSection('03 · GREEKS & OI-WEIGHTED SENSITIVITY', true)];
restoreOptionsAnalysisSectionState(makeHost(qqqFresh), qqqSession._optionsAnalysisSectionState);
restoreOptionsAnalysisSectionState(makeHost(gldFresh), gldSession._optionsAnalysisSectionState);
assert.equal(qqqFresh[0].open, true);
assert.equal(gldFresh[0].open, false);

console.log('Options analysis accordion state tests passed.');
