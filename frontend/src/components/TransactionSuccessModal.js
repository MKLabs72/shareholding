import React from "react";
import { Modal, Button } from "react-bootstrap";

export default function TransactionSuccessModal({ isOpen, onClose, txHash, explorerBaseUrl }) {
  if (!isOpen) return null;

  const explorerLink = explorerBaseUrl
    ? `${explorerBaseUrl}/tx/${txHash}`
    : `https://etherscan.io/tx/${txHash}`;

  return (
    <Modal show={isOpen} onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title className="text-success">Transaction Confirmed!</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="small text-muted">Your deposit transaction was successful.</p>
        <p className="small text-primary">
          <strong>Tx Hash:</strong> {txHash}
        </p>
        <a href={explorerLink} target="_blank" rel="noopener noreferrer" className="small text-decoration-underline text-primary">
          View on Explorer
        </a>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="success" onClick={onClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
