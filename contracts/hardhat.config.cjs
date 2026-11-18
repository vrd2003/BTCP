require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();

const accounts = process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [];

module.exports = {
  solidity: {
    version: '0.8.24',
    settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true }
  },
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || '',
      chainId: 11155111,
      accounts
    }
  }
};
