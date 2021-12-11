const ServiceFee = artifacts.require("ServiceFee");

module.exports = async function (deployer) {
    await deployer.deploy(
        ServiceFee,
    );
};
