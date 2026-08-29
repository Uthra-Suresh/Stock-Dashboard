const express = require("express");
const cors = require("cors");
const { NseIndia } = require("stock-nse-india");

const PORT = process.env.PORT || 3000; // Render injects PORT; don't hardcode it.

// CHANGE THIS in production via the CORS_ALLOWED_ORIGINS env var on Render.
// This default only covers local frontend dev.
const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 12_000);

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header (curl, server-to-server) is allowed through -- only
      // browsers send Origin, and this proxy has no cookies/credentials to leak.
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error(`origin ${origin} not allowed`));
    },
  })
);

// One long-lived instance, reused across every request. stock-nse-india caches
// an NSE session cookie in memory and only re-handshakes periodically -- a
// fresh instance per request would re-handshake with nseindia.com every time.
const nse = new NseIndia();

const quoteCache = new Map(); // symbol -> { data, fetchedAt }
const intradayCache = new Map(); // symbol -> { data, fetchedAt }

async function getCachedQuote(symbol) {
  const hit = quoteCache.get(symbol);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return hit.data;

  const details = await nse.getEquityDetails(symbol);
  const quote = {
    symbol,
    lastPrice: details?.priceInfo?.lastPrice ?? null,
    change: details?.priceInfo?.change ?? null,
    pChange: details?.priceInfo?.pChange ?? null,
    previousClose: details?.priceInfo?.previousClose ?? null,
    lastUpdateTime: details?.metadata?.lastUpdateTime ?? null,
  };
  quoteCache.set(symbol, { data: quote, fetchedAt: Date.now() });
  return quote;
}

async function getCachedIntraday(symbol) {
  const hit = intradayCache.get(symbol);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return hit.data;

  const intraday = await nse.getEquityIntradayData(symbol);
  // grapthData is [timestamp, price, marketStatus][] -- a raw LTP-vs-time
  // trace, not OHLC candles, and only ever today's session.
  const rows = (intraday?.grapthData || []).map(([time, price]) => ({ time, price }));
  intradayCache.set(symbol, { data: rows, fetchedAt: Date.now() });
  return rows;
}

app.get("/health", (_req, res) => res.json({ ok: true }));

// Single symbol -- handy for manual/curl testing.
app.get("/api/quote/:symbol", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  try {
    res.json(await getCachedQuote(symbol));
  } catch (err) {
    console.error(`quote failed for ${symbol}:`, err.message);
    res.status(502).json({ error: "nse_unavailable", message: err.message });
  }
});

app.get("/api/intraday/:symbol", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  try {
    res.json(await getCachedIntraday(symbol));
  } catch (err) {
    console.error(`intraday failed for ${symbol}:`, err.message);
    res.status(502).json({ error: "nse_unavailable", message: err.message });
  }
});

// The endpoint the frontend actually polls: /api/quotes?symbols=SBIN,ETERNAL,...
// No batch method exists in stock-nse-india, so this loops sequentially (not
// Promise.all) -- avoids firing several simultaneous session handshakes
// against a cold cache right after a free-tier wake-up. Per-symbol failures
// land in that symbol's own entry rather than failing the whole request.
app.get("/api/quotes", async (req, res) => {
  const symbols = String(req.query.symbols || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  if (!symbols.length) return res.status(400).json({ error: "missing_symbols" });

  const payload = {};
  for (const symbol of symbols) {
    try {
      payload[symbol] = { ok: true, ...(await getCachedQuote(symbol)) };
    } catch (err) {
      payload[symbol] = { ok: false, error: err.message };
    }
  }
  res.json(payload);
});

app.listen(PORT, () => console.log(`live-price proxy listening on :${PORT}`));
