# Stock Dashboard

A static stock price dashboard for NSE/BSE tickers. A GitHub Actions job fetches
daily price history with `yfinance` and commits it as JSON; a React + Vite
frontend reads those files and renders interactive charts. There is no backend
server — everything the browser needs ships as static files on GitHub Pages.

## How it works

1. **`scripts/fetch_prices.py`** downloads daily OHLCV bars for every ticker in
   `tickers.json` (via Yahoo Finance) and writes one JSON file per ticker into
   `frontend/public/data/`, plus an `index.json` summary.
2. **`.github/workflows/update-data.yml`** runs that script on a schedule
   (weekdays, after NSE close), commits any changed data, and — if the data
   changed — triggers the deploy workflow.
3. **`.github/workflows/deploy.yml`** builds the Vite app and publishes it to
   GitHub Pages.
4. **`frontend/`** is the React app. It loads `index.json` for the ticker list
   and fetches a ticker's full history on first selection; date-range and
   daily/weekly filtering then happen entirely in the browser against data
   already in memory.

## Project layout

```
tickers.json              # tracked symbols + years of history to fetch
scripts/
  fetch_prices.py         # fetches prices, writes frontend/public/data/*.json
  requirements.txt
frontend/
  src/
    App.jsx               # top-level state: selected ticker, date range, interval
    data.js                # loading tickers/history from the static JSON
    resample.js            # daily -> weekly aggregation
    components/            # TickerList, PriceChart, PriceTable
  public/data/             # generated price data (committed, not hand-edited)
.github/workflows/
  update-data.yml          # scheduled fetch + commit + trigger deploy
  deploy.yml                # build and publish to GitHub Pages
```

## Adding or removing tickers

Edit `tickers.json`:

```json
{
  "years_of_history": 5,
  "tickers": ["SIGMAADV", "ETERNAL", "MANIPALHOS", "SBIN"]
}
```

Symbols are assumed to be NSE and get a `.NS` suffix automatically; include an
explicit suffix (e.g. `RELIANCE.BO`) for BSE or other exchanges. New data
appears after the next scheduled run, or immediately via `workflow_dispatch`
on the "Update prices" Action.

## Local development

Fetch data once so the frontend has something to read:

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r scripts/requirements.txt
python scripts/fetch_prices.py
```

Then run the frontend:

```bash
cd frontend
npm install
npm run dev
```

Other frontend scripts: `npm run build`, `npm run preview`, `npm run lint`.

## Deployment

Push to `main` (or run the workflows manually) to deploy. The site is served
from GitHub Pages via `deploy.yml`; make sure Pages is configured for
"GitHub Actions" as the source in the repo settings.
