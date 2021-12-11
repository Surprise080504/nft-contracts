const ERC721Airdrop = artifacts.require("ERC721Airdrop");
const RefinableERC721Token = artifacts.require("RefinableERC721Token");
const { soliditySha3 } = require("web3-utils");
const { account_private_keys, account_addresses } = require("../keys.json");

module.exports = async function (deployer, network) {
    await deployer.deploy(
        RefinableERC721Token,
        "Refinable721",
        "REFI721",
        account_addresses[0], // admin
        account_addresses[1], // signer
        "https://api-testnet.refinable.co/contractMetadata/{address}",
        "https://ipfs.refinable.co",
    );

    var refinableerc721token_contract =  await RefinableERC721Token.deployed();
    
    await deployer.deploy(
        ERC721Airdrop,
        refinableerc721token_contract.address,
    );
    var airdrop_contract =  await ERC721Airdrop.deployed();
    
    const tokenIds = [
        "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174612",
        "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174613",
        "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174614",
        "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174615",
        "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174616",
    ];

    const mint = async (minter, tokenId, fees = []) => {
        const contractAddressTokenIdSha = soliditySha3(
            refinableerc721token_contract.address,
            tokenId,
            minter
        );
        //sign we do in the backend.
        const mintSignature = web3.eth.accounts.sign(
            contractAddressTokenIdSha,
            account_private_keys[1]
        );

        const tokenURI = "fakeTokenURI";
        await refinableerc721token_contract.mint(
            tokenId,
            mintSignature.signature,
            fees,
            tokenURI,
            { from: minter }
        );
    };

    for(let i = 0; i < tokenIds.length; i++) {
        await mint(account_addresses[1], tokenIds[i]);
    }

    await refinableerc721token_contract.setApprovalForAll(
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
        tokenIds,
        recipients,
        {from : account_addresses[1]}
    );

    return;
};


