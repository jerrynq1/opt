/* Cloudflare Worker URL for Binance QQQ/GLD Stock Options. */
window.BINANCE_STOCK_PROXY = 'https://api.gexadecimal.dev';

/* Optional Node Server Spot fallback. Leave empty when not exposing the private Node server.
 * If you run server/home-proxy.mjs behind an HTTPS tunnel, set its public base URL here.
 * Example: window.BINANCE_STOCK_SPOT_API = 'https://spot-api.example.com';
 */
window.BINANCE_STOCK_SPOT_API = window.BINANCE_STOCK_SPOT_API || '';
