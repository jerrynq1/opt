const ws = new WebSocket(
  "wss://nbstream.binance.com/equity/stream"
);

let priceCount = 0;
let quoteCount = 0;

async function readMessage(data) {
  if (typeof data === "string") return data;
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  if (data && typeof data.text === "function") return await data.text();
  return String(data);
}

ws.addEventListener("open", () => {
  console.log("WEBSOCKET OPEN");

  ws.send(JSON.stringify({
    method: "SUBSCRIBE",
    params: ["price", "GLD@quote", "QQQ@quote"],
    id: 77
  }));
});

ws.addEventListener("message", async event => {
  try {
    const msg = JSON.parse(await readMessage(event.data));

    if (msg.id !== undefined) {
      console.log("SUBSCRIPTION ACK:", JSON.stringify(msg));
      return;
    }

    const data = msg.data ?? msg;

    if (data.e === "price") {
      priceCount++;

      const rates = Array.isArray(data.rates) ? data.rates : [];

      const matches = rates.filter(r =>
        [r.s, r.symbol, r.ac, r.assetCode]
          .some(v => /GLD|QQQ/i.test(String(v ?? "")))
      );

      console.log("\nPRICE SNAPSHOT:", JSON.stringify({
        stream: msg.stream,
        rows: rates.length,
        fields: Object.keys(rates[0] || {}),
        firstRows: rates.slice(0, 3),
        matches
      }, null, 2));
    }

    if (data.e === "quote") {
      quoteCount++;
      console.log("QUOTE:", JSON.stringify(data));
    }
  } catch (err) {
    console.log("PARSE ERROR:", err.message);
  }
});

setTimeout(() => {
  console.log("\n=== SUMMARY ===");
  console.log({ priceCount, quoteCount });
  ws.close();
}, 15000);
