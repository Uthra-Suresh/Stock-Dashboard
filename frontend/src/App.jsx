import { useEffect, useState } from "react";
import { useTrackedTickers, fetchHistory } from "./data";
import { useLivePrices } from "./livePrices";
import { toWeekly } from "./resample";
import TickerList from "./components/TickerList";
import PriceChart from "./components/PriceChart";
import PriceTable from "./components/PriceTable";
import IntradayChart from "./components/IntradayChart";
import "./App.css";

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function monthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return isoDate(d);
}

const PRESETS = [
  { label: "1M", months: 1 },
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
  { label: "5Y", months: 60 },
];

export default function App() {
  const { tickers, updated, error: listError } = useTrackedTickers();
  const live = useLivePrices(tickers.map((t) => t.symbol));

  const [selected, setSelected] = useState("");
  const [start, setStart] = useState(monthsAgo(3));
  const [end, setEnd] = useState(isoDate(new Date()));
  const [interval, setInterval] = useState("daily");

  // Full history per symbol, keyed by symbol. Once a ticker is loaded,
  // switching back to it is instant and switching date ranges never touches
  // the network at all.
  const [histories, setHistories] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Select the first ticker as soon as the index arrives. The dependency
  // array means this re-runs when `tickers` changes; the `selected` guard
  // stops it from overriding a choice you have already made.
  useEffect(() => {
    if (!selected && tickers.length > 0) {
      selectTicker(tickers[0].symbol);
    }
  }, [tickers]);

  async function selectTicker(symbol) {
    setSelected(symbol);
    setError("");

    // Already downloaded? Nothing to do.
    if (histories[symbol]) return;

    setLoading(true);
    try {
      const rows = await fetchHistory(symbol);
      setHistories((current) => ({ ...current, [symbol]: rows }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function applyPreset(months) {
    setStart(monthsAgo(months));
    setEnd(isoDate(new Date()));
  }

  // --- Derived data. All of this recomputes on render; none of it is state. ---

  const history = histories[selected] ?? [];

  // Date filtering happens here, in the browser, against data already in
  // memory. This is why the static approach works: the server-side date
  // range parameter simply moved to the client.
  const inRange = history.filter((r) => r.date >= start && r.date <= end);

  const bars = interval === "weekly" ? toWeekly(inRange) : inRange;

  const enriched = bars.map((row, i) => {
    const previous = bars[i - 1];
    return {
      ...row,
      mid: Number(((row.open + row.close) / 2).toFixed(2)),
      changePct: previous?.close
        ? Number((((row.close - previous.close) / previous.close) * 100).toFixed(2))
        : null,
    };
  });

  const first = enriched[0];
  const last = enriched.at(-1);
  const periodReturn =
    first && last ? (((last.close - first.close) / first.close) * 100).toFixed(2) : null;

  const liveQuote = live.prices[selected];

  return (
    <div className="page">
      <TickerList
        tickers={tickers}
        selected={selected}
        onSelect={selectTicker}
        updated={updated}
        live={live}
      />

      <main>
        <h1>{selected || "Stock dashboard"}</h1>

        <div className="controls">
          <label>
            From
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>

          <div className="presets">
            {PRESETS.map((preset) => (
              <button key={preset.label} onClick={() => applyPreset(preset.months)}>
                {preset.label}
              </button>
            ))}
          </div>

          <div className="toggle">
            {["daily", "weekly"].map((option) => (
              <button
                key={option}
                className={interval === option ? "on" : ""}
                onClick={() => setInterval(option)}
              >
                {option === "daily" ? "Daily" : "Weekly"}
              </button>
            ))}
          </div>
        </div>

        {(error || listError) && <p className="error">{error || listError}</p>}
        {loading && <p className="empty">Loading history…</p>}

        {selected && <IntradayChart symbol={selected} />}

        {enriched.length > 0 && (
          <>
            <div className="cards">
              <div className="card">
                <span>Live price</span>
                {liveQuote?.ok ? (
                  <strong className={liveQuote.pChange >= 0 ? "up" : "down"}>
                    {liveQuote.lastPrice.toFixed(2)}{" "}
                    <span className="muted">
                      ({liveQuote.pChange >= 0 ? "+" : ""}
                      {liveQuote.pChange.toFixed(2)}%)
                    </span>
                  </strong>
                ) : (
                  <strong className="muted">Unavailable</strong>
                )}
              </div>
              <div className="card">
                <span>Last close</span>
                <strong>{last.close.toFixed(2)}</strong>
              </div>
              <div className="card">
                <span>Period return</span>
                <strong className={periodReturn > 0 ? "up" : periodReturn < 0 ? "down" : ""}>
                  {periodReturn > 0 ? "+" : ""}
                  {periodReturn}%
                </strong>
              </div>
              <div className="card">
                <span>Period high</span>
                <strong>{Math.max(...enriched.map((r) => r.high)).toFixed(2)}</strong>
              </div>
              <div className="card">
                <span>Period low</span>
                <strong>{Math.min(...enriched.map((r) => r.low)).toFixed(2)}</strong>
              </div>
            </div>

            <h2 className="muted">
              {enriched.length} {interval === "weekly" ? "weeks" : "trading days"}
            </h2>

            <PriceChart rows={enriched} />
            <PriceTable rows={enriched} />
          </>
        )}

        {!loading && !error && enriched.length === 0 && selected && (
          <p className="empty">No data in this date range.</p>
        )}
      </main>
    </div>
  );
}
