/**
 * Turn daily bars into weekly bars.
 *
 * The rules are not obvious and getting them wrong is the classic mistake:
 *
 *   open  = the FIRST trading day's open   (not an average)
 *   close = the LAST trading day's close   (not an average)
 *   high  = the highest high in the week
 *   low   = the lowest low in the week
 *
 * Averaging opens and closes produces a number that never actually traded,
 * and it flattens exactly the open-vs-close relationship you want to see.
 */

// The Monday of whatever week this date falls in. Used as the bucket key.
function weekStart(dateString) {
  const d = new Date(dateString + "T00:00:00");
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

export function toWeekly(rows) {
  if (rows.length === 0) return [];

  // A Map keeps insertion order, so as long as `rows` arrives oldest-first
  // the weeks come out in order too.
  const buckets = new Map();

  for (const row of rows) {
    const key = weekStart(row.date);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }

  return [...buckets].map(([start, days]) => ({
    date: start,
    open: days[0].open,
    close: days.at(-1).close,
    high: Math.max(...days.map((d) => d.high)),
    low: Math.min(...days.map((d) => d.low)),
    volume: days.reduce((sum, d) => sum + (d.volume ?? 0), 0),
    // Handy for the table: a holiday-shortened week has fewer than 5.
    sessions: days.length,
  }));
}
