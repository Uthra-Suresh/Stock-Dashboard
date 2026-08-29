"""
Archive today's intraday trace for every tracked ticker.

NSE's intraday data (via the live-price proxy in server/) only ever covers the
current trading session -- it resets every day, and the proxy itself stores
nothing. So looking back at a past day's intraday chart is only possible for
days captured *after* this script started running. This runs once, shortly
after NSE close, and appends today's session to a static per-symbol archive
in frontend/public/data/intraday/, following the same
fetch-then-commit-as-static-JSON pattern as fetch_prices.py.
"""

import json
import sys
import time
from datetime import date, datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "tickers.json"
OUT_DIR = ROOT / "frontend" / "public" / "data" / "intraday"

# CHANGE THIS -- set to the deployed server/ URL on Render.
PROXY_URL = "https://stock-dashboard-live-proxy.onrender.com"


def fetch_with_retry(symbol: str, attempts: int = 3):
    """
    The proxy's free-tier instance may be asleep (cold start ~30-60s) or NSE
    itself may be briefly uncooperative -- back off and retry rather than
    failing the whole run on one hiccup, same spirit as fetch_prices.py.
    """
    url = f"{PROXY_URL}/api/intraday/{symbol}"
    for attempt in range(attempts):
        try:
            response = requests.get(url, timeout=90)
            response.raise_for_status()
            rows = response.json()
            if rows:
                return rows
            print(f"  empty response (attempt {attempt + 1})")
        except Exception as exc:
            print(f"  error: {exc} (attempt {attempt + 1})")

        if attempt < attempts - 1:
            wait = 15 * (attempt + 1)
            print(f"  waiting {wait}s")
            time.sleep(wait)

    return None


def main() -> int:
    config = json.loads(CONFIG.read_text())
    symbols = config["tickers"]

    # The workflow runs at 15:45 IST (10:15 UTC), well before midnight IST,
    # so today's UTC date and today's IST trading date are the same value.
    today = date.today().isoformat()

    failed = []

    for symbol in symbols:
        print(f"{symbol}")
        rows = fetch_with_retry(symbol)
        if not rows:
            failed.append(symbol)
            continue

        symbol_dir = OUT_DIR / symbol
        symbol_dir.mkdir(parents=True, exist_ok=True)

        (symbol_dir / f"{today}.json").write_text(
            json.dumps({"symbol": symbol, "date": today, "rows": rows}, separators=(",", ":"))
        )

        index_path = symbol_dir / "index.json"
        dates = []
        if index_path.exists():
            dates = json.loads(index_path.read_text()).get("dates", [])
        if today not in dates:
            dates.append(today)
        index_path.write_text(
            json.dumps(
                {
                    "updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    "dates": sorted(dates),
                },
                indent=2,
            )
        )

        print(f"  {len(rows)} points archived for {today}")

    if failed:
        print(f"\nFAILED: {', '.join(failed)}", file=sys.stderr)
        return 1

    print(f"\nArchived {len(symbols) - len(failed)} tickers for {today}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
