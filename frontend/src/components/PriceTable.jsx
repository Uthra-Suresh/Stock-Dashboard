export default function PriceTable({ rows }) {
  // Newest first reads better for a daily dashboard. toReversed() returns a
  // new array; .reverse() would mutate the one the chart is using and the
  // chart would silently draw backwards.
  const newestFirst = [...rows].reverse();

  return (
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Open</th>
          <th>High</th>
          <th>Low</th>
          <th>Close</th>
          <th>(O+C)/2</th>
          <th>Change</th>
        </tr>
      </thead>
      <tbody>
        {newestFirst.map((row) => (
          <tr key={row.date}>
            <td className="date">{row.date}</td>
            <td>{row.open?.toFixed(2)}</td>
            <td>{row.high?.toFixed(2)}</td>
            <td>{row.low?.toFixed(2)}</td>
            <td>{row.close?.toFixed(2)}</td>
            <td className="muted">{row.mid?.toFixed(2)}</td>
            <td className={row.changePct > 0 ? "up" : row.changePct < 0 ? "down" : ""}>
              {row.changePct == null ? "—" : `${row.changePct > 0 ? "+" : ""}${row.changePct}%`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
