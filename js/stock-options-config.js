/* Internal API origin. Binance Option Chain access is server-side only. */
window.BINANCE_STOCK_PROXY = 'https://api.gexadecimal.dev';

/* Node.js Spot API exposed through the existing Cloudflare Named Tunnel.
 * The same host routes /api/spot and /api/options-cache to the Node Gateway.
 * The Node Gateway uses the allow-listed Worker bridge server-side for Binance requests.
 */
window.BINANCE_STOCK_SPOT_API = 'https://api.gexadecimal.dev';

/* Read-only Option Chain / Expiry / Quote cache served by the Node Gateway. */
window.BINANCE_STOCK_CACHE_API = 'https://api.gexadecimal.dev';
