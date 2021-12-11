const RefinableERC721Token = artifacts.require("RefinableERC721Token");
const ERC721Airdrop = artifacts.require("ERC721Airdrop");

const { soliditySha3, BN } = require("web3-utils");
const { account_private_keys } = require("../keys.json");

contract("ERC721Airdrop", (accounts) => {
    var refinableerc721token_contract;
    var airdrop_contract;
    const tokenIds = [
        "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174612",
        "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174613",
        "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174614",
        "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174615",
        "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174616",
    ];

    before(async () => {
        await RefinableERC721Token.new(
            "Refinable721",
            "REFI721",
            accounts[0], // admin
            accounts[1], // signer
            "https://api-testnet.refinable.co/contractMetadata/{address}",
            "https://ipfs.refinable.co",
            { from: accounts[0] }
        ).then((instance) => {
            refinableerc721token_contract = instance;
        });

        await ERC721Airdrop.new(
            refinableerc721token_contract.address,
            { from: accounts[0] }
        ).then(function (instance) {
            airdrop_contract = instance;
        });

        for(let i = 0; i < tokenIds.length; i++) {
            await mint(accounts[1], tokenIds[i]);
        }

        await mint(accounts[0], "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174617");
    });

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

    describe("Airdrop", () => {
        it("not working if count of recipient and token ids are not same", async () => {
            const recipients = [
                accounts[2],
                accounts[3],
                accounts[4],
                accounts[5],
                accounts[6],
                accounts[7],
            ];

            let thrownError;
            try {
                await airdrop_contract.airdrop(
                    tokenIds,
                    recipients,
                    {from : accounts[1]}
                );
            } catch (error) {
                thrownError = error;
            }
            assert.include(thrownError.message, "ERC721Airdrop.airdrop: Count of recipients should be same as count of token ids");
        })
        it("not working if caller is not the owner", async () => {
            const recipients = [
                accounts[2],
                accounts[3],
                accounts[4],
                accounts[5],
                accounts[6],
                accounts[7],
            ];

            let thrownError;
            try {
                await airdrop_contract.airdrop(
                    [...tokenIds, "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174617"],
                    recipients,
                    {from : accounts[1]}
                );
            } catch (error) {
                thrownError = error;
            }
            assert.include(thrownError.message, "ERC721Airdrop.airdrop: Caller is not the owner");
        })
        it("not working without owner approval", async () => {
            const recipients = [
                accounts[2],
                accounts[3],
                accounts[4],
                accounts[5],
                accounts[6],
            ];

            let thrownError;
            try {
                await airdrop_contract.airdrop(
                    tokenIds,
                    recipients,
                    {from : accounts[1]}
                );
            } catch (error) {
                thrownError = error;
            }
            assert.include(thrownError.message, "ERC721Airdrop.airdrop: Owner has not approved");
        })
        
        it("Works fine with normal flow", async () => {
            await refinableerc721token_contract.setApprovalForAll(
                airdrop_contract.address,
                true,
                { from: accounts[1] }
            );

            const recipients = [
                accounts[2],
                accounts[3],
                accounts[4],
                accounts[5],
                accounts[6],
            ];

            await airdrop_contract.airdrop(
                tokenIds,
                recipients,
                {from : accounts[1]}
            );

            for(let i = 0; i < recipients.length; i++) {
                assert.equal(
                    await refinableerc721token_contract.ownerOf(
                        tokenIds[i]
                    ),
                    recipients[i]
                );
            }
        });
    })
});
