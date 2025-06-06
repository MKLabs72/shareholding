import React, { useState, useEffect } from "react";
import { BrowserProvider, Contract, formatEther, parseUnits } from "ethers";
import { DEFI_ADDRESSES } from "../constants";
import RevampABI from "../abis/RevampDeFi.json";
import { Button, Modal, Spinner, Form } from "react-bootstrap";

const MINIMAL_ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address, address) view returns (uint256)",
  "function approve(address, uint256) external returns (bool)"
];

export default function ClaimReinvestModal({
  isOpen,
  selectedNetwork,
  listedAssets = [],
  onClose,
  onClaimSuccess,
  onRevampSuccess
}) {
  // --- State
  const [pendingRevamp, setPendingRevamp] = useState(0);
  const [claimFee, setClaimFee] = useState(0);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transactionHash, setTransactionHash] = useState(null);
  const [showTxModal, setShowTxModal] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showRevampAccordion, setShowRevampAccordion] = useState(false);
  const [eligibleTokens, setEligibleTokens] = useState([]);
  const [account, setAccount] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setPendingRevamp(0);
      setClaimFee(0);
      setAgreeTerms(false);
      setIsLoading(false);
      setTransactionHash(null);
      setShowTxModal(false);
      setShowTerms(false);
      setSelectedAsset(null);
      setShowRevampAccordion(false);
      setEligibleTokens([]);
    }
  }, [isOpen]);

  // Account detection
  useEffect(() => {
    async function getAccount() {
      try {
        const provider = new BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_accounts", []);
        if (accounts.length > 0) setAccount(accounts[0]);
      } catch (err) {
        console.error("Error getting account:", err);
      }
    }
    getAccount();
  }, []);

  // Fetch pending income and claim fee
  useEffect(() => {
    async function fetchClaimData() {
      if (!isOpen || !selectedNetwork || !account) return;
      try {
        const provider = new BrowserProvider(window.ethereum);
        const contractAddr = DEFI_ADDRESSES[selectedNetwork.chainId];
        const coreDefi = new Contract(contractAddr, RevampABI, provider);
        const pending = await coreDefi.pendingReward(account);
        setPendingRevamp(Number(formatEther(pending)));
        const fee = await coreDefi.claimFee();
        setClaimFee(Number(formatEther(fee)));
      } catch (err) {
        console.error("Error fetching claim data:", err);
      }
    }
    fetchClaimData();
  }, [isOpen, selectedNetwork, account]);

  // Check for eligible tokens for revamp
  useEffect(() => {
    async function fetchEligibleTokens() {
      if (!account || !selectedNetwork || pendingRevamp <= 0) {
        setEligibleTokens([]);
        return;
      }
      const provider = new BrowserProvider(window.ethereum);
      const tokensForNetwork = listedAssets.filter(
        (a) => a.networkName === selectedNetwork.label
      );
      const results = await Promise.all(
        tokensForNetwork.map(async (token) => {
          try {
            const tokenContract = new Contract(token.tokenAddress, MINIMAL_ERC20_ABI, provider);
            const balanceBN = await tokenContract.balanceOf(account);
            const tokenDecimals = token.decimals || 18;
            const balance = parseFloat(formatEther(balanceBN, tokenDecimals));
            const requiredAmount = pendingRevamp / parseFloat(token.rate);
            if (balance >= requiredAmount) {
              return token;
            }
          } catch (err) {
            console.error("Error fetching token balance:", err);
          }
          return null;
        })
      );
      setEligibleTokens(results.filter((t) => t !== null));
    }
    fetchEligibleTokens();
  }, [account, selectedNetwork, pendingRevamp, listedAssets]);

  // --- Actions
  async function handleClaim() {
    if (pendingRevamp <= claimFee) return alert("Insufficient pending income for claim fee.");
    if (!agreeTerms) return alert("You must agree to the Terms.");
    setIsLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contractAddr = DEFI_ADDRESSES[selectedNetwork.chainId];
      const coreDefi = new Contract(contractAddr, RevampABI, signer);
      const tx = await coreDefi.claim();
      await tx.wait();
      setTransactionHash(tx.hash);
      onClaimSuccess?.(tx.hash);
      setShowTxModal(true);
      setTimeout(() => closeSuccessOverlay(), 3000);
    } catch (err) {
      console.error("Claim error:", err);
      alert("Claim failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRevamp() {
    if (!agreeTerms) return alert("You must agree to the Terms.");
    if (!selectedAsset) return alert("Select a revamp token.");
    setIsLoading(true);
    try {
      const tokenAmountCalculated = pendingRevamp / parseFloat(selectedAsset.rate);
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contractAddr = DEFI_ADDRESSES[selectedNetwork.chainId];
      const tokenContract = new Contract(selectedAsset.tokenAddress, MINIMAL_ERC20_ABI, signer);
      const decimals = selectedAsset.decimals || 18;
      const tokenBn = parseUnits(tokenAmountCalculated.toString(), decimals);
      const currentAccount = await signer.getAddress();
      const allowanceRaw = await tokenContract.allowance(currentAccount, contractAddr);
      if (allowanceRaw < tokenBn) {
        const approveTx = await tokenContract.approve(contractAddr, tokenBn);
        await approveTx.wait();
      }
      const coreDefi = new Contract(contractAddr, RevampABI, signer);
      const depositValue = parseUnits(pendingRevamp.toString(), 18);
      const tx = await coreDefi.deposit(selectedAsset.tokenAddress, tokenBn, { value: depositValue });
      await tx.wait();
      setTransactionHash(tx.hash);
      onRevampSuccess?.(tx.hash);
      setShowTxModal(true);
      setTimeout(() => closeSuccessOverlay(), 3000);
    } catch (err) {
      console.error("Revamp error:", err);
      alert("Revamp failed.");
    } finally {
      setIsLoading(false);
    }
  }

  function toggleRevampAccordion() {
    setShowRevampAccordion(!showRevampAccordion);
  }

  function closeSuccessOverlay() {
    setShowTxModal(false);
    setTransactionHash(null);
    onClose();
  }
  
  function getExplorerLink() {
    if (!transactionHash || !selectedNetwork) return "#";
    const base = selectedNetwork.explorerUrl || "https://etherscan.io";
    return `${base}/tx/${transactionHash}`;
  }

  // --- Render ---
  return (
    <>
      <Modal show={isOpen} onHide={onClose} centered dialogClassName="revamp-modal-dialog" contentClassName="revamp-modal" backdropClassName="revamp-modal-backdrop">
        <Modal.Header
          closeButton
          style={{
            background: "transparent",
            borderBottom: "none",
            padding: "1.4rem 2.1rem 0.4rem 2.1rem",
            alignItems: "flex-end"
          }}
        >
          <div className="w-100">
            <h2 style={{
              fontWeight: 600,
              fontSize: "1.32rem",
              letterSpacing: ".03em",
              color: "var(--rvnwl-accent-cyan)",
              marginBottom: 0,
              textTransform: "uppercase"
            }}>
              Claim / Rejoin
            </h2>
            <div style={{
              height: 3,
              width: "100%",
              background: "linear-gradient(90deg, var(--rvnwl-accent-cyan) 35%, transparent 100%)",
              marginTop: 10,
              borderRadius: 2
            }} />
          </div>
        </Modal.Header>
        <Modal.Body style={{ padding: "2.1rem 2.1rem 1.6rem 2.1rem", position: "relative" }}>
          {isLoading && (
            <div
              className="processing-overlay"
              style={{
                background: "rgba(18,22,29,0.72)",
                zIndex: 1051,
                borderRadius: "1.2rem"
              }}
            >
              <Spinner animation="border" variant="primary" />
              <p className="mt-2 processing-text">Processing…</p>
            </div>
          )}

          {/* Metrics Row */}
          <div className="mb-3 d-flex flex-wrap align-items-end" style={{ gap: 20 }}>
            <div>
              <div style={{ color: "var(--rvnwl-accent-cyan)", fontWeight: 600, fontSize: "1.12rem" }}>
                Pending Income
              </div>
              <span style={{ fontWeight: 800, fontSize: "1.22rem", color: "var(--rvnwl-accent-burn)" }}>
                {pendingRevamp.toFixed(4)}
              </span>
              <span style={{ marginLeft: 6, color: "#a0adc5" }}>
                {selectedNetwork?.currency}
              </span>
            </div>
            <div>
              <div style={{ color: "#86f0d2", fontWeight: 600, fontSize: "1.09rem" }}>
                Claim Fee
              </div>
              <span style={{ fontWeight: 700, fontSize: "1.09rem", color: "#ff8e65" }}>
                {claimFee.toFixed(4)}
              </span>
              <span style={{ marginLeft: 6, color: "#a0adc5" }}>
                {selectedNetwork?.currency}
              </span>
            </div>
          </div>
          {/* Claim + Reinvest */}
          <div className="d-grid gap-2 mb-3">
            <Button
              variant="primary"
              className="px-4 py-2 rounded-2"
              style={{ fontWeight: 600, fontSize: "1.09rem" }}
              onClick={handleClaim}
              disabled={!agreeTerms || isLoading || pendingRevamp <= claimFee}
            >
              Claim Revamp Income
            </Button>
            <Button
              variant="success"
              className="px-4 py-2 rounded-2"
              style={{ fontWeight: 600, fontSize: "1.09rem"  }}
              onClick={toggleRevampAccordion}
              disabled={!agreeTerms || isLoading || pendingRevamp <= 0}
            >
              {showRevampAccordion ? "Hide Rejoin Options" : "Rejoin Revamp"}
            </Button>
          </div>
          {/* Reinvest Section */}
          {showRevampAccordion && (
            <div className="glass-card p-3 mb-3" style={{ borderRadius: 12, border: "1px solid var(--card-border)" }}>
              <Form.Group>
                <Form.Label style={{ fontWeight: 700, color: "var(--rvnwl-accent-cyan)" }}>
                  Select Revamp Token
                </Form.Label>
                <Form.Select
                  onChange={e => {
                    const asset = eligibleTokens.find(a => a.tokenAddress === e.target.value);
                    setSelectedAsset(asset);
                  }}
                  value={selectedAsset?.tokenAddress || ""}
                  disabled={isLoading}
                  className="glass-input"
                >
                  <option value="">— Choose an Asset —</option>
                  {eligibleTokens.map(a => (
                    <option key={a.tokenAddress} value={a.tokenAddress}>
                      {a.tokenSymbol}: {(pendingRevamp / parseFloat(a.rate)).toFixed(4)}
                    </option>
                  ))}
                </Form.Select>
                {selectedAsset && (
                  <div className="mt-2" style={{ color: "#72ecb1", fontWeight: 700 }}>
                    You will revamp: {(pendingRevamp / parseFloat(selectedAsset.rate)).toFixed(4)} {selectedAsset.tokenSymbol}
                  </div>
                )}
                <Button
                  variant="success"
                  className="mt-3 w-100"
                  style={{ fontWeight: 600, fontSize: "1.08rem" }}
                  onClick={handleRevamp}
                  disabled={!agreeTerms || isLoading || !selectedAsset}
                >
                  Confirm Rejoin
                </Button>
              </Form.Group>
            </div>
          )}

          {/* Agree to Terms */}
          <Form.Group className="d-flex align-items-center mb-2 mt-3">
            <Form.Check
              type="checkbox"
              disabled={isLoading}
              checked={agreeTerms}
              onChange={() => setAgreeTerms(v => !v)}
              className="me-2"
              inline
              id="claim-reinvest-terms"
            />
            <Form.Label htmlFor="claim-reinvest-terms" className="mb-0" style={{ fontSize: "1.01rem" }}>
              I agree to the{" "}
              <Button
                variant="link"
                size="sm"
                className="p-0 align-baseline"
                onClick={() => setShowTerms(true)}
                disabled={isLoading}
                style={{ color: "var(--rvnwl-accent-cyan)", textDecoration: "underline" }}
              >
                terms
              </Button>.
            </Form.Label>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer style={{ borderTop: "none", background: "transparent", padding: "1.1rem 2.2rem 1.7rem 2.2rem" }}>
          <Button
            variant="outline-secondary"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-2"
            style={{ fontWeight: 600, fontSize: "1.03rem" }}
          >
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ==== Success overlay ==== */}
      {showTxModal && transactionHash && (
        <Modal
          show
          onHide={closeSuccessOverlay}
          centered
          dialogClassName="revamp-modal-dialog"
          contentClassName="revamp-modal"
        >
          <Modal.Header closeButton>
            <Modal.Title className="text-success fw-semibold">Transaction Confirmed!</Modal.Title>
          </Modal.Header>
          <Modal.Body className="text-center">
            <div className="mb-3">
              <span className="fw-normal" style={{ color: "var(--rvnwl-accent-cyan)", fontSize: "1.07rem" }}>
                Your transaction was mined!
              </span>
            </div>
            <div>
              <span className="small text-muted">Tx Hash:</span>
              <br />
              <a
                href={getExplorerLink()}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--rvnwl-accent-cyan)", wordBreak: "break-all", fontSize: "0.98rem" }}
              >
                {transactionHash.slice(0, 12)}…{transactionHash.slice(-12)}
              </a>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="success" onClick={closeSuccessOverlay}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      )}

      {/* ==== Terms & Conditions Modal ==== */}
      <Modal show={showTerms} onHide={() => setShowTerms(false)} centered dialogClassName="revamp-modal-dialog tandc-modal" contentClassName="revamp-modal tandc-modal" backdropClassName="tandc-modal-backdrop">
      <Modal.Header closeButton>
        <Modal.Title>Terms &amp; Conditions</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="small mb-0">
          By using the Claim / Rejoin Revamp functionality via this interface, you acknowledge and accept:
          <ul className="small mb-0 mt-2">
            <li>
              <strong>Claiming revamp income</strong> is final and will transfer the available accumulated native currency to your wallet, minus any applicable claim fee. All claim actions are irreversible.
            </li>
            <li>
              <strong>Rejoining revamp</strong> involves contributing your pending native currency income and an additional amount of the selected illiquid (revamp) asset, as calculated by the listed revamp rate. This process creates a new revamp participation, and the contributed illiquid asset will be permanently removed (“burned”) from circulation.
            </li>
            <li>
              All smart-contract transactions are final and irreversible once confirmed on the blockchain.
            </li>
            <li>
              <strong>No guarantees are provided</strong> regarding token prices, liquidity, or timing of income accumulation. Revamp returns are not immediate and depend on protocol activity.
            </li>
            <li>
              You are solely responsible for understanding the revamp protocol, relevant assets, and the network involved. Ensure you have thoroughly reviewed all documentation and implications before proceeding.
            </li>
            <li>
              Do not participate using assets or funds in violation of applicable laws or third-party rights.
            </li>
            <li>
              This user interface does not provide financial advice. For further details, see the source code:&nbsp;
              <a href="https://github.com/MKLabs72/revamp" target="_blank" rel="noopener noreferrer">
                GitHub repo.
              </a>
            </li>
          </ul>
          <br />
          <strong>Precautionary Notice:</strong> If you are uncertain, have doubts, or are not 100% sure about your participation, do not proceed. Only continue if you have conducted adequate research and fully understand the platform’s risks and mechanics.
        </p>
      </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowTerms(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
