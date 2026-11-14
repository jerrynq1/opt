/* Cloudflare Worker URL for Binance QQQ/GLD Stock Options. */
window.BINANCE_STOCK_PROXY = 'https://api.gexadecimal.dev';

/* Node.js Spot API exposed through the existing Cloudflare Named Tunnel.
 * The same host routes /api/spot to C:\server\home-proxy.mjs and
 * /api/binance-stock-proxy to the local Worker module.
 */
window.BINANCE_STOCK_SPOT_API = 'https://api.gexadecimal.dev';
