import React, { useState, useEffect } from "react";
import { BrowserProvider, Contract, parseUnits, formatUnits } from "ethers";
import { DEFI_ADDRESSES } from "../constants";
import RevampABI from "../abis/RevampDeFi.json";
import { Form, Button, Modal, Spinner, Alert, Placeholder } from "react-bootstrap";


const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function allowance(address, address) view returns (uint256)",
  "function approve(address, uint256) external returns (bool)"
];

export default function RevampModal({
  isOpen,
  onClose,
  selectedNetwork,
  listedAssets,
  onDepositSuccess
}) {
  // --- State ---
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [tokenAmount, setTokenAmount] = useState("");
  const [nativeAmount, setNativeAmount] = useState("");
  const [tokenBalance, setTokenBalance] = useState("0");
  const [nativeBalance, setNativeBalance] = useState("0");
  const [walletAssets, setWalletAssets] = useState([]);
  const [connectedAccount, setConnectedAccount] = useState(null);

  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionHash, setTransactionHash] = useState(null);
  const [showTxModal, setShowTxModal] = useState(false);

  // NEW: Fee state
  const [nativeFeePercent, setNativeFeePercent] = useState(null);
  const [shareholdingFeePercent, setShareholdingFeePercent] = useState(null);

  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [assetLoadError, setAssetLoadError] = useState("");


  // --- Reset on open ---
  useEffect(() => {
    if (isOpen) {
      setSelectedAsset(null);
      setTokenAmount(""); setNativeAmount("");
      setTokenBalance("0"); setNativeBalance("0");
      setWalletAssets([]); setConnectedAccount(null);
      setAgreeTerms(false); setShowTerms(false);
      setIsProcessing(false);
      setTransactionHash(null); setShowTxModal(false);
      setNativeFeePercent(null); setShareholdingFeePercent(null);
    }
  }, [isOpen]);

  // --- Load wallet assets ---
  useEffect(() => {
    async function fetchWalletAssets() {
      setIsLoadingAssets(true); setAssetLoadError("");
      if (!isOpen || !selectedNetwork || !window.ethereum) {
        setIsLoadingAssets(false); return;
      }
      try {
        const provider = new BrowserProvider(window.ethereum);
        const [acct] = await provider.send("eth_accounts", []);
        if (!acct) { setIsLoadingAssets(false); return; }
        setConnectedAccount(acct);
  
        // Parallel fetch for all assets
        const assets = listedAssets.filter(a => a.networkName === selectedNetwork.label);
        const balances = await Promise.all(
          assets.map(async (asset) => {
            try {
              const c = new Contract(asset.tokenAddress, ERC20_ABI, provider);
              const bal = await c.balanceOf(acct);
              return parseFloat(formatUnits(bal, asset.decimals || 18)) > 0 ? asset : null;
            } catch (err) {
              return null;
            }
          })
        );
        const assetsWithBal = balances.filter(Boolean);
        setWalletAssets(assetsWithBal);
        if (assetsWithBal.length === 0) setAssetLoadError("No eligible assets found in your wallet.");
      } catch (e) {
        setAssetLoadError("Failed to load wallet assets.");
        setWalletAssets([]);
      } finally {
        setIsLoadingAssets(false);
      }
    }
    fetchWalletAssets();
  }, [isOpen, selectedNetwork, listedAssets]);
  

  // --- Fetch fees from contract ---
  useEffect(() => {
    async function fetchFees() {
      if (!isOpen || !selectedNetwork || !window.ethereum) return;
      try {
        const provider = new BrowserProvider(window.ethereum);
        const contractAddr = DEFI_ADDRESSES[selectedNetwork.chainId];
        if (!contractAddr) return;
        const coreDefi = new Contract(contractAddr, RevampABI, provider);
        const natFee = await coreDefi.nativeFeePercent();
        const shFee = await coreDefi.shareholdingFeePercent();
        setNativeFeePercent(natFee.toString());
        setShareholdingFeePercent(shFee.toString());
      } catch (e) { setNativeFeePercent(null); setShareholdingFeePercent(null); }
    }
    fetchFees();
  }, [isOpen, selectedNetwork]);

  // --- Asset change: refresh balances ---
  async function handleAssetChange(addr) {
    const asset = listedAssets.find(a => a.tokenAddress === addr);
    setSelectedAsset(asset); setTokenAmount(""); setNativeAmount("");
    if (!asset || !window.ethereum) return;

    const provider = new BrowserProvider(window.ethereum);
    const [acct] = await provider.send("eth_accounts", []);
    if (!acct) return;
    setConnectedAccount(acct);

    await provider.send("wallet_switchEthereumChain",
      [{ chainId: "0x" + selectedNetwork.chainId.toString(16) }]);

    const tokC = new Contract(addr, ERC20_ABI, provider);
    setTokenBalance(formatUnits(await tokC.balanceOf(acct), asset.decimals || 18));
    setNativeBalance(formatUnits(await provider.getBalance(acct), 18));
  }

  // --- Amount helpers ---
  const onTokenAmountChange = v => {
    setTokenAmount(v);
    setNativeAmount(selectedAsset && v ? (parseFloat(v) * selectedAsset.rate).toFixed(6) : "");
  };
  const onNativeAmountChange = v => {
    setNativeAmount(v);
    setTokenAmount(selectedAsset && v ? (parseFloat(v) / selectedAsset.rate).toFixed(6) : "");
  };

  // --- Confirm (deposit) ---
  async function handleConfirm() {
    if (!selectedAsset) return alert("Select an asset first.");
    if (!tokenAmount || !nativeAmount) return alert("Enter both amounts.");
    if (!agreeTerms) return alert("You must agree to the terms.");
    setIsProcessing(true);

    try {
      const provider = new BrowserProvider(window.ethereum);
      await provider.send("wallet_switchEthereumChain",
        [{ chainId: "0x" + selectedNetwork.chainId.toString(16) }]);
      const signer = await provider.getSigner();
      const acct = await signer.getAddress();
      const contractAddr = DEFI_ADDRESSES[selectedNetwork.chainId];
      if (!contractAddr) throw new Error("No contract on this chain.");

      const tokC = new Contract(selectedAsset.tokenAddress, ERC20_ABI, signer);
      const needed = parseUnits(tokenAmount, selectedAsset.decimals || 18);
      if (await tokC.allowance(acct, contractAddr) < needed) {
        await (await tokC.approve(contractAddr, needed)).wait();
      }

      const core = new Contract(contractAddr, RevampABI, signer);
      const value = parseUnits(nativeAmount, 18);
      const tx = await core.deposit(selectedAsset.tokenAddress, needed, { value });
      await tx.wait();

      setTransactionHash(tx.hash); setShowTxModal(true);
      onDepositSuccess?.(tx.hash);
    } catch (e) {
      console.error(e);
      alert("Transaction failed or canceled.");
    } finally { setIsProcessing(false); }
  }

  const closeTxModal = () => { setShowTxModal(false); setTransactionHash(null); onClose(); };
  const explorerLink = transactionHash && selectedNetwork
    ? `${selectedNetwork.explorerUrl}/tx/${transactionHash}` : "#";

  // --- Render ---
  return (
    <>
      {/* ===================== Main modal ===================== */}
      <Modal show={isOpen} onHide={onClose} centered dialogClassName="revamp-modal-dialog" contentClassName="revamp-modal" backdropClassName="revamp-modal-backdrop">
        <Modal.Header closeButton style={{
          background: "transparent",
          borderBottom: "none",
          padding: "1.4rem 2.1rem 0.4rem 2.1rem",
          alignItems: "flex-end"
        }}>
          <div className="w-100">
            <h2 style={{
              fontWeight: 600,
              fontSize: "1.32rem",
              letterSpacing: ".03em",
              color: "var(--rvnwl-accent-cyan)",
              marginBottom: 0,
              textTransform: "uppercase"
            }}>
              Join Revamp
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
          {isProcessing && (
            <div className="processing-overlay">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2 processing-text">Joining Revamp…</p>
          </div>
          )}

          <div className="mb-2" style={{ fontSize: "1.07rem" }}>
            <span className="fw-normal" style={{ color: "var(--rvnwl-accent-cyan)" }}>
              Network:
            </span>
            <span style={{ color: "var(--card-text)", fontWeight: 600, marginLeft: 7 }}>
              {selectedNetwork?.label ?? "—"}{" "}
              <span style={{ color: "#7982a7", fontWeight: 500, fontSize: "0.96em" }}>
                (Chain {selectedNetwork?.chainId ?? "?"})
              </span>
            </span>
          </div>
          
          {/* NEW: Fee info */}
          {(nativeFeePercent !== null && shareholdingFeePercent !== null) && (
            <Alert variant="info" className="py-1 mb-2 small" style={{ borderRadius: 8 }}>
              Native Fee: <b>{(Number(nativeFeePercent) / 100).toFixed(2)}%</b> &nbsp;|&nbsp;
              Shareholding Fee: <b>{(Number(shareholdingFeePercent) / 100).toFixed(2)}%</b>
            </Alert>
          )}

          {/* Asset selector */}
          <Form.Group className="mb-4" style={{ position: "relative" }}>
            <Form.Label style={{ fontWeight: 500, color: "var(--rvnwl-accent-cyan)" }}>
              Select Revamp Asset
            </Form.Label>
            {isLoadingAssets ? (
              <Placeholder as="div" animation="wave" style={{ width: "100%", height: 38, borderRadius: 4 }}>
                <Placeholder xs={12} style={{ height: 38, borderRadius: 4 }} />
              </Placeholder>
            ) : (
              <Form.Select
                  value={selectedAsset?.tokenAddress || ""}
                  onChange={e => handleAssetChange(e.target.value)}
                  disabled={isProcessing || isLoadingAssets}
                  className="glass-input"
                >
                  <option value="">— Choose a Revamp Asset —</option>
                  {walletAssets.map(a => (
                    <option key={a.tokenAddress} value={a.tokenAddress}>
                      {a.tokenName} ({a.tokenSymbol}) — Rate:&nbsp;
                      {Number(a.rate).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                    </option>
                  ))}
                </Form.Select>

            )}
            {assetLoadError && (
              <div className="mt-1 small text-danger">{assetLoadError}</div>
            )}
          </Form.Group>

          {/* balances */}
          {connectedAccount && (
            <Alert variant="secondary" className="py-1 mb-3 small" style={{ borderRadius: 8 }}>
              <span style={{ color: "var(--rvnwl-accent-dark)" }}>
                Revamp Asset Balance:
              </span>{" "}
              <span style={{ fontWeight: 500 }}>
                {Number(tokenBalance).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
              </span>
              <span style={{ margin: "0 14px" }}><br /></span>
              <span style={{ color: "var(--rvnwl-accent-dark)" }}>
                Native Currency Balance:
              </span>{" "}
              <span style={{ fontWeight: 500 }}>
                {Number(nativeBalance).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
              </span>
            </Alert>
          )}

          {/* amount inputs */}
          <Form.Group className="mb-4">
            <Form.Label style={{ fontWeight: 500, color: "var(--rvnwl-accent-cyan)" }}>
              Enter Revamp Aseet Amount (burned)
            </Form.Label>
            <Form.Control
              type="number" value={tokenAmount}
              onChange={e => onTokenAmountChange(e.target.value)}
              disabled={isProcessing}
              className="glass-input"
            />
          </Form.Group>
          <Form.Group className="mb-4">
            <Form.Label style={{ fontWeight: 500, color: "var(--rvnwl-accent-cyan)" }}>
              Enter Native Currency Amount (doubled)
            </Form.Label>
            <Form.Control
              type="number" value={nativeAmount}
              onChange={e => onNativeAmountChange(e.target.value)}
              disabled={isProcessing}
              className="glass-input"
            />
          </Form.Group>

          {tokenAmount && nativeAmount && (
            <div className="small mb-2" style={{ color: "#8fe3e1", fontWeight: 500 }}>
              1 {selectedAsset?.tokenSymbol || "token"} = {selectedAsset?.rate || "—"} {selectedNetwork?.currency}
            </div>
          )}

          {/* agree to terms */}
          <Form.Group className="d-flex align-items-center mb-2 mt-3">
            <Form.Check
              type="checkbox"
              disabled={isProcessing}
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
                onClick={() => setShowTerms(true)}
                disabled={isProcessing}
                style={{
                  color: "var(--rvnwl-accent-cyan)",
                  textDecoration: "underline"
                }}
              >
                revamp terms
              </Button>.
            </Form.Label>
          </Form.Group>
        </Modal.Body>

        <Modal.Footer style={{ borderTop: "none", background: "transparent", padding: "1.1rem 2.2rem 1.7rem 2.2rem" }}>
          <Button
            variant="outline-secondary"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-2"
            style={{ fontWeight: 500, fontSize: "1.03rem" }}
          >
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={handleConfirm}
            disabled={!connectedAccount || !agreeTerms || isProcessing}
            className="px-4 py-2 rounded-2 flex flex-col items-center justify-center"
            style={{ fontWeight: 600, fontSize: "1.08rem", boxShadow: "0 2px 8px 0 rgba(0,255,180,.14)" }}
          >
            {isProcessing ? <Spinner animation="border" size="sm" /> : "Confirm"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ===================== Success overlay ===================== */}
      {showTxModal && transactionHash && (
        <Modal show centered dialogClassName="revamp-modal-dialog" contentClassName="revamp-modal" onHide={closeTxModal}>
          <Modal.Header closeButton>
            <Modal.Title className="text-success fw-normal">
              Transaction Confirmed
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="text-center">
            <div className="mb-3">
              <span className="fw-semibold" style={{ color: "var(--rvnwl-accent-cyan)", fontSize: "1.07rem" }}>
                Your transaction was mined!
              </span>
            </div>
            <div>
              <span className="small text-muted">Tx Hash:</span>
              <br />
              <a
                href={explorerLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--rvnwl-accent-cyan)", wordBreak: "break-all", fontSize: "0.98rem" }}
              >
                {transactionHash.slice(0, 12)}…{transactionHash.slice(-12)}
              </a>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="success" onClick={closeTxModal}>Close</Button>
          </Modal.Footer>
        </Modal>
      )}

      {/* ===================== Terms modal ===================== */}
      <Modal show={showTerms} onHide={() => setShowTerms(false)} centered dialogClassName="revamp-modal-dialog tandc-modal" contentClassName="revamp-modal tandc-modal" backdropClassName="tandc-modal-backdrop">
        <Modal.Header closeButton>
          <Modal.Title>Terms & Conditions</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="small mb-0">
            By joining a revamp order via this interface, you acknowledge and accept:
            <ul className="small mb-0">
            <li>Smart-contract interactions are irreversible once confirmed.</li>
            <li>No guarantees are provided regarding token prices or liquidity.</li>
            <li>This UI does not constitute financial advice.</li>
            <li>You are joining a <strong>revamp mechanism</strong> by contributing both the selected asset and the specified amount of network native currency, according to the listed revamp rate. Your participation is recorded on-chain and will trigger the permanent removal (“burn”) of the contributed revamp asset from circulation.</li>
            <li>The <strong>native currency</strong> you provide is distributed proportionally among all current revamp participants, according to their active participation (“liquidity value”) at the time of your join.</li>
            <li><strong>Revamp outcomes are not immediate.</strong> Your order will accumulate revamp income over time, as additional users join the revamp mechanism. There is no guarantee as to when or whether your maximum potential return will be reached.</li>
            <li><strong>No refund or reversal is possible</strong> after submitting a join transaction to the blockchain. All actions are final and irreversible.</li>
            <li>You are <strong>solely responsible</strong> for understanding the revamp protocol, the asset, and the network involved. Ensure you have thoroughly reviewed all documentation and the implications of participation.</li>
            <li><strong>Prohibited activity:</strong> Do not join using assets or funds in violation of applicable laws or third-party rights.</li>
            <li>
              Source code:&nbsp;
              <a href="https://github.com/MKLabs72/revamp" target="_blank" rel="noopener noreferrer">
                GitHub repo.
              </a>
            </li>
          </ul>
            <br />
            <strong>Precautionary Notice:</strong> If you are uncertain, have doubts, or are not 100% sure about your participation, do not proceed. Only continue if you have conducted adequate research and fully understand the platform’s risks and mechanics.
          </p>
        </Modal.Body>
        <br />
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowTerms(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
