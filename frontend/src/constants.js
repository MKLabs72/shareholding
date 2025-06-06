// src/constants.js

import polygonIcon  from "./assets/polygon.png";
import bscIcon      from "./assets/bsc.png";
import arbIcon      from "./assets/arbitrum.png";
import optIcon      from "./assets/optimism.png";
import ethIcon     from "./assets/ethereum.png";
import baseIcon     from "./assets/base.png";


export const DEFI_ADDRESSES = {
  56: "RevampContractAddress",    // BSC Mainnet
  137: "RevampContractAddress",  // Polygon Mainnet
  1: "RevampContractAddress",     // Ethereum Mainnet
  8453: "RevampContractAddress",   // Base Mainnet
  42161: "RevampContractAddress",  // Arbitrum One
  10: "RevampContractAddress"      // Optimism Mainnet
};

export const SHAREHOLDING_ADDRESSES = {
  56: "ShareholdingContractAddress",    // BSC Mainnet
  137: "ShareholdingContractAddress",  // Polygon Mainnet
  1: "ShareholdingContractAddress",     // Ethereum Mainnet
  8453: "ShareholdingContractAddress",   // Base Mainnet
  42161: "ShareholdingContractAddress",  // Arbitrum One
  10: "ShareholdingContractAddress"      // Optimism Mainnet
};

export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
];

export const AVAILABLE_NETWORKS = [
  {
    label: "BSC Mainnet",
    chainId: 56,
    currency: "BNB",
    explorerUrl: "https://bscscan.com",
    rpcUrl: "https://bsc-dataseed.binance.org/",
    icon: bscIcon,
  },
  {
    label: "Polygon Mainnet",
    chainId: 137,
    currency: "POL",
    explorerUrl: "https://polygonscan.com",
    rpcUrl: "https://polygon-rpc.com",
    icon: polygonIcon,
  },
  {
    label: "Ethereum Mainnet",
    chainId: 1,
    currency: "ETH",
    explorerUrl: "https://etherscan.io",
    rpcUrl: "https://mainnet.infura.io/v3/YOUR_INFURA_ID",
    icon: ethIcon,
  },
  {
    label: "Base Mainnet",
    chainId: 8453,
    currency: "ETH",
    explorerUrl: "https://basescan.org",
    rpcUrl: "https://mainnet.base.org",
    icon: baseIcon,
  },
  {
    label: "Arbitrum One",
    chainId: 42161,
    currency: "ETH",
    explorerUrl: "https://arbiscan.io",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    icon: arbIcon,
  },
  {
    label: "Optimism Mainnet",
    chainId: 10,
    currency: "ETH",
    explorerUrl: "https://optimistic.etherscan.io",
    rpcUrl: "https://mainnet.optimism.io",
    icon: optIcon,
  }
];
