// Point this at your own repo so "Manage list" opens the right file.
const REPO = "https://github.com/Uthra-Suresh/Stock-Dashboard";
const EDIT_URL = `${REPO}/edit/main/tickers.json`;

export default function TickerList({ tickers, selected, onSelect, updated }) {
  return (
    <aside className="tickers">
      <h3>Tickers</h3>

      {tickers.length === 0 ? (
        <p className="empty">Nothing tracked yet.</p>
      ) : (
        <ul>
          {tickers.map((t) => (
            <li key={t.symbol} className={t.symbol === selected ? "active" : ""}>
              <button className="ticker-name" onClick={() => onSelect(t.symbol)}>
                <span>{t.symbol}</span>
                <span className="ticker-price">
                  {t.last?.toFixed(2)}
                  <em className={t.changePct > 0 ? "up" : t.changePct < 0 ? "down" : ""}>
                    {t.changePct == null
                      ? ""
                      : `${t.changePct > 0 ? "+" : ""}${t.changePct}%`}
                  </em>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/*
        On a static site there is no server to accept a new ticker, so adding
        one means editing tickers.json in the repo. This link opens that file
        in GitHub's editor; committing it triggers a fresh fetch and deploy.
        Clunkier than a text box, but honest about what the architecture can do.
      */}
      <a className="manage" href={EDIT_URL} target="_blank" rel="noreferrer">
        Manage list &rarr;
      </a>

      {updated && (
        <p className="stamp">
          Updated {new Date(updated).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      )}
    </aside>
  );
}
