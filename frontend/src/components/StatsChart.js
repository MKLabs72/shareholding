import React, { useState, useEffect } from "react";
import { JsonRpcProvider, Contract, formatEther } from "ethers";
import { DEFI_ADDRESSES } from "../constants";
import RevampABI from "../abis/RevampDeFi.json";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  Title
} from "chart.js";
import { Card, Row, Col } from "react-bootstrap";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  Title
);

export default function StatsChart({ selectedNetwork }) {
  const [labels, setLabels] = useState([]);
  const [feeData, setFeeData] = useState([]);
  const [contribData, setContribData] = useState([]);

  useEffect(() => {
    async function fetchStats() {
      if (!selectedNetwork) return;
      const addr = DEFI_ADDRESSES[selectedNetwork.chainId];
      if (!addr) return;
      try {
        const provider = new JsonRpcProvider(selectedNetwork.rpcUrl);
        const coreDefi = new Contract(addr, RevampABI, provider);

        // **Swapped** getTotalListingFees → totalListingFees
        const feesBn = await coreDefi.totalListingFees();
        const totalFees = parseFloat(formatEther(feesBn));

        const contribBn = await coreDefi.totalNativeContributed();
        const totalContrib = parseFloat(formatEther(contribBn));

        const timeLabel = new Date().toLocaleTimeString();

        setLabels((prev) => [...prev.slice(-9), timeLabel]);
        setFeeData((prev) => [...prev.slice(-9), totalFees]);
        setContribData((prev) => [...prev.slice(-9), totalContrib]);
      } catch (err) {
        console.debug("Stats fetch error:", err);
      }
    }

    fetchStats();
    const interval = setInterval(fetchStats, 15_000);
    return () => clearInterval(interval);
  }, [selectedNetwork]);

  const latestFees = feeData[feeData.length - 1] ?? 0;
  const latestContrib = contribData[contribData.length - 1] ?? 0;
  const feeRatio =
    latestContrib > 0 ? ((latestFees / latestContrib) * 100).toFixed(2) : "0.00";

  const data = {
    labels,
    datasets: [
      {
        label: "Total Listing Fees",
        data: feeData,
        borderColor: "rgba(75,192,192,1)",
        backgroundColor: "rgba(75,192,192,0.2)",
        fill: true,
        tension: 0.4,
        pointRadius: 1.5,
        borderWidth: 1
      },
      {
        label: "Total Contributed",
        data: contribData,
        borderColor: "rgba(255,99,132,1)",
        backgroundColor: "rgba(255,99,132,0.2)",
        fill: true,
        tension: 0.4,
        pointRadius: 1.5,
        borderWidth: 1
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom", labels: { usePointStyle: true } },
      title: {
        display: true,
        text: `Stats on ${selectedNetwork?.label || ""}`,
        font: { size: 16, weight: "normal" }
      },
      tooltip: {
        mode: "index",
        intersect: false,
        callbacks: {
          label: (ctx) => {
            const v = ctx.parsed.y;
            return `${ctx.dataset.label}: ${v?.toFixed(2)}`;
          }
        }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { autoSkip: true } },
      y: { ticks: { beginAtZero: true } }
    },
    animation: { duration: 1000, easing: "easeOutQuart" }
  };

  return (
    <Card
      className="mb-4 stats-chart-card shadow"
      style={{
        border: "1.5px solid var(--card-border)",
        borderRadius: "1.2rem",
        background: "var(--card-bg)",
        color: "var(--card-text)"
      }}
    >
      {/* Header with accent bar */}
      <Card.Header
        style={{
          background: "transparent",
          border: "none",
          padding: "1.2rem 2rem 0.8rem 2rem"
        }}
      >
        <h2
          style={{
            fontSize: "1.24rem",
            fontWeight: 600,
            color: "var(--rvnwl-accent-burn)",
            marginBottom: 0,
            letterSpacing: ".04em",
            textTransform: "uppercase"
          }}
        >
          Protocol Stats
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
        <Row
          className="gy-4"
          style={{ display: "flex", alignItems: "stretch" }}
        >
          <Col
            md={8}
            xs={12}
            style={{
              display: "flex",
              flexDirection: "column"
            }}
          >
            <div
              style={{
                flex: 1,
                height: "100%",
                background: "rgba(41,50,65,0.05)",
                borderRadius: "1.1rem",
                border: "1px solid var(--card-border)",
                padding: "1.1rem 1.2rem 0.7rem 1.2rem",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                minHeight: 260
              }}
            >
              <Line data={data} options={chartOptions} />
            </div>
          </Col>
          <Col
            md={4}
            xs={12}
            style={{
              display: "flex",
              flexDirection: "column"
            }}
          >
            <div
              style={{
                flex: 1,
                height: "100%",
                background: "rgba(41,50,65,0.05)",
                borderRadius: "1.1rem",
                border: "1px solid var(--card-border)",
                padding: "1.5rem 1.3rem",
                marginLeft: 0,
                minHeight: 260,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center"
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "1.08rem",
                  color: "var(--rvnwl-accent-cyan)",
                  textTransform: "uppercase",
                  marginBottom: 10
                }}
              >
                Current Summary
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                <span style={{ fontWeight: 400, color: "#abbfd5" }}>Latest Listing Fees:</span>
                <span style={{ fontWeight: 600, color: "#fb39a3", fontSize: "1.18rem" }}>
                {latestFees.toFixed(4)} {selectedNetwork?.currency}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                <span style={{ fontWeight: 400, color: "#abbfd5" }}>Total Contributed:</span>
                <span style={{ fontWeight: 600, color: "#3bf6b1", fontSize: "1.18rem" }}>
                {latestContrib.toFixed(4)} {selectedNetwork?.currency}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                <span style={{ fontWeight: 400, color: "#abbfd5" }}>Fees as % of Contrib.:</span>
                <span style={{ fontWeight: 600, color: "#31c9ff", fontSize: "1.18rem" }}>
                {feeRatio}%
                </span>
              </div>
              <div className="text-center mt-2" style={{ marginTop: "auto" }}>
                <small style={{ color: "#b3b3b3" }}>
                  Last updated at {labels[labels.length - 1] || "-"}
                </small>
              </div>
            </div>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );  
}
