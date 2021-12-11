const ERC721Airdrop = artifacts.require("ERC721Airdrop");
const RefinableERC721Token = artifacts.require("RefinableERC721Token");

module.exports = async function (deployer, network) {
  await deployer.deploy(ERC721Airdrop, RefinableERC721Token.address);

  return;
};
