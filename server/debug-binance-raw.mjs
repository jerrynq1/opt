const targets = ["GLD", "QQQ"];

const urls = {
  PRICE: "wss://nbstream.binance.com/equity/ws/price",
  GLD: "wss://nbstream.binance.com/equity/ws/GLD@quote",
  QQQ: "wss://nbstream.binance.com/equity/ws/QQQ@quote"
};

const stats = {
  priceMessages: 0,
  priceRows: 0,
  GLDPriceMatches: 0,
  QQQPriceMatches: 0,
  GLDQuoteMessages: 0,
  QQQQuoteMessages: 0
};

function parseData(data) {
  if (typeof data === "string") return Promise.resolve(data);
  if (Buffer.isBuffer(data)) return Promise.resolve(data.toString("utf8"));
  if (data && typeof data.text === "function") return data.text();
  return Promise.resolve(String(data));
}

const sockets = Object.entries(urls).map(([name, url]) => {
  const ws = new WebSocket(url);

  ws.addEventListener("open", () => {
    console.log(`[${name}] OPEN`);
  });

  ws.addEventListener("error", () => {
    console.log(`[${name}] ERROR`);
  });

  ws.addEventListener("close", e => {
    console.log(`[${name}] CLOSED ${e.code} ${e.reason}`);
  });

  ws.addEventListener("message", async event => {
    try {
      const msg = JSON.parse(await parseData(event.data));
      const data = msg.data ?? msg;

      if (name === "PRICE" && data.e === "price") {
        const rates = Array.isArray(data.rates) ? data.rates : [];
        stats.priceMessages++;
        stats.priceRows += rates.length;

        for (const symbol of targets) {
          const matches = rates.filter(r =>
            String(r.s ?? "").toUpperCase() === symbol
          );

          if (matches.length) {
            stats[symbol + "PriceMatches"] += matches.length;
            console.log(`[PRICE FOUND ${symbol}]`, JSON.stringify(matches));
          }
        }
      }

      if (name !== "PRICE" && data.e === "quote") {
        stats[name + "QuoteMessages"]++;
        console.log(`[QUOTE ${name}]`, JSON.stringify(data));
      }
    } catch (e) {
      console.log(`[${name}] PARSE ERROR`, e.message);
    }
  });

  return ws;
});

console.log("Monitoring Binance raw streams for 180 seconds...");

setTimeout(() => {
  for (const ws of sockets) {
    try { ws.close(); } catch {}
  }

  console.log("\n===== FINAL SUMMARY =====");
  console.table(stats);
}, 180000);
