import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { useIntradaySeries } from "../livePrices";
import { fetchIntradayDates, fetchIntradayForDate } from "../data";

const TODAY = "today";

function formatTime(ms) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function IntradayTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { time, price } = payload[0].payload;
  return (
    <div className="tooltip">
      <div className="tooltip-date">{formatTime(time)}</div>
      <div className="tooltip-row">
        <span className="tooltip-label">Price</span>
        <span className="tooltip-value">{price?.toFixed(2)}</span>
      </div>
    </div>
  );
}

/**
 * A small, separate "Today" mini-chart -- not merged into PriceChart.jsx,
 * whose X-axis plots one point per trading day and would break with dozens
 * of same-day points. This one plots raw last-traded-price vs time of day,
 * either live (today, polling) or from an archived past session (static,
 * one-shot fetch, no polling since that day is frozen).
 */
export default function IntradayChart({ symbol }) {
  const [dates, setDates] = useState([]);
  const [selected, setSelected] = useState(TODAY);
  const [archived, setArchived] = useState({ rows: [], loading: false, error: "" });

  const live = useIntradaySeries(selected === TODAY ? symbol : null);

  // Reset to "Today" and re-fetch the available archive dates whenever the
  // selected ticker changes.
  useEffect(() => {
    setSelected(TODAY);
    setDates([]);
    if (!symbol) return;
    let cancelled = false;
    fetchIntradayDates(symbol).then((d) => {
      if (!cancelled) setDates(d);
    });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  useEffect(() => {
    if (selected === TODAY || !symbol) return;
    let cancelled = false;
    setArchived({ rows: [], loading: true, error: "" });
    fetchIntradayForDate(symbol, selected)
      .then((rows) => {
        if (!cancelled) setArchived({ rows, loading: false, error: "" });
      })
      .catch((err) => {
        if (!cancelled) setArchived({ rows: [], loading: false, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, selected]);

  if (!symbol) return null;

  const viewingToday = selected === TODAY;
  const rows = viewingToday ? live.rows : archived.rows;
  const loading = !viewingToday && archived.loading;
  const unavailable = viewingToday
    ? live.status === "error" && rows.length === 0
    : !loading && (archived.error || rows.length === 0);

  return (
    <div className="chart intraday">
      <div className="legend">
        <span className="legend-item" style={{ cursor: "default" }}>
          Today
        </span>
        {dates.length > 0 && (
          <select
            className="intraday-select"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value={TODAY}>Today (live)</option>
            {[...dates].reverse().map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading && <p className="empty">Loading…</p>}
      {!loading && unavailable && (
        <p className="empty">
          {viewingToday ? "Live price unavailable right now." : "No archive for this day."}
        </p>
      )}

      {!loading && !unavailable && rows.length > 0 && (
        <div className="chart-inner intraday-inner">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#eee" vertical={false} />
              <XAxis
                dataKey="time"
                tickFormatter={formatTime}
                minTickGap={50}
                tick={{ fontSize: 12 }}
              />
              <YAxis domain={["dataMin - 2", "dataMax + 2"]} width={64} tick={{ fontSize: 12 }} />
              <Tooltip content={<IntradayTooltip />} isAnimationActive={false} />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#378ADD"
                strokeWidth={1}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
