import React, { useEffect, useState } from "react";
import { Spinner, Alert } from "react-bootstrap";

// Matches your palette and branding
const NETWORKS = [
  { key: "ethereum",  label: "Ethereum Rate" },
  { key: "bnb",       label: "BNB Rate" },
  { key: "polygon",   label: "Polygon Rate" },
  { key: "base",      label: "Base Rate" },
  { key: "arbitrum",  label: "Arbitrum Rate" },
  { key: "optimism",  label: "Optimism Rate" },
];

// For image fallback
function handleImgError(e, symbol) {
  e.target.onerror = null;
  e.target.src = "/logos/default-coin.png"; // fallback logo
}

export default function TopRevampTokensTable() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/top_revamp_rates.json")
      .then((res) => res.json())
      .then(setData)
      .catch(() => setData({ error: true }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="d-flex justify-content-center py-5">
      <Spinner animation="border" />
    </div>
  );
  if (!data || data.error) return (
    <Alert variant="danger" className="mt-4">Failed to load rates.</Alert>
  );

  return (
    <section className="dashboard-card parallax-table" style={{ margin: "0 auto", maxWidth: 1600 }}>
      <div className="d-flex align-items-center justify-content-between" style={{ gap: 18 }}>
        <span className="card-header" style={{ color: "var(--rvnwl-accent-burn)", fontWeight: 600   }}>
          Top Revamp Token Rates
        </span>
        <span style={{ fontSize: 15, color: "var(--rvnwl-ivory)", opacity: 0.93 }}>
          Updated: <span style={{ color: "var(--rvnwl-accent-cyan)" }}>{data.lastUpdated}</span>
        </span>
      </div>
      <div
          style={{height: 3, width: "100%", background: "linear-gradient(90deg, var(--rvnwl-accent-burn) 30%, transparent 100%)", margin: "2px 2px 0 0", borderRadius: 2 }}
        />
      <div className="mt-2" style={{ fontWeight: 500, fontSize: "1.08rem", color: "var(--rvnwl-warning)" }}>
        {data.disclaimer}
      </div>
      <div className="table-responsive" style={{ borderRadius: "0.8rem" }}>
        <table className="table revamp-table table-hover align-middle mb-0" style={{ minWidth: 900, fontFamily: 'Inter, Arial, sans-serif' }}>
          <thead>
            <tr>
              <th style={{ color: "var(--rvnwl-ivory)", fontWeight: 500 }}>Logo</th>
              <th style={{ color: "var(--rvnwl-ivory)", fontWeight: 500 }}>Name</th>
              <th style={{ color: "var(--rvnwl-ivory)", fontWeight: 500 }}>Symbol</th>
              {NETWORKS.map((n) => (
                <th key={n.key} style={{ color: "var(--rvnwl-ivory)", fontWeight: 500 }}>
                  {n.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.assets.map((asset, idx) => (
              <tr key={asset.symbol + idx}>
                <td>
                  <img
                    src={asset.logo}
                    alt={asset.symbol}
                    onError={e => handleImgError(e, asset.symbol)}
                    style={{
                      width: 34, height: 34, borderRadius: "50%",
                      border: "2px solid var(--rvnwl-accent-cyan)",
                      background: "#151a22", objectFit: "contain"
                    }}
                  />
                </td>
                <td style={{ color: "var(--rvnwl-accent-cyan)", fontWeight: 400 }}>{asset.name}</td>
                <td style={{ color: "#99cdfb", fontWeight: 400 }}>{asset.symbol}</td>
                {NETWORKS.map((n) => {
                  const rate = asset.rates[n.key];
                  if (!rate || rate.rate === null || rate.rate === undefined) {
                    return (
                      <td key={n.key} style={{
                        color: "#a4a6a7",
                        opacity: 0.55,
                        fontStyle: "italic"
                      }}>
                        —
                      </td>
                    );
                  }
                  return (
                    <td
                      key={n.key}
                      style={{
                        textAlign: "right",
                        paddingRight: "1.5rem", // adjust as needed
                        verticalAlign: "middle"
                      }}
                    >
                      {rate.link ? (
                        <a
                          href={rate.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: "var(--rvnwl-accent-cyan)",
                            fontWeight: 400,
                            textDecoration: "underline dotted",
                            letterSpacing: ".01em"
                          }}
                        >
                          {parseFloat(rate.rate).toFixed(4)}
                        </a>
                      ) : (
                        <span style={{ color: "var(--rvnwl-accent-cyan)", fontWeight: 400 }}>
                          {parseFloat(rate.rate).toFixed(6)}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rev-subtext mb-2" style={{ fontSize: ".97rem", color: "#c1c5cc" }}>
        Informative only: Always verify live rates after connecting wallet. Rates are periodically updated for transparency.
      </div>
    </section>
  );
}
