const TransferProxy = artifacts.require("TransferProxy");

module.exports = async function(deployer) {
  await deployer.deploy(TransferProxy);
  return;
};
