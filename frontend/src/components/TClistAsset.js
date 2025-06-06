import React from "react";
import { Modal, Button } from "react-bootstrap";

export default function TClistAsset({ onClose, onAgree }) {
  return (
    <Modal
      show
      onHide={onClose}
      centered
      dialogClassName="tandc-modal"          /* ⬅️  gives us a z-index hook */
      backdropClassName="tandc-backdrop"     /* ⬅️  custom darker overlay   */
    >
      <Modal.Header closeButton>
        <Modal.Title>Terms &amp; Conditions</Modal.Title>
      </Modal.Header>
        <Modal.Body style={{ maxHeight: "60vh", overflowY: "auto" }}>
          <div className="small mb-0">
            <p>
              By listing a new asset via this interface, you acknowledge and accept:
            </p>
            <ul>
              <li>
                <strong>Asset Details:</strong> You are listing an asset by selecting its smart contract address on the chosen network. The name, symbol, and decimals will be fetched automatically from the contract.
              </li>
              <li>
                <strong>Revamp Rate:</strong> You will specify your desired revamp rate between your listed asset and the network’s native currency. This rate may be higher or lower than the current market price.
              </li>
              <li>
                <strong>Logo URL:</strong> Providing a reliable direct link to the asset’s logo (e.g., CoinMarketCap, blockchain explorer, or official platform) enhances credibility and visibility. <b>This link cannot be changed later</b>, so please ensure its accuracy before submission.
              </li>
              <li>
                <strong>Listing Fee:</strong> A non-refundable fee is required to list an asset. This fee is proportionally distributed among current shareholders of the listing network.
              </li>
              <li>
                <strong>Delisting & Updates:</strong> To change any asset details or correct an error, you must delist and then relist the asset. The delisting fee is equal to the listing fee and is distributed in the same way. <b>The same asset can be listed only once at a time on each network.</b>
              </li>
              <li>
                <strong>Transparency:</strong> All listed assets and their details are public and visible to all protocol participants.
              </li>
              <li>
                <strong>No Guarantees:</strong> The protocol and its operators do not guarantee any market activity, demand, value, or outcome for listed assets.
              </li>
              <li>
                <strong>Compliance:</strong> You must not list assets in violation of any applicable laws, regulations, or third-party rights.
              </li>
              <li>
                <strong>Finality:</strong> All listing actions are final and irreversible once submitted to the blockchain.
              </li>
            </ul>
            <hr />
            <p className="text-muted mb-1">
              <strong>Precautionary Notice:</strong> If you are uncertain, have doubts, or are not 100% sure about your participation, do not proceed. Only continue if you have conducted adequate research and fully understand the platform’s risks and mechanics.
            </p>
          </div>
        </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="success" onClick={onAgree}>
          Agree
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
