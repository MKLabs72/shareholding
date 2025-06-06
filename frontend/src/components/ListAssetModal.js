// src/components/ListAssetModal.jsx
import React, { useState, useEffect } from "react";
import {
  Modal, Button, Form, Spinner, Alert
} from "react-bootstrap";
import {
  BrowserProvider, JsonRpcProvider,
  Contract, parseUnits, formatEther
} from "ethers";
import { DEFI_ADDRESSES } from "../constants";
import RevampABI  from "../abis/RevampDeFi.json";
import TClistModal from "./TClistAsset";

export default function ListAssetModal({
  isOpen,
  selectedNetwork,
  onAddListedAsset,
  onClose
}) {
  /* ─────────── Form state ─────────── */
  const [tokenAddress, setTokenAddress] = useState("");
  const [rate,         setRate]         = useState("");
  const [logoUrl,      setLogoUrl]      = useState("");

  const [agreeTerms,   setAgreeTerms]   = useState(false);
  const [showTandC,    setShowTandC]    = useState(false);

  /* ─────────── Async state ────────── */
  const [listingFee, setListingFee] = useState(null);   // null = loading
  const [feeError,   setFeeError]   = useState("");
  const [isLoading,  setIsLoading]  = useState(false);

  /* ─────────── Success state ─────── */
  const [txHash, setTxHash] = useState(null);
  const [showOK, setShowOK] = useState(false);

  const addrDeployed = selectedNetwork && DEFI_ADDRESSES[selectedNetwork.chainId];
  const supported    = !!addrDeployed;

  /* ───────────────── Reset + fee fetch ───────────────── */
  useEffect(() => {
    if (!isOpen) return;

    // reset
    setTokenAddress(""); setRate(""); setLogoUrl("");
    setAgreeTerms(false); setShowTandC(false);
    setTxHash(null);      setShowOK(false);
    setListingFee(null);  setFeeError(""); setIsLoading(false);

    if (!supported) return;

    (async () => {
      try {
        /* 1 – try public RPC */
        let provider = new JsonRpcProvider(selectedNetwork.rpcUrl);
        let code     = await provider.getCode(addrDeployed);

        /* 2 – fall back to wallet RPC */
        if (code === "0x" && window.ethereum) {
          provider = new BrowserProvider(window.ethereum);
          code     = await provider.getCode(addrDeployed);
        }

        if (code === "0x") {
          setFeeError(`Contract not found on ${selectedNetwork.label}`);
          return;
        }

        const core = new Contract(addrDeployed, RevampABI, provider);
        setListingFee(await core.listingFee());
      } catch (err) {
        console.error("fetch fee", err);
        setFeeError(err.reason ?? err.message ?? "RPC error");
      }
    })();
  }, [isOpen, supported, selectedNetwork, addrDeployed]);

  /* ───────────────── Confirm handler ───────────────── */
  async function handleConfirm() {
    if (!supported)             return alert("Unsupported network.");
    if (!tokenAddress.trim())   return alert("Token address required.");
    if (!rate)                  return alert("Exchange rate required.");
    if (!agreeTerms)            return alert("You must agree to the terms.");
    if (listingFee === null)    return alert("Listing fee still loading.");
    if (feeError)               return alert(feeError);

    setIsLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      await provider.send("wallet_switchEthereumChain",
        [{ chainId: "0x" + selectedNetwork.chainId.toString(16) }]);

      const signer = await provider.getSigner();
      const core   = new Contract(addrDeployed, RevampABI, signer);

      const tx = await core.listNewAsset(
        tokenAddress.trim(),
        parseUnits(rate, 18),
        logoUrl.trim(),
        { value: listingFee }
      );
      await tx.wait();

      setTxHash(tx.hash); setShowOK(true);
      onAddListedAsset?.(tx.hash);
    } catch (err) {
      console.error("listNewAsset", err);
      alert("Listing failed. See console.");
    } finally { setIsLoading(false); }
  }

  const explorerUrl = () =>
    txHash && selectedNetwork
      ? `${selectedNetwork.explorerUrl}/tx/${txHash}` : "#";

  /* ─────────────────────────── Render ─────────────────────────── */
  return (
    <>
      {/* ======= Main Modal ======= */}
      <Modal
        show={isOpen}
        onHide={onClose}
        centered
        dialogClassName="revamp-modal-dialog"
        contentClassName="revamp-modal"
        backdropClassName="revamp-modal-backdrop"
       /* style={{ zIndex: 1200 }}*/
      >
        {/* Header with accent bar */}
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
            <h2
              style={{
                fontWeight: 600,
                fontSize: "1.32rem",
                letterSpacing: ".03em",
                color: "var(--rvnwl-accent-cyan)",
                marginBottom: 0,
                textTransform: "uppercase"
              }}
            >
              List a New Revamp Asset
            </h2>
            <div
              style={{
                height: 3,
                width: "100%",
                background: "linear-gradient(90deg, var(--rvnwl-accent-cyan) 35%, transparent 100%)",
                marginTop: 10,
                borderRadius: 2
              }}
            />
          </div>
        </Modal.Header>
  
        <Modal.Body style={{ padding: "2.1rem 2.1rem 1.6rem 2.1rem", position: "relative" }}>
          {isLoading && (
            <div
              className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
              style={{
                background: "rgba(18,22,29,0.72)",
                zIndex: 1250,
                borderRadius: "1.2rem"
              }}
            >
              <Spinner animation="border" variant="light" />
            </div>
          )}
  
          {/* NETWORK and Fee feedback */}
          <div className="mb-3" style={{ fontSize: "1.07rem" }}>
            <span className="fw-normal" style={{ color: "var(--rvnwl-accent-cyan)" }}>
              Network:
            </span>
            <span style={{ color: "var(--card-text)", fontWeight: 700, marginLeft: 7 }}>
              {selectedNetwork?.label ?? "—"}{" "}
              <span style={{ color: "#7982a7", fontWeight: 500, fontSize: "0.96em" }}>
                (Chain {selectedNetwork?.chainId ?? "?"})
              </span>
            </span>
          </div>
  
          {listingFee === null && !feeError && supported && (
            <div className="mb-2 d-flex align-items-center">
              <Spinner animation="border" size="sm" className="me-2" />{" "}
              <span style={{ color: "#a0adc5", fontWeight: 600 }}>Loading fee…</span>
            </div>
          )}
          {feeError && (
            <Alert variant="danger" className="py-1 mb-3" style={{ fontWeight: 600 }}>
              {feeError}
            </Alert>
          )}
          {listingFee && (
            <div
              className="mb-2"
              style={{
                fontWeight: 700,
                color: "var(--rvnwl-accent-cyan)",
                fontSize: "1.13rem"
              }}
            >
              Fee:&nbsp;
              <span style={{ color: "var(--rvnwl-accent-burn)" }}>
                {listingFee
                  ? Math.round(Number(formatEther(listingFee)))
                  : "—"} {selectedNetwork.currency}
              </span>
            </div>
          )}
  
          {/* === Form Fields === */}
          <Form>
            <Form.Group className="mb-4">
              <Form.Label style={{ fontWeight: 700, color: "var(--rvnwl-accent-cyan)" }}>
                Token Address
              </Form.Label>
              <Form.Control
                value={tokenAddress}
                onChange={e => setTokenAddress(e.target.value)}
                placeholder="0x..."
                disabled={!supported || isLoading}
                className="glass-input"
              />
            </Form.Group>
            <Form.Group className="mb-4">
              <Form.Label style={{ fontWeight: 700, color: "var(--rvnwl-accent-cyan)" }}>
                Exchange Rate&nbsp;
                <span className="fw-normal" style={{ color: "#a0adc5" }}>
                  (1 = 1.0000 {selectedNetwork?.currency})
                </span>
              </Form.Label>
              <Form.Control
                type="number"
                value={rate}
                onChange={e => setRate(e.target.value)}
                disabled={!supported || isLoading}
                className="glass-input"
              />
            </Form.Group>
            <Form.Group controlId="logoUrl" className="mb-4">
              <Form.Label style={{ fontWeight: 700, color: "var(--rvnwl-accent-cyan)" }}>
                Logo URL
              </Form.Label>
              <Form.Control
                type="url"
                placeholder="https://example.com/logo.png"
                value={logoUrl}
                onChange={e => setLogoUrl(e.target.value)}
                disabled={!supported || isLoading}
                className="glass-input"
                required
              />
            </Form.Group>
  
            {/* Agree to Terms */}
            <Form.Group className="d-flex align-items-center mb-2 mt-3">
              <Form.Check
                type="checkbox"
                disabled={!supported || isLoading}
                checked={agreeTerms}
                onChange={() => setAgreeTerms(v => !v)}
                className="me-2"
                inline
              />
              <Form.Label className="mb-0" style={{ fontSize: "1.01rem" }}>
                I agree to the{" "}
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 align-baseline"
                  onClick={() => setShowTandC(true)}
                  disabled={!supported || isLoading}
                  style={{
                    color: "var(--rvnwl-accent-cyan)",
                    textDecoration: "underline"
                  }}
                >
                  asset listing terms
                </Button>.
              </Form.Label>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer
          style={{
            borderTop: "none",
            background: "transparent",
            padding: "1.1rem 2.2rem 1.7rem 2.2rem"
          }}
        >
          <Button
            variant="outline-secondary"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-2"
            style={{ fontWeight: 600, fontSize: "1.03rem" }}
          >
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={handleConfirm}
            disabled={
              !supported || isLoading || !agreeTerms ||
              listingFee === null || !!feeError
            }
            className="px-4 py-2 rounded-2"
            style={{
              fontWeight: 600,
              fontSize: "1.08rem",
              boxShadow: "0 2px 8px 0 rgba(0,255,180,.14)"
            }}
          >
            {isLoading ? <Spinner animation="border" size="sm" /> : "Confirm"}
          </Button>
        </Modal.Footer>
      </Modal>
  
      {/* ======= Success Overlay ======= */}
      {showOK && txHash && (
        <Modal
          show
          onHide={() => { setShowOK(false); onClose(); }}
          centered
          contentClassName="glass-card"
          style={{ zIndex: 1250 }}
        >
          <Modal.Header closeButton>
            <Modal.Title className="text-success fw-semibold">
              Transaction Confirmed
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="text-center">
            <div className="mb-3">
              <span className="fw-normal" style={{ color: "var(--rvnwl-accent-cyan)", fontSize: "1.07rem" }}>
                Your listing was mined!
              </span>
            </div>
            <div>
              <span className="small text-muted">Tx Hash:</span>
              <br />
              <a
                href={explorerUrl()}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--rvnwl-accent-cyan)", wordBreak: "break-all", fontSize: "0.98rem" }}
              >
                {txHash.slice(0, 12)}…{txHash.slice(-12)}
              </a>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="success" onClick={() => { setShowOK(false); onClose(); }}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      )}
  
      {/* ======= Terms & Conditions ======= */}
      {showTandC && (
        <TClistModal
          show
          onClose={() => setShowTandC(false)}
          onAgree={() => { setAgreeTerms(true); setShowTandC(false); }}
          dialogClassName="revamp-modal-dialog tandc-modal"
          contentClassName="revamp-modal tandc-modal"
          backdropClassName="tandc-modal-backdrop"
          style={{ zIndex: 1300 }} // Ensures this is always on top
        />
      )}
    </>
  );  
}
