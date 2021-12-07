/**
* @type import('hardhat/config').HardhatUserConfig
*/
require('dotenv/config');
require("@nomiclabs/hardhat-ethers");
require('hardhat-deploy');
require('hardhat-contract-sizer');
require('hardhat-deploy-ethers');

const { DEV_DEPLOYER_KEY, PROD_DEPLOYER_KEY } = process.env;

module.exports = {
  solidity: {
    version: "0.8.2",
    settings: {
      optimizer: {
        enabled: true
      }
    }
  },
  networks: {
    hardhat: {
      forking: {
        url: 'https://api.avax.network/ext/bc/C/rpc'
      },
      chainId: 43114 // mimick mainnet avax
    },
    fuji: {
      url: 'https://api.avax-test.network/ext/bc/C/rpc',
      chainId: 43113,
      accounts: [`0x${DEV_DEPLOYER_KEY}`]
    },
    mainnet: {
      url: 'https://api.avax.network/ext/bc/C/rpc',
      chainId: 43114,
      accounts: [`0x${PROD_DEPLOYER_KEY}`]
    }
  },
  namedAccounts: {
    deployer: 0
  }
}
