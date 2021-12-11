const ERC721Auction = artifacts.require("ERC721Auction");
const RefinableERC721Token = artifacts.require("RefinableERC721Token");
const ServiceFeeProxy = artifacts.require("ServiceFeeProxy");

module.exports = async function (deployer) {

    await deployer.deploy(
        ERC721Auction,
        RefinableERC721Token.address,
        ServiceFeeProxy.address,
    );

    return;
};
