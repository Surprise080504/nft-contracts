const RefinableToken = artifacts.require("RefinableERC721Token");
const secret = require("../secret.json");
const secretTestnet = require("../secret.testnet.json");

module.exports = function(deployer, network) {
  if (network == "mainnet") {
    deployer.deploy(
      RefinableToken,
      "Refinable721",
      "REFI721",
      secret.fromAddress,
      secret.signerAddress,
      "https://api.refinable.co/contractMetadata/{address}", // contractURI
      "https://ipfs.refinable.co" // uri // TODO: IPFS
    );
  } else {
    deployer.deploy(
      RefinableToken,
      "Refinable721",
      "REFI721",
      secretTestnet.fromAddress,
      secretTestnet.signerAddress,
      "https://api-testnet.refinable.co/contractMetadata/{address}", // contractURI
      "https://ipfs.refinable.co" // uri // TODO: IPFS
    );
  }
};
