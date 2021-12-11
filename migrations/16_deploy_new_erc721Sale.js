const ERC721Sale = artifacts.require("ERC721Sale");
const TransferProxy = artifacts.require("TransferProxy");
const ServiceFeeProxy = artifacts.require("ServiceFeeProxy");
const ERC721SaleNonceHolder = artifacts.require("ERC721SaleNonceHolder");

module.exports = async function (deployer) {
    await deployer.deploy(
        ERC721Sale,
        TransferProxy.address,
        ERC721SaleNonceHolder.address,
        ServiceFeeProxy.address,
    );

    transferProxyInstance = await TransferProxy.deployed();
    eRC721SaleNonceHolderInstance = await ERC721SaleNonceHolder.deployed();

    await transferProxyInstance.addOperator(ERC721Sale.address);
    await eRC721SaleNonceHolderInstance.addOperator(ERC721Sale.address);

    return;
};
