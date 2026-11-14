# Main Exposure Vanna / Charm GEX-DEX UI Parity Update

Vanna and Charm now use the exact same bilateral Exposure component as GEX and DEX. They no longer use a separate signed center-bar layout.

- Call contribution uses the standard Call track on the right (cyan/blue).
- Put contribution uses the standard Put track on the left (gold).
- Same strike column, zero divider, row height, bar sizing, Spot and wall markers, legend, responsive layout and tooltip structure as GEX/DEX.
- Bar length is the absolute contribution magnitude for each option side; signed model contributions remain visible in the row tooltip.
- Vanna/Charm model coverage and BSM explanatory notes remain intact.
- No Greek calculation, exposure scaling, Surface 3D, Node.js, Worker, or Tunnel logic changed.
- Service Worker cache bumped to v44.
