const ERC1155Auction = artifacts.require("ERC1155Auction");
const RefinableERC1155Token = artifacts.require("RefinableERC1155Token");
const ServiceFeeProxy = artifacts.require("ServiceFeeProxy");

module.exports = async function (deployer) {

    await deployer.deploy(
        ERC1155Auction,
        RefinableERC1155Token.address,
        ServiceFeeProxy.address,
    );

    return;
};
