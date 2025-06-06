// components/ConnectButton.jsx
export default function ConnectButton({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="btn btn-primary"
    >
      {children || "Connect Wallet"}
    </button>
  )
}
