// src/components/RevampPage.jsx
import React, { useState, useEffect } from "react";
import {
  Container,
  Row,
  Col,
  Form,
  InputGroup,
  Alert,
  Button,
} from "react-bootstrap";
import GlobalStatsCard from "./GlobalStatsCard";
import UserStatsCard from "./UserStatsCard";
import StatsChart from "./StatsChart";
import AllAssetsTable from "./AllAssetsTable";
import ClaimReinvestModal from "./ClaimReinvestModal";
import RevampModal from "./RevampModal";
import ListAssetModal from "./ListAssetModal";
import { AVAILABLE_NETWORKS } from "../constants";
import { useNavigate } from "react-router-dom";

export default function RevampPage({
  selectedNetwork,
  listedAssets,
  signer,
  lastTxHash,
  onDepositSuccess,
  onClaimSuccess,
  onRevampSuccess,
  onAddListedAsset,
  userBalances,
  currentAccount,
}) {
  // Modal visibility state
  const [showClaim, setShowClaim] = useState(false);
  const [showRevamp, setShowRevamp] = useState(false);
  const [showList, setShowList] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  // Chain detection state
  const [currentChain, setCurrentChain] = useState(null);
  const [chainOk, setChainOk] = useState(true);

  // detect chain & listen for changes
  useEffect(() => {
    async function checkChain() {
      if (!window.ethereum) {
        setChainOk(false);
        setCurrentChain(null);
        return;
      }
      try {
        const hex = await window.ethereum.request({ method: "eth_chainId" });
        const chainId = parseInt(hex, 16);
        const net = AVAILABLE_NETWORKS.find((n) => n.chainId === chainId) || null;
        setCurrentChain(net);
        setChainOk(
          selectedNetwork != null &&
          net != null &&
          net.chainId === selectedNetwork.chainId
        );
      } catch {
        setChainOk(false);
        setCurrentChain(null);
      }
    }

    checkChain();
    window.ethereum?.on("chainChanged", checkChain);
    return () => {
      window.ethereum?.removeListener("chainChanged", checkChain);
    };
  }, [selectedNetwork]);

  const hardRefreshWebsite = () => {
    navigate("/");          // optional: land on the home route
    window.location.reload();
  };

  return (
    <Container fluid className="revamp-page mt-5 pt-5">
      {/* Network mismatch warning */}
      {!chainOk && (
              <Alert variant="warning" className="d-flex flex-wrap align-items-center">
              <span>
                Switched from&nbsp;
                <strong>{selectedNetwork?.label ?? "previous network"}</strong>&nbsp;to&nbsp;
                <strong>{currentChain?.label || "new network"}</strong>.&nbsp;
                For the latest data, please refresh:
              </span>
      
              {/* text-link style refresh button */}
              <Button
                variant="primary"
                size="sm"
                className="ms-2"
                onClick={hardRefreshWebsite}
              >
                Refresh
              </Button>
            </Alert>
      )}

      {/* Top section: global & user stats */}
      <Row className="gy-4 align-items-stretch">
        <Col xs={12} md={6}>
          <GlobalStatsCard selectedNetwork={selectedNetwork} />
        </Col>
        <Col xs={12} md={6}>
          <UserStatsCard
            selectedNetwork={selectedNetwork}
            listedAssets={listedAssets}
            lastTxHash={lastTxHash}
            onOpenClaimModal={() => setShowClaim(true)}
            onOpenRevampModal={() => setShowRevamp(true)}
            onOpenListModal={() => setShowList(true)}
          />
        </Col>
      </Row>

      {/* Stats chart & summary */}
      <StatsChart selectedNetwork={selectedNetwork} />

      {/* Search + Assets table */}
      <Row className="mb-3">
        <Col>
          <InputGroup>
            <Form.Control
              placeholder="Search assets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>
        </Col>
      </Row>
      <Row>
        <Col>
          <div className="table-responsive">
            <AllAssetsTable
              listedAssets={listedAssets.filter(
                (a) =>
                  a.tokenName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  a.tokenSymbol.toLowerCase().includes(searchTerm.toLowerCase())
              )}
              selectedNetwork={selectedNetwork}
              userBalances={userBalances}
              currentAccount={currentAccount}
            />
          </div>
        </Col>
      </Row>

      {/* Modals */}
      <ClaimReinvestModal
        isOpen={showClaim}
        onClose={() => setShowClaim(false)}
        selectedNetwork={selectedNetwork}
        listedAssets={listedAssets}
        onClaimSuccess={onClaimSuccess}
        onRevampSuccess={onRevampSuccess}
      />

      <RevampModal
        isOpen={showRevamp}
        onClose={() => setShowRevamp(false)}
        selectedNetwork={selectedNetwork}
        listedAssets={listedAssets}
        onDepositSuccess={onDepositSuccess}
      />

      <ListAssetModal
        isOpen={showList}
        onClose={() => setShowList(false)}
        selectedNetwork={selectedNetwork}
        listedAssets={listedAssets}
        onAddListedAsset={onAddListedAsset}
      />
    </Container>
  );
}
