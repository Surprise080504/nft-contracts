const ERC1155Airdrop = artifacts.require("ERC1155Airdrop");
const RefinableERC1155Token = artifacts.require("RefinableERC1155Token");
const { soliditySha3 } = require("web3-utils");
const { account_private_keys, account_addresses } = require("../keys.json");

module.exports = async function (deployer, network) {
    await deployer.deploy(
        RefinableERC1155Token,
        "Refinable1155AirDrop",
        "REFI1155AD",
        account_addresses[1],
        "https://api.refinable.co/contractMetadata/{address}", // contractURI
        "REFI_", // tokenURIPrefix
        "https://ipfs.refinable.co" // uri // TODO: IPFS
    );

    var refinableerc1155token_contract =  await RefinableERC1155Token.deployed();
    
    await deployer.deploy(
        ERC1155Airdrop,
        refinableerc1155token_contract.address,
    );
    var airdrop_contract =  await ERC1155Airdrop.deployed();
    
    const tokenId = "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174612";

    const mint = async (minter, tokenId, supply = 1, fees = []) => {
        const contractAddressTokenIdSha = soliditySha3(
            refinableerc1155token_contract.address,
            tokenId,
            minter
        );
        // sign we do in the backend.
        const mintSignature = web3.eth.accounts.sign(
            contractAddressTokenIdSha,
            account_private_keys[1]
        );
        const tokenURI = "fakeTokenURI";
        await refinableerc1155token_contract.mint(
            tokenId,
            mintSignature.signature,
            fees,
            supply,
            tokenURI,
            { from: minter }
        );
    };

    await mint(account_addresses[1], tokenId, 5);

    await refinableerc1155token_contract.setApprovalForAll(
        airdrop_contract.address,
        true,
        { from: account_addresses[1] }
    );

    const recipients = [
        account_addresses[5],
        account_addresses[6],
        account_addresses[7],
        account_addresses[8],
        account_addresses[9],
    ];

    await airdrop_contract.airdrop(
        tokenId,
        recipients,
        {from : account_addresses[1]}
    );

    return;
};


