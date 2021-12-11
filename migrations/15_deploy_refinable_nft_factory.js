const RefinableNFTFactory = artifacts.require("RefinableNFTFactory");
const RefinableERC721Token = artifacts.require("RefinableERC721Token");
const RefinableERC1155Token = artifacts.require("RefinableERC1155Token");
const secret = require("../secret.json");

module.exports = function (deployer, network) {
    if (network == "mainnet") {
        deployer.deploy(
            RefinableNFTFactory,
            secret.refinableERC721TokenAddress,
            secret.refinableERC1155TokenAddress,
        );
    } else {
        deployer.deploy(
            RefinableNFTFactory,
            RefinableERC721Token.address,
            RefinableERC1155Token.address,
        );
    }
};
