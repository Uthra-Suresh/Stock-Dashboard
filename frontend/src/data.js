import { useEffect, useState } from "react";

// import.meta.env.BASE_URL is whatever you set as `base` in vite.config.js.
// In dev it is "/", in production "/stock-dashboard/". Always build data URLs
// from it rather than hardcoding a leading slash, or your fetches will work
// locally and 404 once deployed.
const DATA = `${import.meta.env.BASE_URL}data/`;

/**
 * Loads the list of tickers the Actions job tracks, plus each one's last
 * price. Runs once on mount.
 */
export function useTrackedTickers() {
  const [tickers, setTickers] = useState([]);
  const [updated, setUpdated] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetch(`${DATA}index.json`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        // If the component unmounted while we were waiting, do not call
        // setState - React warns about updating an unmounted component.
        if (cancelled) return;
        setTickers(data.tickers);
        setUpdated(data.updated);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the ticker list. Has the fetch job run yet?");
      });

    // The cleanup function runs when the effect is torn down.
    return () => {
      cancelled = true;
    };
  }, []); // Empty dependency array = run once, on mount.

  return { tickers, updated, error };
}

/**
 * Fetches one ticker's full history. Not a hook - just a function App calls.
 *
 * The file holds several years of daily bars, so this is a one-time cost per
 * symbol. Every date range and the weekly toggle then work off memory.
 */
export async function fetchHistory(symbol) {
  const response = await fetch(`${DATA}${symbol}.json`);
  if (!response.ok) {
    throw new Error(`No data file for ${symbol}. It may not be tracked yet.`);
  }
  const data = await response.json();
  return data.rows;
}

/**
 * Dates for which an intraday archive exists for this symbol, oldest first.
 * Archiving only starts once snapshot-intraday.yml is deployed, so this is
 * empty (or 404s) until the first end-of-day snapshot has run.
 */
export async function fetchIntradayDates(symbol) {
  const response = await fetch(`${DATA}intraday/${symbol}/index.json`);
  if (!response.ok) return [];
  const data = await response.json();
  return data.dates ?? [];
}

/** One archived day's intraday trace for a symbol: [{ time, price }]. */
export async function fetchIntradayForDate(symbol, date) {
  const response = await fetch(`${DATA}intraday/${symbol}/${date}.json`);
  if (!response.ok) {
    throw new Error(`No intraday archive for ${symbol} on ${date}.`);
  }
  const data = await response.json();
  return data.rows;
}
