import { useEffect, useState } from "react";

// CHANGE THIS -- set to the *.onrender.com URL after deploying server/.
// Same "hardcoded constant" convention as REPO_NAME in vite.config.js and
// REPO/EDIT_URL in TickerList.jsx, rather than a new .env/VITE_* pattern.
const LIVE_PRICE_BASE_URL = "https://stock-dashboard-live-proxy.onrender.com";

const QUOTE_POLL_MS = 20_000;
const INTRADAY_POLL_MS = 20_000;
const FETCH_TIMEOUT_MS = 25_000;

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Polls the live-price proxy for every tracked symbol's current quote.
 * Pauses while the tab is hidden and resumes immediately when it becomes
 * visible again. Fails soft: a failed poll keeps whatever prices are
 * already in state rather than clearing them.
 */
export function useLivePrices(symbols) {
  const [state, setState] = useState({ prices: {}, status: "idle", lastError: null });
  const symbolsKey = symbols.join(",");

  useEffect(() => {
    if (!symbolsKey) return;
    let cancelled = false;
    let timer;

    async function poll() {
      if (document.visibilityState !== "visible") return schedule();
      try {
        const data = await fetchJson(
          `${LIVE_PRICE_BASE_URL}/api/quotes?symbols=${encodeURIComponent(symbolsKey)}`
        );
        if (!cancelled) {
          setState((s) => ({ prices: { ...s.prices, ...data }, status: "ok", lastError: null }));
        }
      } catch (err) {
        if (!cancelled) setState((s) => ({ ...s, status: "error", lastError: err.message }));
      } finally {
        schedule();
      }
    }

    function schedule() {
      if (!cancelled) timer = setTimeout(poll, QUOTE_POLL_MS);
    }

    poll();

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        poll();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [symbolsKey]);

  return state;
}

/**
 * Polls today's intraday trace for a single symbol (the selected ticker,
 * not the whole sidebar -- this is heavier than a quote snapshot). Same
 * pause/resume-on-visibility and fail-soft behavior as useLivePrices.
 */
export function useIntradaySeries(symbol) {
  const [state, setState] = useState({ rows: [], status: "idle", lastError: null });

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    let timer;

    async function poll() {
      if (document.visibilityState !== "visible") return schedule();
      try {
        const rows = await fetchJson(`${LIVE_PRICE_BASE_URL}/api/intraday/${symbol}`);
        if (!cancelled) setState({ rows, status: "ok", lastError: null });
      } catch (err) {
        if (!cancelled) setState((s) => ({ ...s, status: "error", lastError: err.message }));
      } finally {
        schedule();
      }
    }

    function schedule() {
      if (!cancelled) timer = setTimeout(poll, INTRADAY_POLL_MS);
    }

    poll();

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        poll();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [symbol]);

  return state;
}
