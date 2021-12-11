const ServiceFeeProxy = artifacts.require("ServiceFeeProxy");
const ServiceFee = artifacts.require("ServiceFee");
const RefinableToken = artifacts.require("RefinableToken");

const secret = require("../secret.json");
const secretTestnet = require("../secret.testnet.json");

module.exports = async function (deployer, network) {
    await deployer.deploy(ServiceFeeProxy);

    serviceFeeProxyInstance = await ServiceFeeProxy.deployed();
    ServiceFeeInstance = await ServiceFee.deployed();

    if (network == "mainnet") {
        await ServiceFeeInstance.addProxy(serviceFeeProxyInstance.address, {
            from: secret.fromAddress,
        });
        await serviceFeeProxyInstance.setServiceFeeContract(
            ServiceFeeInstance.address,
            { from: secret.fromAddress }
        );
        await serviceFeeProxyInstance.setServiceFeeRecipient(
            secret.serviceFeeRecipientAddress,
            { from: secret.fromAddress }
        );
        await ServiceFeeInstance.setRefinableTokenContract(
            secret.refinableTokenAddress,
            { from: secret.fromAddress }
        );
    } else {
        refinableTokenInstance = await RefinableToken.deployed();

        await ServiceFeeInstance.addProxy(serviceFeeProxyInstance.address, {
            from: secretTestnet.fromAddress,
        });
        await serviceFeeProxyInstance.setServiceFeeContract(
            ServiceFeeInstance.address,
            { from: secretTestnet.fromAddress }
        );
        await serviceFeeProxyInstance.setServiceFeeRecipient(
            secretTestnet.serviceFeeRecipientAddress,
            { from: secretTestnet.fromAddress }
        );

        await ServiceFeeInstance.setRefinableTokenContract(
            refinableTokenInstance.address,
            { from: secretTestnet.fromAddress }
        );
    }
};
