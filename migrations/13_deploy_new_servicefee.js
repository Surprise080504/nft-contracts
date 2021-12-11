const ServiceFee = artifacts.require("ServiceFee");
const ServiceFeeProxy = artifacts.require("ServiceFeeProxy");
const RefinableToken = artifacts.require("RefinableToken");

const secret = require("../secret.json");
const secretTestnet = require("../secret.testnet.json");

module.exports = async function (deployer, network) {
    await deployer.deploy(
        ServiceFee,
    );

    ServiceFeeInstance = await ServiceFee.deployed();

    if (network == "mainnet") {
        serviceFeeProxyInstance = await ServiceFeeProxy.deployed();

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
        serviceFeeProxyInstance = await ServiceFeeProxy.deployed();
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
