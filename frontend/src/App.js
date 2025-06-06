// src/App.js
import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css";

import {
  useWeb3Modal,
  useWeb3ModalProvider,
  useWeb3ModalAccount,
} from "@web3modal/ethers/react";
import { BrowserProvider, Contract, formatEther } from "ethers";

import HeartbeatPulseLine from './components/HeartbeatPulseLine';

import { SiDiscord, SiTelegram, SiMedium, SiGithub, SiGitbook } from "react-icons/si";


import {
  AVAILABLE_NETWORKS,
  DEFI_ADDRESSES,
  ERC20_ABI,
} from "./constants";
import RevampABI from "./abis/RevampDeFi.json";

import NavbarComp from "./components/Navbar";
import MobileNavBar from "./components/MobileNavBar";
import ShareholdingDashboard from "./components/ShareholdingDashboard";
import RevampPage from "./components/RevampPage";
import UserStatsCard from "./components/UserStatsCard";
import AllAssetsTable from "./components/AllAssetsTable";
import TopRevampTokensTable from "./components/TopRevampTokensTable";

function App() {
  const { address, isConnected } = useWeb3ModalAccount();
  const { walletProvider } = useWeb3ModalProvider();
  const { open } = useWeb3Modal();

   // detect mobile UA once
   const isMobile = typeof navigator !== "undefined" &&
     /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
       .test(navigator.userAgent);
 
   // detect if we’re already inside MetaMask’s in‑app browser (its UA contains “MetaMask”)
   const isMMobileBrowser = isMobile && /MetaMask/i.test(navigator.userAgent);
 
   // on mobile outside MetaMask app → deep‑link; otherwise (desktop OR in‑app) open modal
   const handleConnectClick = () => {
     if (isMobile && !isMMobileBrowser) {
       const host = window.location.host;
       const path = window.location.pathname + window.location.search;
       window.location.href = `https://metamask.app.link/dapp/${host}${path}`;
     } else {
       open();  // Web3Modal: show connect/disconnect/switch UI
     }
   };

  const [signer, setSigner] = useState(null);
  const [theme, setTheme] = useState("dark");
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [listedAssets, setListedAssets] = useState([]);
  const [lastTxHash, setLastTxHash] = useState(null);

  const toggleTheme = () =>
    setTheme((t) => (t === "light" ? "dark" : "light"));
  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  // create signer when provider + address available
  useEffect(() => {
    async function setupSigner() {
      if (walletProvider && address) {
        try {
          const provider = new BrowserProvider(walletProvider);
          const newSigner = await provider.getSigner(address);
          setSigner(newSigner);
        } catch (err) {
          console.error("Error creating signer:", err);
        }
      } else {
        setSigner(null);
      }
    }
    setupSigner();
  }, [walletProvider, address]);

  // detect chain on mount + provider change
  useEffect(() => {
    async function detectChain() {
      if (!walletProvider) {
        setSelectedNetwork(null);
        return;
      }
      try {
        const p = new BrowserProvider(walletProvider);
        const hex = await p.send("eth_chainId", []);
        const id = parseInt(hex, 16);
        setSelectedNetwork(
          AVAILABLE_NETWORKS.find((n) => n.chainId === id) || null
        );
      } catch (e) {
        console.error("chain detect:", e);
        setSelectedNetwork(null);
      }
    }
    detectChain();
  }, [walletProvider]);

  // **NEW**: reload page whenever the user switches networks
  useEffect(() => {
    const raw = walletProvider?.provider;
    if (!raw?.on) return;
    const handleChainChanged = () => {
      // full refresh ensures all child components re-init with correct network
      window.location.reload();
    };
    raw.on("chainChanged", handleChainChanged);
    return () => {
      raw.removeListener("chainChanged", handleChainChanged);
    };
  }, [walletProvider]);

  // load listed assets on network/provider/tx changes
  useEffect(() => {
    async function loadListedAssets() {
      if (!selectedNetwork) {
        setListedAssets([]);
        return;
      }
      try {
        const rpc = walletProvider
          ? new BrowserProvider(walletProvider)
          : new BrowserProvider(window.ethereum);
        const addr = DEFI_ADDRESSES[selectedNetwork.chainId];
        if (!addr) {
          setListedAssets([]);
          return;
        }
        const core = new Contract(addr, RevampABI, rpc);
        const raw = await core.getAllListedTokens();
        const enriched = await Promise.all(
          raw.map(async (item) => {
            const rate = parseFloat(formatEther(item.rate)).toFixed(8);
            let name = "?", symbol = "?", decimals = 18;
      try {       const tok = new Contract(item.token, ERC20_ABI, rpc);
        const [n, s, decRaw] = await Promise.all([
          tok.name(),
          tok.symbol(),
          tok.decimals(),       // returns BigNumber
        ]);       name = n;
        symbol = s;
        // convert BigNumber to JS number
        decimals = decRaw.toNumber();
      } catch (err) {
        console.warn("Could not fetch metadata for", item.token, err);
      }
            return {
              networkName: selectedNetwork.label,
              tokenAddress: item.token,
              tokenName: name,
              tokenSymbol: symbol,
              decimals,
              rate,
              logoUrl: item.logoUrl || "",
              blacklisted: item.blacklisted,
              lister: item.lister,
              listedAt: item.listedAt?.toNumber?.(),
            };
          })
        );
        setListedAssets(enriched);
      } catch (e) {
        console.error("loadListedAssets", e);
        setListedAssets([]);
      }
    }
    loadListedAssets();
  }, [selectedNetwork, walletProvider, lastTxHash]);

  // tx hash callbacks
  const onDepositSuccess = (tx) => setLastTxHash(tx);
  const onClaimSuccess   = (tx) => setLastTxHash(tx);
  const onRevampSuccess  = (tx) => setLastTxHash(tx);
  const onAddListedAsset = (tx) => setLastTxHash(tx);

  // Advanced: 3D parallax card scroll (optional, smooths on desktop only)
  useEffect(() => {
    if (window.innerWidth < 641) return; // Desktop only
    function onScroll() {
      const cards = document.querySelectorAll('.parallax-card');
      const table = document.querySelector('.parallax-table');
      const wh = window.innerHeight;
      cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        let ratio = Math.min(Math.max((wh - rect.top) / wh, 0), 1);
        card.style.transform = `translateY(${-12 * ratio}px) scale(${1 + 0.024 * ratio})`;
      });
      if (table) {
        const rect = table.getBoundingClientRect();
        let ratio = Math.min(Math.max((wh - rect.top) / wh, 0), 1);
        table.style.transform = `translateY(${-18 * ratio}px) scale(${1 + 0.017 * ratio})`;
      }
    }
    window.addEventListener('scroll', onScroll);
    setTimeout(onScroll, 150);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  

  return (
    <Router>
    <div className="relative min-h-screen">
      {/* Fixed Top Navbar */}
      <NavbarComp theme={theme} toggleTheme={toggleTheme} />

        {/* Page content: adds top padding equal to navbar height */}
      <main className="pt-16 pb-5">
        {!isConnected ? (
          <div className="landing-page">
          {/* ───────────────  HERO  ─────────────── */}
          <section className="hero">
          <h1>Stop Bag‑Holding. Start Value‑Holding.</h1>
          <p class="phero">
            Revamp is the first protocol that <strong>recycles</strong> illiquid tokens into native blockchain currency—at premium, preset rates.<br />
            No hype. No persuasion. Just code-driven supply cleanup and transparent, on-chain liquidity. Participation is always voluntary and outcomes are algorithmic, not speculative.
          </p>
          <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <HeartbeatPulseLine />
          </div>
          <div className="hero-btn-aligned">
            <button className="btn-primary" onClick={handleConnectClick}>
              Connect &amp; Join Revamp
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                document.getElementById("revamp-rates-table").scrollIntoView({ behavior: "smooth" });
              }}
            >
              See Revamp Rates
            </button>
          </div>
        </section>

        {/* ─────────────  INSIGHT ROW 1  ───────────── */}
        <section className="info-grid parallax-cards">
          <div className="info-card parallax-card">
            <h2>The Great Crypto Illusion</h2>
            <p>
              Most tokens aren’t used—they’re <em>priced</em>. This isn’t liquidity: it’s static noise, trapping capital and dragging the market down.
            </p>
          </div>
          <div className="info-card parallax-card">
            <h2>Turn Dead Weight into Flow</h2>
            <p>
              Join the revamp pool: submit stagnant tokens and matching native currency at your chosen rate, and start accumulating real, on-chain value as illiquid supply is permanently removed.
            </p>
          </div>
        </section>

        {/* ─────────────  INSIGHT ROW 2  ───────────── */}
        <section className="info-grid parallax-cards">
          <div className="info-card parallax-card">
            <h2>How Revamp Works</h2>
            <p>
              1&nbsp;·&nbsp;Connect your wallet&nbsp;&nbsp;❯&nbsp;&nbsp;
              2&nbsp;·&nbsp;Select asset &amp; join revamp pool&nbsp;&nbsp;❯&nbsp;&nbsp;
              3&nbsp;·&nbsp;Provide both the asset and network currency<br />
              Your participation shrinks global supply and generates ongoing rewards—no speculation, just transparent protocol logic.
            </p>
          </div>
          <div className="info-card parallax-card">
            <h2>No “Moon Shots”—Just Cleanup</h2>
            <p>
              Revamp isn’t a token sale or pump. It’s an on-chain recycling engine. The protocol removes excess supply, rewards participation, and helps restore true value to the crypto ecosystem—no empty promises.
            </p>
          </div>
        </section>

        {/* ─────────────  INSIGHT ROW 3  ───────────── */}
        <section className="info-grid parallax-cards">
          <div className="info-card parallax-card">
            <div className="info-card-content">
              <h2>Own the Burn Engine</h2>
              <p>
                Join the protocol’s fixed 100-share pool—shares never leave the contract. Earn native-currency dividends from every listing, delisting, pool join, and revamp activity. No dilution. No off-chain admin. Just transparent, on-chain participation.
              </p>
            </div>
            <div className="info-card-footer info-card-footer-row">
              <button className="btn-card" onClick={handleConnectClick}>
                Join ShareHolding Pool
              </button>
            </div>
          </div>
          <div className="info-card parallax-card community">
          <div className="info-card-content">
            <h2>Join the Movement</h2>
            <p>
              Plug into our governance forums, follow protocol decisions, and help steer the world’s first cleanup engine for crypto excess. All are welcome—no prior stake required.
            </p>
          </div>
          <div className="community-links" style={{ marginLeft: "auto" }}>
            <div className="community-links">
              <a href="https://discord.gg/YOURINVITE" target="_blank" rel="noopener noreferrer" aria-label="Discord">
                <SiDiscord className="community-icon discord" size={28} />
              </a>
              <a href="https://t.me/PROFILE" target="_blank" rel="noopener noreferrer" aria-label="Telegram">
                <SiTelegram className="community-icon telegram" size={28} />
              </a>
              <a href="https://medium.com/@YOURPROFILE" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                <SiMedium className="community-icon github" size={28} />
              </a>
              <a href="https://github.com/YOURPROFILE" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                <SiGithub className="community-icon github" size={28} />
              </a>
              <a href="https://docs.YOURPROJETWEBADDRESS.com" target="_blank" rel="noopener noreferrer" aria-label="GitBook">
                <SiGitbook className="community-icon gitbook" size={28} />
              </a>
            </div>
          </div>
        </div>
        </section>
          <section
            id="revamp-rates-table"
            className="parallax-table"
            style={{
              width: "100%",
              maxWidth: 1600,
              margin: "0 auto",
              marginTop: 40
            }}>
             <TopRevampTokensTable />
          </section>
        </div>        
          ) : (
            <Routes>
            <Route path="/" element={<Navigate to="/revamp" replace />} />

            <Route
              path="/revamp"
              element={
                <RevampPage
                  selectedNetwork={selectedNetwork}
                  listedAssets={listedAssets}
                  signer={signer}
                  lastTxHash={lastTxHash}
                  onDepositSuccess={onDepositSuccess}
                  onClaimSuccess={onClaimSuccess}
                  onRevampSuccess={onRevampSuccess}
                  onAddListedAsset={onAddListedAsset}
                />
              }
            />

            <Route
              path="/shareholding"
              element={
                <ShareholdingDashboard
                signer={signer}
                selectedNetwork={selectedNetwork}
                />
              }
            />

            <Route
                path="/stats"
                element={
                  <div className="container my-4">
                    <UserStatsCard
                      selectedNetwork={selectedNetwork}
                      listedAssets={listedAssets}
                      lastTxHash={lastTxHash}
                      onOpenClaimModal={onClaimSuccess}
                      onOpenRevampModal={onRevampSuccess}
                      onOpenListModal={onAddListedAsset}
                    />
                  </div>
                }
              />
            <Route
                path="/assets"
                element={
                  <div className="container my-4">
                    <AllAssetsTable
                      listedAssets={listedAssets}
                      selectedNetwork={selectedNetwork}
                      userBalances={{}}
                      currentAccount={address}
                    />
                  </div>
                }
              />
          </Routes>
        )}
      </main>
      {/* Fixed Bottom Mobile Navbar (only on <lg screens) */}
      <div className="d-lg-none">
        <MobileNavBar />
      </div>
    </div>
  </Router>
);
}

export default App;
