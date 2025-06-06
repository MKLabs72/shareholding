import React from "react";
import { Modal, Button } from "react-bootstrap";

export default function TandCModal({ onClose, onAgree }) {
  return (
    <Modal
      show
      onHide={onClose}
      centered
      dialogClassName="tandc-modal"          /* ⬅️  gives us a z-index hook */
      backdropClassName="tandc-backdrop"     /* ⬅️  custom darker overlay   */
    >
      <Modal.Header closeButton>
        <Modal.Title>Terms & Conditions</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <p className="small mb-0">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed tristique
          nunc non suscipit fermentum, nunc odio ullamcorper turpis, et laoreet
          massa lorem non purus.
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
