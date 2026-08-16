"""
Fetch daily bars for every tracked ticker and write them as static JSON.

This runs on a GitHub Actions runner, not in a web server. The output lands in
frontend/public/data/, gets committed to the repo, and Vite copies it into the
build. The browser then reads plain files - there is no API at runtime.

Because we fetch several years in one go, the frontend can handle every date
range and the daily/weekly toggle without ever going back to the network.
"""

import json
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pandas as pd
import yfinance as yf

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "tickers.json"
OUT_DIR = ROOT / "frontend" / "public" / "data"


def to_yahoo_symbol(symbol: str) -> str:
    """NSE symbols need a .NS suffix on Yahoo. BSE uses .BO."""
    s = symbol.strip().upper()
    return s if "." in s else f"{s}.NS"


def fetch_with_retry(yahoo_symbol: str, start: date, attempts: int = 4):
    """
    Yahoo rate-limits datacenter IPs, and Actions runners are datacenter IPs.
    A handful of daily requests usually sails through, but not always, so back
    off and retry rather than failing the whole run on one hiccup.
    """
    for attempt in range(attempts):
        try:
            df = yf.download(
                yahoo_symbol,
                start=start,
                end=date.today() + timedelta(days=1),
                interval="1d",
                auto_adjust=False,
                progress=False,
                threads=False,
            )
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.droplevel(1)
            if not df.empty:
                return df
            print(f"  empty response (attempt {attempt + 1})")
        except Exception as exc:
            print(f"  error: {exc} (attempt {attempt + 1})")

        if attempt < attempts - 1:
            # 3s, 6s, 12s. Exponential backoff gives the rate limiter time to
            # forget about us.
            wait = 3 * (2**attempt)
            print(f"  waiting {wait}s")
            time.sleep(wait)

    return None


def to_rows(df: pd.DataFrame) -> list[dict]:
    def clean(v):
        return None if pd.isna(v) else round(float(v), 2)

    rows = []
    for index, row in df.iterrows():
        close = clean(row["Close"])
        # A null close means a halted or missing session. Dropping it here is
        # kinder than letting it punch a hole through every chart line.
        if close is None:
            continue
        rows.append(
            {
                "date": index.strftime("%Y-%m-%d"),
                "open": clean(row["Open"]),
                "high": clean(row["High"]),
                "low": clean(row["Low"]),
                "close": close,
                "adjClose": clean(row["Adj Close"]),
                "volume": None if pd.isna(row["Volume"]) else int(row["Volume"]),
            }
        )
    return rows


def main() -> int:
    config = json.loads(CONFIG.read_text())
    symbols = config["tickers"]
    start = date.today() - timedelta(days=365 * config.get("years_of_history", 5))

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    index = []
    failed = []

    for symbol in symbols:
        yahoo_symbol = to_yahoo_symbol(symbol)
        print(f"{symbol} -> {yahoo_symbol}")

        df = fetch_with_retry(yahoo_symbol, start)
        if df is None:
            failed.append(symbol)
            continue

        rows = to_rows(df)
        if not rows:
            failed.append(symbol)
            continue

        (OUT_DIR / f"{symbol}.json").write_text(
            json.dumps({"symbol": yahoo_symbol, "rows": rows}, separators=(",", ":"))
        )

        # Summary values so the sidebar can show a price next to each name
        # without downloading every ticker's full history up front.
        last, previous = rows[-1], rows[-2] if len(rows) > 1 else None
        change = (
            round((last["close"] - previous["close"]) / previous["close"] * 100, 2)
            if previous
            else None
        )
        index.append(
            {
                "symbol": symbol,
                "last": last["close"],
                "changePct": change,
                "asOf": last["date"],
                "rows": len(rows),
            }
        )
        print(f"  {len(rows)} rows, last {last['date']}")

        # Be a considerate client. These runs are not time-critical.
        time.sleep(1)

    if index:
        (OUT_DIR / "index.json").write_text(
            json.dumps(
                {
                    "updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    "tickers": index,
                },
                indent=2,
            )
        )

    if failed:
        # Non-zero exit turns the Actions run red. Successful tickers are
        # already written and will still be committed, but you get an email
        # instead of silently stale data.
        print(f"\nFAILED: {', '.join(failed)}", file=sys.stderr)
        return 1

    print(f"\nWrote {len(index)} tickers.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
