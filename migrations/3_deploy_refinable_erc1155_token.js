const RefinableToken = artifacts.require("RefinableERC1155Token");
const secret = require("../secret.json");
const secretTestnet = require("../secret.testnet.json");

module.exports = function(deployer, network) {
  if (network == "mainnet") {
    deployer.deploy(
      RefinableToken,
      "Refinable1155",
      "REFI1155",
      secret.signerAddress,
      "https://api.refinable.co/contractMetadata/{address}", // contractURI
      "REFI_", // tokenURIPrefix
      "https://ipfs.refinable.co" // uri // TODO: IPFS
    );
  } else {
    deployer.deploy(
      RefinableToken,
      "Refinable1155",
      "REFI1155",
      secretTestnet.signerAddress,
      "https://api-testnet.refinable.co/contractMetadata/{address}", // contractURI
      "REFI_", // tokenURIPrefix
      "https://ipfs.refinable.co" // uri // TODO: IPFS
    );
  }
};
