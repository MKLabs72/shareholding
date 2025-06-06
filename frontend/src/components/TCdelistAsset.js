import React from "react";
import { Modal, Button } from "react-bootstrap";

export default function TCdelistAsset({ onClose, onAgree }) {
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
      <Modal.Body>
        <p className="small mb-0">
          By delisting an asset via this interface, you acknowledge and accept:
          <br /><br />
          <strong>• Delisting requires payment of a non-refundable fee,</strong> which is distributed to protocol stakeholders. This fee is due at the time of confirmation and is not recoverable under any circumstances.<br /><br />

          <strong>• Delisting is a permanent action.</strong> Once confirmed, the asset will be removed from public availability and no further revamp participation will be possible for this asset.<br /><br />

          <strong>• No refunds or compensation</strong> will be provided for previously paid listing fees or for any revamp activity that ceases due to delisting.<br /><br />

          <strong>• You are solely responsible</strong> for ensuring that you have the authority and legal right to delist this asset. Delisting actions are final and irreversible once submitted to the blockchain.<br /><br />

          <strong>• Prohibited activity:</strong> You must not delist assets in violation of applicable laws or third-party rights.<br /><br />

          For full delisting policy, including requirements and supported asset types, please consult the platform documentation.
          <br /><br />
          <strong>Precautionary Notice:</strong> If you are uncertain, have doubts, or are not 100% sure about your participation, do not proceed. Only continue if you have conducted adequate research and fully understand the platform’s risks and mechanics.
        </p>
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
