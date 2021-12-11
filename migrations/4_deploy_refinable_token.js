const RefinableToken = artifacts.require("RefinableToken");

module.exports = function(deployer, network) {
  if (network != "mainnet") {
    deployer.deploy(
        RefinableToken,
    );
  }
};
