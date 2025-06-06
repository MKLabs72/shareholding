// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import App from './App';

// ← Correct import for ethers‑5 React SDK:
import { createWeb3Modal, defaultConfig } from '@web3modal/ethers/react';

// 1) Your WalletConnect Cloud project ID
const projectId = 'YOUR_REOWN-PROJECT_ID';

// 2) Chains you support
const polygonMainnet = {
  chainId: 137,
  name: 'Polygon',
  currency: 'POL',
  explorerUrl: 'https://polygonscan.com',
  rpcUrl: 'https://polygon-mainnet.infura.io/v3/YOUR_INFURA_ID'
};
const bscMainnet = {
  chainId: 56,
  name: 'Binance Smart Chain',
  currency: 'BNB',
  explorerUrl: 'https://bscscan.com',
  rpcUrl: 'https://bsc-dataseed.binance.org/'
};
const arbMainnet = {
  chainId: 42161,
  name: 'Arbitrum',
  currency: 'ETH',
  explorerUrl: 'https://arbiscan.io/',
  rpcUrl: 'https://arb1.arbitrum.io/rpc/'
};
const optMainnet = {
  chainId: 10,
  name: 'Optimism',
  currency: 'ETH',
  explorerUrl: 'https://optimistic.etherscan.io',
  rpcUrl: 'https://mainnet.optimism.io/'
};
const baseMainnet = {
  chainId: 8453,
  name: 'Base',
  currency: 'ETH',
  explorerUrl: "https://basescan.org",
  rpcUrl: "https://mainnet.base.org"
};
const ethMainnet = {
  chainId: 1,
  name: 'Ethereum',
  currency: 'ETH',
  explorerUrl: "https://etherscan.io",
  rpcUrl: "https://mainnet.infura.io/v3/YOUR_INFURA_ID"
};

const selectedChains = [polygonMainnet];

// 3) Your dapp metadata
const metadata = {
  name: 'RVNWL',
  description: 'The Liquidity Renewal Movement',
  url: 'https://rvnwl.com'
};

// 4) Initialize Web3Modal once (side‑effect)
createWeb3Modal({
  projectId,
  chains: selectedChains,
  ethersConfig: defaultConfig({
    metadata,
    enableEmail: false,
    enableEIP6963: true,
  }),
  themeMode: 'light',
  themeVariables: { '--w3m-accent': '#0b4182' },
  enableOnramp: true,
  enableAnalytics: true,
});

// 5) Render your app normally
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <DndProvider backend={HTML5Backend}>
      <App />
    </DndProvider>
  </React.StrictMode>
);
