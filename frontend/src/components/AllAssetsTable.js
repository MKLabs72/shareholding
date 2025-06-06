// AllAssetsTable.js

import React, { useState, useMemo, useEffect } from "react";
import { FaCopy, FaTrash, FaInfoCircle } from "react-icons/fa";
import { BrowserProvider, Contract, formatUnits } from "ethers";
import { DEFI_ADDRESSES } from "../constants";
import RevampABI from "../abis/RevampDeFi.json";
import { Table, Button, Spinner, Modal, Form } from "react-bootstrap";
import TCdelistModal from "./TCdelistAsset";

export default function AllAssetsTable({
  listedAssets,
  selectedNetwork,
  userBalances,
  currentAccount,
  onDelete,
}) {
  const [sortConfig, setSortConfig] = useState({ key: "rate", direction: "desc" });
  const [accumulatedBalances, setAccumulatedBalances] = useState({});
  const [delistFee, setDelistFee] = useState(null);
  const [showDelistModal, setShowDelistModal] = useState(false);
  const [assetToDelist, setAssetToDelist] = useState(null);
  const [isDelistLoading, setIsDelistLoading] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [assetForInfo, setAssetForInfo] = useState(null);
  const [totalSupply, setTotalSupply] = useState(null);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showTandC, setShowTandC] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const filtered = useMemo(() => {
    if (!selectedNetwork) return [];
    return listedAssets
      .filter(a => a.networkName === selectedNetwork.label)
      .filter(a => parseFloat(a.rate) > 0);
  }, [listedAssets, selectedNetwork]);

  const uniqueAssets = useMemo(() => {
    const m = new Map();
    for (const a of filtered) m.set(a.tokenAddress, a);
    return Array.from(m.values());
  }, [filtered]);

  const sortedAssets = useMemo(() => {
    const items = [...uniqueAssets];
    items.sort((a, b) => {
      let aV, bV;
      switch (sortConfig.key) {
        case "name": aV = a.tokenName.toLowerCase(); bV = b.tokenName.toLowerCase(); break;
        case "symbol": aV = a.tokenSymbol.toLowerCase(); bV = b.tokenSymbol.toLowerCase(); break;
        case "decimals": aV = a.decimals; bV = b.decimals; break;
        case "rate": aV = parseFloat(a.rate); bV = parseFloat(b.rate); break;
        case "accumulated": aV = parseFloat(accumulatedBalances[a.tokenAddress] || 0);
                          bV = parseFloat(accumulatedBalances[b.tokenAddress] || 0); break;
        default: aV = a.tokenName.toLowerCase(); bV = b.tokenName.toLowerCase();
      }
      return sortConfig.direction === "asc" ? aV - bV : bV - aV;
    });
    return items;
  }, [uniqueAssets, sortConfig, accumulatedBalances]);

  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
    setSortConfig({ key, direction });
  };

  const copyToClipboard = (text) => navigator.clipboard.writeText(text).then(() => alert("Address copied!"));

  const getExplorerLinkForAsset = (asset) => selectedNetwork ? `${selectedNetwork.explorerUrl}/address/${asset.tokenAddress}` : "#";

  useEffect(() => {
    async function fetchBalances() {
      if (!selectedNetwork || !window.ethereum) return;
      const provider = new BrowserProvider(window.ethereum);
      const accumulationAddress = DEFI_ADDRESSES[selectedNetwork.chainId];
      if (!accumulationAddress) return;
      const newBalances = {};
      await Promise.all(
        sortedAssets.map(async (asset) => {
          try {
            const tokenContract = new Contract(
              asset.tokenAddress,
              ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
              provider
            );
            const [balance, decimals] = await Promise.all([
              tokenContract.balanceOf(accumulationAddress),
              tokenContract.decimals()
            ]);
            newBalances[asset.tokenAddress] = parseFloat(formatUnits(balance, decimals)).toFixed(4);
          } catch (e) {
            console.error(e);
            newBalances[asset.tokenAddress] = "0.0000";
          }
        })
      );
      setAccumulatedBalances(newBalances);
    }
    fetchBalances();
  }, [sortedAssets, selectedNetwork]);

  useEffect(() => {
    async function fetchDelistFee() {
      if (!selectedNetwork || !window.ethereum) return;
      try {
        const provider = new BrowserProvider(window.ethereum);
        const contractAddr = DEFI_ADDRESSES[selectedNetwork.chainId];
        const contract = new Contract(contractAddr, RevampABI, provider);
        const fee = await contract.delistFee();
        setDelistFee(fee);
      } catch (e) {
        console.error(e);
      }
    }
    fetchDelistFee();
  }, [selectedNetwork]);    

  const handleOpenDelistModal = (asset) => {
    setAssetToDelist(asset);
    setShowDelistModal(true);
  };

  const handleCloseDelistModal = () => {
    setShowDelistModal(false);
    setAssetToDelist(null);
    setDelistFee(null);
  };

  const handleDelistConfirm = async () => {
    if (!selectedNetwork || !window.ethereum || !assetToDelist) return;
    setIsDelistLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const chainHex = "0x" + selectedNetwork.chainId.toString(16);
      await provider.send("wallet_switchEthereumChain", [{ chainId: chainHex }]);
  
      const signer = await provider.getSigner();
      const contractAddr = DEFI_ADDRESSES[selectedNetwork.chainId];
      const coreDefi = new Contract(contractAddr, RevampABI, signer);
  
      const tx = await coreDefi.delistAsset(assetToDelist.tokenAddress, { value: delistFee });
      await tx.wait();
  
      setTxHash(tx.hash);
      setShowSuccessModal(true);
      handleCloseDelistModal();
      if (onDelete) onDelete();
    } catch (err) {
      console.error("Delist failed:", err);
      alert("Delist failed. See console for details.");
    }
    setIsDelistLoading(false);
  };  

  const handleOpenInfoModal = async (asset) => {
    setAssetForInfo(asset);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const tokenContract = new Contract(
        asset.tokenAddress,
        [
          "function totalSupply() view returns (uint256)",
          "function decimals() view returns (uint8)"
        ],
        provider
      );
      const [supply, decimals] = await Promise.all([
        tokenContract.totalSupply(),
        tokenContract.decimals()
      ]);
      const formattedSupply = parseFloat(formatUnits(supply, decimals)).toFixed(4);
      setTotalSupply(formattedSupply);
    } catch (err) {
      console.error("Error fetching totalSupply:", err);
      setTotalSupply("Unknown");
    }
    setShowInfoModal(true);
  };

  const handleCloseInfoModal = () => {
    setShowInfoModal(false);
    setAssetForInfo(null);
    setTotalSupply(null);
  };
  function sliceAddress(addr, left = 8, right = 6) {
    if (!addr) return "";
    return addr.length > left + right + 3
      ? addr.slice(0, left) + "..." + addr.slice(-right)
      : addr;
  }

  return (
    <div className="all-assets-card">
      <div
        className="d-flex align-items-center px-4 pt-4 pb-3"
        style={{ borderBottom: "none", gap: 12 }}
      >
        <h2
          style={{
            fontSize: "1.22rem",
            fontWeight: 600,
            color: "var(--rvnwl-accent-burn)",
            marginBottom: 0,
            letterSpacing: ".04em",
            textTransform: "uppercase"
          }}
        >
          Listed Assets
        </h2>
        {selectedNetwork?.label && (
          <span
            style={{
              fontSize: "1.01rem",
              fontWeight: 500,
              color: "#63a4fa",
              marginLeft: 10,
              letterSpacing: ".02em",
              textTransform: "capitalize"
            }}
          >
            — {selectedNetwork.label} network
          </span>
        )}
      </div>
      <div
        style={{
          height: 3,
          width: "98%",
          background:
            "linear-gradient(90deg, var(--rvnwl-accent-burn) 30%, transparent 100%)",
          margin: "0 auto 1.1rem auto",
          borderRadius: 2
        }}
      />
      <Table
        bordered
        hover
        responsive
        className="text-center mx-3 mb-0 revamp-table"
      >
        <thead>
          <tr>
            <th>Logo</th>
            <th className="text-start pe-4" onClick={() => requestSort("name")}>Name</th>
            <th className="text-start pe-4" onClick={() => requestSort("symbol")}>Symbol</th>
            <th className="text-center pe-4" onClick={() => requestSort("decimals")}>Decimals</th>
            <th className="text-end pe-4" onClick={() => requestSort("rate")}>
              Rate {selectedNetwork?.currency ? `(${selectedNetwork.currency})` : ""}
            </th>
            <th className="text-end pe-4" onClick={() => requestSort("accumulated")}>Accumulated</th>
            <th className="actions-cell">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedAssets.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-3 text-muted">
                No assets listed
              </td>
            </tr>
          ) : (
            sortedAssets.map(asset => (
              <tr key={asset.tokenAddress}>
                <td>
                  <img
                    src={asset.logoUrl || "https://images.rvnwl.com/assets-placeholder.svg"}
                    alt={asset.tokenSymbol}
                    style={{ width: 30, height: 30, borderRadius: "50%" }}
                  />
                </td>
                <td className="text-start pe-4">
                  <a
                    href={getExplorerLinkForAsset(asset)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {asset.tokenName}
                  </a>
                </td>
                <td className="text-start pe-4">{asset.tokenSymbol}</td>
                <td className="text-center pe-4">{asset.decimals}</td>
                <td className="text-end pe-4">{asset.rate}</td>
                <td className="text-end pe-4">
                  {accumulatedBalances[asset.tokenAddress] || "0.0000"}
                </td>
                <td className="actions-cell">
                  <div className="action-btns">
                    <Button
                      variant="outline-light"
                      title="Copy Contract Address"
                      className="p-1 rounded-circle"
                      style={{ border: "none", color: "#6bbcff" }}
                      onClick={() => copyToClipboard(asset.tokenAddress)}
                    >
                      <FaCopy size={17} />
                    </Button>
                    <Button
                      variant="outline-light"
                      title="Asset Info"
                      className="p-1 rounded-circle"
                      style={{ border: "none", color: "#31c9ff" }}
                      onClick={() => handleOpenInfoModal(asset)}
                    >
                      <FaInfoCircle size={18} />
                    </Button>
                    <Button
                      variant="outline-light"
                      title="Delist Asset"
                      className="p-1 rounded-circle"
                      style={{ border: "none", color: "#fb39a3" }}
                      onClick={() => handleOpenDelistModal(asset)}
                    >
                      <FaTrash size={17} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </Table>
      {/* Delist Modal */}
      {showDelistModal && assetToDelist && (
       <Modal
       show
       centered
       onHide={handleCloseDelistModal}
       backdrop="static"
       contentClassName="revamp-modal"
     >
       {/* loading overlay */}
       {isDelistLoading && (
         <div className="processing-overlay">
           <div className="text-center">
             <Spinner animation="border" variant="light" />
             <p className="mt-2 processing-text">Waiting for confirmation…</p>
           </div>
         </div>
       )}
     
       <Modal.Header
         closeButton
         style={{
           background: "linear-gradient(90deg, #ff5067 0%, #ff7640 100%)",
           color: "#fff",
           borderBottom: "none",
           borderTopLeftRadius: "1rem",
           borderTopRightRadius: "1rem"
         }}
       >
         <Modal.Title style={{ fontWeight: 600, letterSpacing: ".04em", color: "#141415" }}>
           DELIST ASSET
         </Modal.Title>
       </Modal.Header>
     
       <Modal.Body style={{ padding: "2rem 2rem 1.4rem 2rem" }}>
         <div style={{
           display: "flex", flexDirection: "column",
           gap: "1.1rem", alignItems: "flex-start"
         }}>
           <div style={{
             fontSize: "1.16rem",
             fontWeight: 400,
             marginBottom: 0,
             color: "var(--card-text)",
             lineHeight: 1.32
           }}>
             <span style={{ display: "block", fontWeight: 400 }}>
               Are you sure you want to delist
             </span>
             <span style={{
               fontWeight: 700,
               color: "#ff5c1e",
               fontSize: "1.18rem",
               display: "inline-block"
             }}>
               &nbsp;{assetToDelist.tokenName}
             </span>
             <span style={{
               color: "#adb7bd",
               fontWeight: 400,
               fontSize: "1.05rem"
             }}>
               &nbsp;({assetToDelist.tokenAddress.slice(0, 8)}…{assetToDelist.tokenAddress.slice(-6)})
             </span>
             <span style={{ color: "#abbfd5" }}>?</span>
           </div>
     
           <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
           <span style={{
              fontWeight: 500,
              color: "#ffc107",
              fontSize: "1.11rem",
              textShadow: "0 1px 8px #442"
            }}>
              Delist fee:
            </span>
            <span style={{
              background: "#ff5067",
              color: "#fff",
              fontWeight: 600,
              borderRadius: "0.55rem",
              padding: "0.22rem 0.88rem",
              fontSize: "1.04rem",
              marginLeft: 2,
              display: "inline-block",
              letterSpacing: "0.01em"
            }}>
              {delistFee ? parseFloat(formatUnits(delistFee, 18)).toFixed(0) : "0.0000"} {selectedNetwork.currency}
            </span>
           </div>
     
           <div style={{ fontSize: "1.02rem" }}>
             <span style={{ color: "#ff5067", fontWeight: 500 }}>
               Lister:&nbsp;
               <span style={{
                 background: "#ffb4c1",
                 color: "#ad0f2d",
                 borderRadius: "0.4rem",
                 fontWeight: 700,
                 padding: "0.13rem 0.68rem",
                 fontSize: "1.02rem",
                 marginLeft: 2,
                 letterSpacing: "0.01em"
               }}>
                 {assetToDelist.lister
                   ? assetToDelist.lister.slice(0, 8) + "…" + assetToDelist.lister.slice(-6)
                   : "Unknown"}
               </span>
             </span>
           </div>
         </div>
     
         {/* Agree-to-terms */}
         <Form.Group className="d-flex align-items-center mt-4 mb-2">
           <Form.Check
             type="checkbox"
             checked={agreeTerms}
             onChange={() => setAgreeTerms(v => !v)}
             disabled={isDelistLoading}
             id="delist-terms-check"
             style={{ transform: "scale(1.14)" }}
           />
           <Form.Label className="ms-2 mb-0 small" htmlFor="delist-terms-check">
             I agree to the Terms
           </Form.Label>
           <Button
             size="sm"
             variant="link"
             className="ms-2 p-0"
             onClick={() => setShowTandC(true)}
             disabled={isDelistLoading}
             style={{ color: "#fb39a3", fontWeight: 600, textDecoration: "underline" }}
           >
             View Terms
           </Button>
         </Form.Group>
         {showTandC && (
           <TCdelistModal
             onClose={() => setShowTandC(false)}
             onAgree={() => {
               setAgreeTerms(true);
               setShowTandC(false);
             }}
           />
         )}
       </Modal.Body>
     
       <Modal.Footer style={{ borderTop: "none", justifyContent: "center", gap: "1.5rem" }}>
         <Button
           variant="secondary"
           onClick={handleCloseDelistModal}
           disabled={isDelistLoading}
           style={{
             minWidth: 140,
             borderRadius: "0.88rem",
             fontWeight: 600,
             fontSize: "1.13rem",
             background: "var(--rvnwl-accent-cyan)",
             color: "#1c3b3a"
           }}
         >
           Cancel
         </Button>
         <Button
           variant="danger"
           onClick={handleDelistConfirm}
           disabled={isDelistLoading || !agreeTerms}
           style={{
             minWidth: 170,
             borderRadius: "0.88rem",
             fontWeight: 600,
             fontSize: "1.13rem",
             opacity: !agreeTerms ? 0.7 : 1,
             background: "linear-gradient(90deg, #ff5067 0%, #ff7640 100%)",
             border: "none"
           }}
         >
           {isDelistLoading ? "Processing…" : "Delist"}
         </Button>
       </Modal.Footer>
     </Modal>     
      )}


      {/* Info Modal */}
      {showInfoModal && assetForInfo && (
        <Modal
          show
          centered
          onHide={handleCloseInfoModal}
          backdrop="static"
          contentClassName="revamp-modal asset-info-modal"
        >
          <Modal.Header
            closeButton
            className="bg-info"
            style={{
              background: "linear-gradient(90deg,#10e5fe 75%,#22c7e6 100%)",
              borderBottom: "none",
              padding: "1.4rem 2.2rem 1.1rem 2.2rem"
            }}
          >
            <Modal.Title style={{
              color: "#0a1820",
              fontWeight: 800,
              letterSpacing: ".03em",
              fontSize: "1.14rem",
              textTransform: "uppercase"
            }}>
              Asset Information
            </Modal.Title>
          </Modal.Header>

          <Modal.Body
            style={{
              background: "var(--card-bg)",
              color: "var(--card-text)",
              fontSize: "1.05rem",
              padding: "1.45rem 2.2rem 1.3rem 2.2rem"
            }}
          >
            <div className="mb-3" style={{ display: "flex", flexDirection: "column", gap: "1.0rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <span style={{ fontWeight: 700 }}>Token Address:</span>
                <a
                  href={`${selectedNetwork.explorerUrl}/address/${assetForInfo.tokenAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#12bee9",
                    fontFamily: "monospace",
                    fontWeight: 500,
                    fontSize: "0.97em",
                    textDecoration: "underline"
                  }}
                  title={assetForInfo.tokenAddress}
                >
                  {sliceAddress(assetForInfo.tokenAddress, 10, 8)}
                </a>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <span style={{ fontWeight: 700 }}>Lister:</span>
                <span
                  style={{
                    color: "#17e9c1",
                    fontFamily: "monospace",
                    fontSize: "0.97em",
                    fontWeight: 500,
                    wordBreak: "break-all"
                  }}
                  title={assetForInfo.lister}
                >
                  {assetForInfo.lister ? sliceAddress(assetForInfo.lister, 10, 8) : "Unknown"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <span style={{ fontWeight: 700 }}>Total Supply:</span>
                <span style={{ color: "#fbc841" }}>
                  {totalSupply !== undefined && totalSupply !== null
                    ? Number(totalSupply).toLocaleString(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 })
                    : "Loading…"}
                </span>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer style={{ borderTop: "none", background: "var(--card-bg)", padding: "0 2.2rem 1.2rem 2.2rem" }}>
            <Button
              variant="secondary"
              onClick={handleCloseInfoModal}
              style={{
                minWidth: 110,
                fontWeight: 700,
                background: "var(--rvnwl-accent-cyan)",
                color: "#122126",
                border: "none",
                borderRadius: "0.65rem",
                fontSize: "1.07rem"
              }}
            >
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      )}
      {/* Success Modal */}
      {showSuccessModal && txHash && (
        <Modal
          show
          onHide={() => setShowSuccessModal(false)}
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
                The asset has been successfully delisted.
              </span>
            </div>
            <div>
              <span className="small text-muted">Tx Hash:</span>
              <br />
              <a
                href={`${selectedNetwork.explorerUrl}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--rvnwl-accent-cyan)", wordBreak: "break-all", fontSize: "0.98rem" }}
              >
                {txHash.slice(0, 12)}…{txHash.slice(-12)}
              </a>
            </div>
          </Modal.Body>
          <Modal.Footer>
          <Button variant="success" onClick={() => {
            setShowSuccessModal(false);
            window.location.reload();
          }}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      )}
  </div>
);
}
