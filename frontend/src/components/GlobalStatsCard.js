import React, { useState, useEffect } from "react";
import { JsonRpcProvider, Contract, formatEther } from "ethers";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { DEFI_ADDRESSES } from "../constants";
import RevampABI from "../abis/RevampDeFi.json";
import { Card, Alert } from "react-bootstrap";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function GlobalStatsCard({ selectedNetwork }) {
  const [totalContrib, setTotalContrib] = useState(0);
  const [totalFees, setTotalFees] = useState(0);
  const [topAddresses, setTopAddresses] = useState([]);
  const [topContribs, setTopContribs] = useState([]);

  useEffect(() => {
    async function fetchGlobalStats() {
      if (!selectedNetwork) return;
      try {
        const provider = new JsonRpcProvider(selectedNetwork.rpcUrl);
        const addr = DEFI_ADDRESSES[selectedNetwork.chainId];
        if (!addr) return;
        const coreDefi = new Contract(addr, RevampABI, provider);

        const totalBn = await coreDefi.totalNativeContributed();
        setTotalContrib(parseFloat(formatEther(totalBn)));

        const feeBn = await coreDefi.totalListingFees();
        setTotalFees(parseFloat(formatEther(feeBn)));

        const [addrs, amounts] = await coreDefi.getTopParticipants();
        setTopAddresses(addrs);
        setTopContribs(amounts.map(a => parseFloat(formatEther(a))));
      } catch (err) {
        console.error("GlobalStatsCard fetch error:", err);
      }
    }
    fetchGlobalStats();
  }, [selectedNetwork]);

  // Pie Chart Settings
  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "bottom",
        labels: {
          font: { family: "Inter", size: 13, weight: 500 },
          color: "#9beffc",
          usePointStyle: true,
          padding: 14
        }
      },
      title: { display: false }
    },
    animation: { animateScale: true, duration: 900, easing: "easeOutCubic" }
  };

  const pie1Data = {
    labels: topAddresses.map((_, i) => `#${i + 1}`),
    datasets: [{
      data: topContribs,
      backgroundColor: topContribs.map((_, i) => `hsl(${(i * 360) / 20},80%,62%)`),
      borderWidth: 0
    }]
  };

  const sumTop = topContribs.reduce((acc, val) => acc + val, 0);
  const others = totalContrib - sumTop;
  const pie2Data = {
    labels: ["Top 20", "Others"],
    datasets: [{
      data: [sumTop, others > 0 ? others : 0],
      backgroundColor: ["#ff5c1e", "#26ffe3"],
      borderWidth: 0
    }]
  };

  return (
    <Card
      className="mb-4 h-100 global-stats-card shadow"
      style={{
        border: "1.5px solid var(--card-border)",
        borderRadius: "1.2rem",
        background: "var(--card-bg)",
        color: "var(--card-text)"
      }}
    >
      <Card.Header
        style={{
          background: "transparent",
          border: "none",
          padding: "1.2rem 2rem 0.8rem 2rem"
        }}
      >
        <h2
          style={{
            fontSize: "1.32rem",
            fontWeight: 600,
            color: "var(--rvnwl-accent-burn)",
            marginBottom: 0,
            letterSpacing: ".04em",
            textTransform: "uppercase"
          }}
        >
          Global Revamp Stats
        </h2>
        <div
          style={{
            height: 3,
            width: "100%",
            background: "linear-gradient(90deg, var(--rvnwl-accent-burn) 30%, transparent 100%)",
            margin: "10px 0 0 0",
            borderRadius: 2
          }}
        />
      </Card.Header>
      <Card.Body style={{ padding: "2.1rem 2rem 1.4rem 2rem" }}>
        <div style={{
          marginBottom: "1.6rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.6rem"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7, letterSpacing: ".02em" }}>
              <span style={{ fontWeight: 400, color: "#abbfd5" }}>Network:</span>
              <span style={{ fontWeight: 600, color: "var(--rvnwl-accent-cyan)", fontSize: "1.18rem" }}>
              {selectedNetwork?.label ?? "–"}
              </span>
            </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontWeight: 400, color: "#abbfd5" }}>Total Liquidity:</span>
              <span style={{ fontWeight: 600, color: "var(--rvnwl-accent-burn)", fontSize: "1.18rem" }}>
              {totalContrib.toFixed(4)} {selectedNetwork?.currency}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontWeight: 400, color: "#abbfd5" }}>Listing Fees:</span>
              <span style={{ fontWeight: 600, color: "#f7ba7a", fontSize: "1rem" }}>
              {totalFees.toFixed(4)} {selectedNetwork?.currency}
              </span>
            </div>
        </div>
        {topAddresses.length === 0 && (
          <Alert variant="secondary" className="mt-2 mb-0">
            No revamp data available yet.
          </Alert>
        )}
        <div className="stats-pies-row mt-4">
          <div className="stats-pie-wrap">
            <div className="text-center"
              style={{
                fontWeight: 500,
                color: "var(--rvnwl-accent-cyan)",
                marginBottom: 2,
                textTransform: "uppercase"
              }}>
              Top 20 Contributors
            </div>
            <div className="text-center"
              style={{
                color: "#adb7bd",
                fontSize: "0.95rem",
                fontWeight: 400
              }}>
              Share of Each Address
            </div>
            <div style={{ height: 180, marginTop: 8 }}>
              <Pie data={pie1Data} options={pieOptions} />
            </div>
          </div>
          <div className="stats-pie-wrap">
            <div className="text-center"
              style={{
                fontWeight: 500,
                color: "var(--rvnwl-accent-cyan)",
                marginBottom: 2,
                textTransform: "uppercase"
              }}>
              Top 20 vs Others
            </div>
            <div className="text-center"
              style={{
                color: "#adb7bd",
                fontSize: "0.95rem",
                fontWeight: 400
              }}>
              Total Contribution
            </div>
            <div style={{ height: 180, marginTop: 8 }}>
              <Pie data={pie2Data} options={pieOptions} />
            </div>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}
