const ERC1155Sale = artifacts.require("ERC1155Sale");
const TransferProxy = artifacts.require("TransferProxy");
const ERC1155SaleNonceHolder = artifacts.require("ERC1155SaleNonceHolder");
const ServiceFeeProxy = artifacts.require("ServiceFeeProxy");

module.exports = async function (deployer) {
    await deployer.deploy(ERC1155SaleNonceHolder);

    await deployer.deploy(
        ERC1155Sale,
        TransferProxy.address,
        ERC1155SaleNonceHolder.address,
        ServiceFeeProxy.address,
    );

    transferProxyInstance = await TransferProxy.deployed();
    eRC1155SaleNonceHolderInstance = await ERC1155SaleNonceHolder.deployed();

    await transferProxyInstance.addOperator(ERC1155Sale.address);
    await eRC1155SaleNonceHolderInstance.addOperator(ERC1155Sale.address);

    return;
};
