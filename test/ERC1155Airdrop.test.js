const RefinableERC1155Token = artifacts.require("RefinableERC1155Token");
const ERC1155Airdrop = artifacts.require("ERC1155Airdrop");

const { soliditySha3, BN } = require("web3-utils");
const { account_private_keys } = require("../keys.json");

contract("ERC1155Airdrop", (accounts) => {
    var refinableerc1155token_contract;
    var airdrop_contract;
    const tokenId = "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174612"; // Randomly chosen

    before(async () => {
        await RefinableERC1155Token.new(
            "Refinable1155",
            "REFI1155",
            accounts[1], // signer
            "https://api-testnet.refinable.co/contractMetadata/{address}", // contractURI
            "REFI_", // tokenURIPrefix
            "Refi__", // uri
            { from: accounts[0] }
        ).then(function (instance) {
            refinableerc1155token_contract = instance;
        });

        await ERC1155Airdrop.new(
            refinableerc1155token_contract.address,
            { from: accounts[0] }
        ).then(function (instance) {
            airdrop_contract = instance;
        });

        await mint(accounts[1], tokenId, 5);
    });

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

    describe("Airdrop", () => {
        it("not working if owner have insufficient balance", async () => {
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
                    tokenId,
                    recipients,
                    {from : accounts[1]}
                );
            } catch (error) {
                thrownError = error;
            }
            assert.include(thrownError.message, "ERC1155Airdrop.airdrop: Caller does not have amount of tokens");
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
                    tokenId,
                    recipients,
                    {from : accounts[1]}
                );
            } catch (error) {
                thrownError = error;
            }
            assert.include(thrownError.message, "ERC1155Airdrop.airdrop: Owner has not approved");
        })
        it("Works fine with normal flow", async () => {
            await refinableerc1155token_contract.setApprovalForAll(
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
                tokenId,
                recipients,
                {from : accounts[1]}
            );

            assert.equal(
                await refinableerc1155token_contract.balanceOf(
                    accounts[1],
                    tokenId
                ),
                0
            );

            for(let i = 0; i < recipients.length; i++) {
                assert.equal(
                    await refinableerc1155token_contract.balanceOf(
                        recipients[i],
                        tokenId
                    ),
                    1
                );
            }
        });
    })
});
