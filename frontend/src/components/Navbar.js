// src/components/Navbar.js
import React, { useState, useEffect } from "react";
import { Navbar, Nav } from "react-bootstrap";
import { Link, NavLink } from "react-router-dom";
import { FiSun, FiMoon } from "react-icons/fi";
import { BiSolidPieChartAlt2 } from "react-icons/bi";
import { GiBlackHoleBolas } from "react-icons/gi";
import { ReactComponent as RVNWLLogo } from "../rvnwl.svg";


import {
  useWeb3Modal,
  useWeb3ModalProvider,
  useWeb3ModalAccount,
} from "@web3modal/ethers/react";
import { BrowserProvider } from "ethers";
import ConnectButton from "./ConnectButton";
import { AVAILABLE_NETWORKS } from "../constants";

export default function NavbarComp({ theme, toggleTheme }) {
  const { address, isConnected } = useWeb3ModalAccount();
  const { walletProvider } = useWeb3ModalProvider();
  const { open } = useWeb3Modal();

  const [expanded, setExpanded] = useState(false);
  const [chainId, setChainId] = useState(null);

  // detect chain
  useEffect(() => {
    if (!walletProvider) return setChainId(null);
    const p = new BrowserProvider(walletProvider);
    p.send("eth_chainId", [])
      .then((hex) => setChainId(parseInt(hex, 16)))
      .catch(() => setChainId(null));
  }, [walletProvider]);

  const network = AVAILABLE_NETWORKS.find((n) => n.chainId === chainId);

  // mobile deep-link logic
  const isMobile =
    typeof navigator !== "undefined" &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  const isMMobileBrowser =
    isMobile && /MetaMask/i.test(navigator.userAgent);
  const handleConnectClick = () => {
    if (isMobile && !isMMobileBrowser) {
      const host = window.location.host;
      const path = window.location.pathname + window.location.search;
      window.location.href = `https://metamask.app.link/dapp/${host}${path}`;
    } else {
      open();
    }
  };

  const truncate = (addr) => `${addr.slice(0, 6)}…${addr.slice(-6)}`;

  return (
    <Navbar
      expand="lg"
      fixed="top"
      className="top-bar navbar-dark"
      expanded={expanded}
      onToggle={setExpanded}
    >
      <div className="top-bar-inner">
      <div className="brand-and-toggle">
        {/* Brand */}
        <Navbar.Brand
          as={Link}
          to="/"
          className="brand-text rvnwl-logo d-flex align-items-center"
          style={{
            fontSize: '2.1rem',
            fontWeight: 900,
            letterSpacing: '0.18em',
            lineHeight: 1,
            userSelect: 'none'
          }}
          onClick={() => window.location.reload()}
        >
          <RVNWLLogo
            style={{
              height: "32px",
              width: "auto",
              display: "block",
              marginRight: "0.15em"
            }}
            aria-label="rvnwl"
          />
        </Navbar.Brand>

        {/* Hamburger */}
        <Navbar.Toggle aria-controls="main-nav" />
        </div>
        <Navbar.Collapse id="main-nav">
          <Nav className="ms-auto align-items-center">
            {/* network icon */}
            {isConnected && network && (
              <img
                src={network.icon}
                alt={network.label}
                className="network-logo me-3"
              />
            )}

            {/* connect / address */}
            <div
              className="connect-text me-4"
              onClick={handleConnectClick}
            >
              {isConnected ? truncate(address) : <ConnectButton small />}
            </div>

            {/* nav links */}
            {isConnected && (
              <>
                <Nav.Link
                  as={NavLink}
                  to="/revamp"
                  onClick={() => setExpanded(false)}
                  className="d-flex align-items-center me-3"
                >
                  <GiBlackHoleBolas size={20} className="me-1" />
                  Revamp
                </Nav.Link>
                <Nav.Link
                  as={NavLink}
                  to="/shareholding"
                  onClick={() => setExpanded(false)}
                  className="d-flex align-items-center me-4"
                >
                  <BiSolidPieChartAlt2 size={20} className="me-1" />
                  Shareholding
                </Nav.Link>
                {/* theme toggle */}
                <button
                  className="theme-toggle-btn"
                  onClick={toggleTheme}
                  aria-label="Toggle theme"
                >
                  {theme === "dark" ? (
                    <FiSun size={22} />
                  ) : (
                    <FiMoon size={22} />
                  )}
                </button>
              </>
            )}
          </Nav>
        </Navbar.Collapse>
      </div>
    </Navbar>
  );
}
