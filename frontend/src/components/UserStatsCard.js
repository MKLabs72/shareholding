import React, { useState, useEffect } from "react";
import { JsonRpcProvider, Contract, formatEther } from "ethers";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { Card, Button } from "react-bootstrap";

import { DEFI_ADDRESSES } from "../constants";
import RevampABI from "../abis/RevampDeFi.json";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function UserStatsCard({
  selectedNetwork,
  listedAssets,
  lastTxHash,
  onOpenClaimModal,
  onOpenRevampModal,
  onOpenListModal
}) {
  const [myContrib, setMyContrib] = useState(0);
  const [pendingRevamp, setPendingRevamp] = useState(0);
  const [totalPool, setTotalPool] = useState(0);

  // For 2× logic
  const [maxPotential, setMaxPotential] = useState(0);
  const [capLeft, setCapLeft] = useState(0);

  // For line chart data
  const [labels, setLabels] = useState([]);
  const [myContribData, setMyContribData] = useState([]);
  const [maxPotentialData, setMaxPotentialData] = useState([]);
  const [capLeftData, setCapLeftData] = useState([]);

  useEffect(() => {
    fetchUserStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNetwork, listedAssets]);

  function updateChart(newContrib, newMax, newLeft) {
    const label = new Date().toLocaleTimeString();
    setLabels((prev) => [...prev.slice(-9), label]);
    setMyContribData((prev) => [...prev.slice(-9), newContrib]);
    setMaxPotentialData((prev) => [...prev.slice(-9), newMax]);
    setCapLeftData((prev) => [...prev.slice(-9), newLeft]);
  }

  async function fetchUserStats() {
    if (!selectedNetwork || !window.ethereum) return;
    try {
      const provider = new JsonRpcProvider(selectedNetwork.rpcUrl);
      const addr = DEFI_ADDRESSES[selectedNetwork.chainId];
      if (!addr) return;

      const coreDefi = new Contract(addr, RevampABI, provider);

      const totalBn = await coreDefi.totalNativeContributed();
      const totalVal = parseFloat(formatEther(totalBn));
      setTotalPool(totalVal);

      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      if (accounts.length === 0) return;
      const userAddr = accounts[0];

      const userData = await coreDefi.users(userAddr);
      const userVal = parseFloat(formatEther(userData.totalContributed));
      setMyContrib(userVal);

      const p = await coreDefi.pendingReward(userAddr);
      const pVal = parseFloat(formatEther(p));
      setPendingRevamp(pVal);

      // 2× logic
      setMaxPotential(userVal * 2);
      setCapLeft(userVal * 2 - pVal);

      updateChart(userVal, userVal * 2, userVal * 2 - pVal);
    } catch (err) {
      console.error("UserStatsCard fetch error:", err);
    }
  }

  // Generate the chart data
  const chartData = {
    labels,
    datasets: [
      {
        label: "My Revamp Liquidity",
        data: myContribData,
        borderColor: "rgba(75,192,192,1)",
        backgroundColor: "rgba(75,192,192,0.2)",
        tension: 0.4,
        pointRadius: 1.5,
        fill: true,
        borderWidth: 1,
      },
      {
        label: "Max Potential (2×)",
        data: maxPotentialData,
        borderColor: "rgba(255,99,132,1)",
        backgroundColor: "rgba(255,99,132,0.2)",
        tension: 0.4,
        pointRadius: 1.5,
        fill: true,
        borderWidth: 1,
      },
      {
        label: "Potential Left",
        data: capLeftData,
        borderColor: "rgba(54,162,235,1)",
        backgroundColor: "rgba(54,162,235,0.2)",
        tension: 0.4,
        pointRadius: 1.5,
        fill: true,
        borderWidth: 1,
      },
    ],
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "bottom",
        labels: {
          font: {
            size: 12,
            family: "Arial",
          },
          usePointStyle: true,
        },
      },
      title: {
        display: true,
        text: "My Revamp Statistics Over Time",
        font: {
          size: 16,
          weight: "normal",
        },
      },
      tooltip: {
        enabled: true,
        mode: "index",
        intersect: false,
        callbacks: {
          label: function (context) {
            let label = context.dataset.label || "";
            if (label) {
              label += ": ";
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y.toFixed(2);
            }
            return label;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxRotation: 0, autoSkip: true },
      },
      y: {
        grid: { color: "rgba(255, 255, 255, 0.2)" },
        ticks: { beginAtZero: true },
      },
    },
    animation: {
      duration: 1000,
      easing: "easeOutQuart",
    },
  };

  function getExplorerLink(tx) {
    if (!selectedNetwork || !selectedNetwork.explorerUrl) return "#";
    return `${selectedNetwork.explorerUrl}/tx/${tx}`;
  }

  return (
    <Card
      className="mb-4 h-100 user-stats-card shadow"
      style={{
        minHeight: 520,
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
          My Revamp Stats
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
        {/* Key Stats Grouped */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "2.5rem 3.2rem",
            marginBottom: "2rem"
          }}
        >
          {/* Stats as nice columns */}
          <div style={{ minWidth: 210, flex: 1 }}>
            <div style={{
              fontSize: "1.06rem",
              fontWeight: 600,
              color: "var(--rvnwl-accent-cyan)",
              textTransform: "uppercase",
              letterSpacing: ".02em"
            }}>
              {selectedNetwork?.label || ""}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, color: "#abbfd5", fontWeight: 400, margin: "8px 0 0 0" }}>
              <span>Contributed:</span>
              <span style={{
                color: "var(--rvnwl-accent-burn)", fontWeight: 600, fontSize: "1.13rem", marginLeft: 6
              }}>{myContrib.toFixed(4)} {selectedNetwork?.currency}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, color: "#abbfd5", fontWeight: 400 }}>
              <span>Pending Income:</span>
              <span style={{
                color: "#fb39a3", fontWeight: 600, fontSize: "1.13rem", marginLeft: 6
              }}>{pendingRevamp.toFixed(4)} {selectedNetwork?.currency}</span>
            </div>
          </div>

          <div style={{ minWidth: 210, flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, color: "#abbfd5", fontWeight: 400 }}>
              <span>Global Pool:</span>
              <span style={{
                color: "var(--rvnwl-accent-cyan)", fontWeight: 600, fontSize: "1.13rem", marginLeft: 6
              }}>{totalPool.toFixed(4)} {selectedNetwork?.currency}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, color: "#abbfd5", fontWeight: 400 }}>
              <span>Revamp Output:</span>
              <span style={{
                color: "#3bf6b1", fontWeight: 600, fontSize: "1.13rem", marginLeft: 6
              }}>{maxPotential.toFixed(4)} {selectedNetwork?.currency}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, color: "#abbfd5", fontWeight: 400 }}>
              <span>Expecting:</span>
              <span style={{
                color: "#31c9ff", fontWeight: 600, fontSize: "1.13rem", marginLeft: 6
              }}>{capLeft.toFixed(4)} {selectedNetwork?.currency}</span>
            </div>
          </div>
        </div>
  
        {/* Last Transaction (if present) */}
        {lastTxHash && (
          <div
            className="rounded shadow-sm mb-4 px-3 py-2"
            style={{
              background: "var(--card-bg-alt, #212631)",
              color: "var(--rvnwl-accent-cyan)",
              fontSize: "0.97rem",
              border: "1px solid var(--card-border)",
              wordBreak: "break-all"
            }}
          >
            <strong>Last Revamp Transaction:</strong>&nbsp;
            <a
              href={getExplorerLink(lastTxHash)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--rvnwl-accent-cyan)",
                fontFamily: "monospace",
                textDecoration: "underline",
                fontSize: "0.95em"
              }}
            >
              {`${lastTxHash.slice(0, 16)}...${lastTxHash.slice(-16)}`}
            </a>
          </div>
        )}
  
        {/* Chart */}
        <div
          style={{
            height: "230px",
            background: "rgba(41,50,65,0.05)",
            borderRadius: "1.1rem",
            border: "1px solid var(--card-border)",
            marginBottom: "2.1rem",
            padding: "1.0rem 1.3rem 0.6rem 1.3rem"
          }}
        >
          <Line data={chartData} options={chartOptions} />
        </div>
  
        {/* Action Buttons */}
        <div className="card-action-buttons">
        <Button
          variant="primary"
          onClick={onOpenClaimModal}
          className="action-btn"
          style={{
            background: "var(--rvnwl-accent-burn)",
            border: "none"
          }}
        >
          Claim / Rejoin
        </Button>
          <Button
            variant="success"
            onClick={onOpenRevampModal}
            className="action-btn"
            style={{ background: "#28e6ad", border: "none" }}
          >
            Join Revamp
          </Button>
          <Button
            variant="warning"
            onClick={onOpenListModal}
            className="action-btn"
            style={{ background: "#ffc107", border: "none" }}
          >
            List Asset
          </Button>
        </div>
      </Card.Body>
    </Card>
  );  
}
