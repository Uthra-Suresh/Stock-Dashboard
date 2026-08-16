import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceArea,
  Customized,
} from "recharts";

const SERIES = [
  { key: "high", label: "High", color: "#378ADD" },
  { key: "open", label: "Open", color: "#888780" },
  { key: "mid", label: "(O+C)/2", color: "#7F77DD" },
  { key: "close", label: "Close", color: "#1D9E75" },
  { key: "low", label: "Low", color: "#D85A30" },
];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const sorted = [...payload].sort((a, b) => b.value - a.value);

  return (
    <div className="tooltip">
      <div className="tooltip-date">{label}</div>
      {sorted.map((item) => (
        <div key={item.dataKey} className="tooltip-row">
          <span className="swatch" style={{ background: item.color }} />
          <span className="tooltip-label">{item.name}</span>
          <span className="tooltip-value">{item.value?.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Rendered via <Customized> so it lives inside the chart SVG and has direct
 * access to yAxisMap — the same D3 scale Recharts uses internally.
 * That lets us invert a pixel Y → price without duplicating the domain logic.
 */
function YCrosshairLayer({ yAxisMap, offset, chartY }) {
  if (chartY == null || !yAxisMap) return null;

  const yAxis = Object.values(yAxisMap)[0];
  if (!yAxis?.scale?.invert) return null;

  const value = yAxis.scale.invert(chartY);
  const [d0, d1] = yAxis.scale.domain();
  const domMin = Math.min(d0, d1);
  const domMax = Math.max(d0, d1);
  if (value < domMin || value > domMax) return null;

  const x1 = offset.left;
  const x2 = offset.left + offset.width;

  return (
    <g pointerEvents="none">
      {/* Horizontal crosshair line */}
      <line
        x1={x1} y1={chartY} x2={x2} y2={chartY}
        stroke="#aaa" strokeWidth={1} strokeDasharray="4 3"
      />
      {/* Price badge on Y axis */}
      <rect
        x={1} y={chartY - 9}
        width={offset.left - 3} height={18}
        fill="#2c2c2a" rx={2}
      />
      <text
        x={offset.left - 5} y={chartY + 4}
        textAnchor="end" fontSize={11} fill="white"
      >
        {value.toFixed(2)}
      </text>
    </g>
  );
}

export default function PriceChart({ rows }) {
  const [hidden, setHidden] = useState(new Set());
  const [zoomedData, setZoomedData] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const [dragEnd, setDragEnd] = useState(null);
  const [dragging, setDragging] = useState(false);
  // chartY is the raw pixel Y from the top of the SVG, from e.chartY
  const [chartY, setChartY] = useState(null);

  const data = zoomedData ?? rows;

  function toggle(key) {
    setHidden((current) => {
      const next = new Set(current);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function handleMouseDown(e) {
    if (!e?.activeLabel) return;
    setDragStart(e.activeLabel);
    setDragEnd(null);
    setDragging(true);
  }

  function handleMouseMove(e) {
    if (!e) return;
    // Always track Y so the horizontal crosshair follows the cursor
    if (e.chartY !== undefined) setChartY(e.chartY);
    // Only update drag end when a drag is in progress
    if (dragging && e.activeLabel) setDragEnd(e.activeLabel);
  }

  function handleMouseUp() {
    if (!dragging) return;
    setDragging(false);

    if (!dragStart || !dragEnd || dragStart === dragEnd) {
      setDragStart(null);
      setDragEnd(null);
      return;
    }

    const iLeft = rows.findIndex((r) => r.date === dragStart);
    const iRight = rows.findIndex((r) => r.date === dragEnd);
    const [from, to] = [iLeft, iRight].sort((a, b) => a - b);

    // Require at least a 5-bar selection to avoid accidental micro-zooms
    if (to - from >= 4) setZoomedData(rows.slice(from, to + 1));

    setDragStart(null);
    setDragEnd(null);
  }

  function handleMouseLeave() {
    setChartY(null);
    // Cancel an in-progress drag if the cursor leaves the chart
    if (dragging) {
      setDragging(false);
      setDragStart(null);
      setDragEnd(null);
    }
  }

  return (
    <div
      className="chart"
      style={{ userSelect: dragging ? "none" : "auto" }}
    >
      <div className="legend">
        {SERIES.map((series) => (
          <button
            key={series.key}
            className={`legend-item ${hidden.has(series.key) ? "off" : ""}`}
            onClick={() => toggle(series.key)}
          >
            <span className="swatch" style={{ background: series.color }} />
            {series.label}
          </button>
        ))}
        {zoomedData ? (
          <button
            className="legend-item"
            onClick={() => setZoomedData(null)}
          >
            ↺ Reset zoom
          </button>
        ) : (
          <span style={{ fontSize: 11, color: "#a5a39c", alignSelf: "center", marginLeft: 4 }}>
            drag to zoom
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={360}>
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          <CartesianGrid stroke="#eee" vertical={false} />
          <XAxis dataKey="date" minTickGap={50} tick={{ fontSize: 12 }} />
          <YAxis
            domain={["dataMin - 5", "dataMax + 5"]}
            width={64}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            content={<ChartTooltip />}
            // Vertical crosshair — shows the date at any x position
            cursor={{ stroke: "#999", strokeWidth: 1, strokeDasharray: "3 3" }}
            isAnimationActive={false}
          />

          {SERIES.filter((s) => !hidden.has(s.key)).map((series) => (
            <Line
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.label}
              stroke={series.color}
              strokeWidth={1}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          ))}

          {/* Drag-to-zoom selection highlight */}
          {dragging && dragStart && dragEnd && (
            <ReferenceArea
              x1={dragStart}
              x2={dragEnd}
              fill="#378ADD"
              fillOpacity={0.15}
              stroke="#378ADD"
              strokeOpacity={0.5}
            />
          )}

          {/* Horizontal crosshair + Y price badge — rendered last so it's on top */}
          <Customized
            component={(props) => <YCrosshairLayer {...props} chartY={chartY} />}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
