const ERC1155Airdrop = artifacts.require("ERC1155Airdrop");
const RefinableERC1155Token = artifacts.require("RefinableERC1155Token");

module.exports = async function (deployer) {
  await deployer.deploy(ERC1155Airdrop, RefinableERC1155Token.address);

  return;
};
