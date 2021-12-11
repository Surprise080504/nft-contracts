const RefinableNFTFactory = artifacts.require("RefinableNFTFactory");
const RefinableERC721Token = artifacts.require("RefinableERC721Token");
const RefinableERC1155Token = artifacts.require("RefinableERC1155Token");
const { soliditySha3 } = require("web3-utils");
const { account_private_keys } = require("../keys.json");

contract("RefinableNFTFactory", accounts => {
    let refinableERC721TokenContract, refinableERC1155TokenContract, contract;

    before(async function() {

        await RefinableERC721Token.new(
            "Refinable721",
            "REFI721",
            accounts[0], // admin
            accounts[1], // signer
            "https://api-testnet.refinable.co/contractMetadata/{address}",
            "https://ipfs.refinable.co",
            { from: accounts[0] }
        ).then(function (instance) {
            refinableERC721TokenContract = instance;
        });

        await RefinableERC1155Token.new(
            "Refinable1155",
            "REFI1155",
            accounts[1], // signer
            "https://api-testnet.refinable.co/contractMetadata/{address}", // contractURI
            "REFI_", // tokenURIPrefix
            "Refi__", // uri
            { from: accounts[0] }
        ).then(function (instance) {
            refinableERC1155TokenContract = instance;
        });

        await RefinableNFTFactory.new(
            refinableERC721TokenContract.address,
            refinableERC1155TokenContract.address,
            { from: accounts[0] }
        ).then(function (instance) {
            contract = instance;
        });
    });

    describe("bulk mint", () => {
        it("bulk mint is not working if caller is not the owner", async () => {
            const contractAddress = contract.address;
            const tokenIds = new Array(5).fill(0).map((_, index) => index + 1);
            let sigs = [];
            for(let i = 0; i < tokenIds.length; i++) {
                const contractAddressTokenIdSha = soliditySha3( // Equal to keccak256(abi.encodePacked(address(this), tokenId));
                    refinableERC721TokenContract.address,
                    tokenIds[i],
                    contractAddress
                );
                
                sigs.push(web3.eth.accounts.sign(contractAddressTokenIdSha, account_private_keys[1]).signature);
            }
            const fees = [[],[],[],[],[]];
            const tokenURIs = new Array(5).fill(0).map((_, index) =>`fakeTokenURI${ index + 1}`);

            let thrownError;

            try {
                await contract.bulk_mint_erc721_token(tokenIds, sigs, fees, tokenURIs, {from: accounts[1]});
            } catch (error) {
                thrownError = error;
            }
            assert.include(
                thrownError.message,
                'Ownable: caller is not the owner',
            )
        })
        it("bulk mint is not working with empty array", async () => {
            const contractAddress = contract.address;
            const tokenIds = [
            ]; // These are different token IDs
            let sigs = [];
            const fees = [];
            const tokenURIs = [
            ];

            let thrownError;

            try {
                await contract.bulk_mint_erc721_token(tokenIds, sigs, fees, tokenURIs, {from: accounts[0]});
            } catch (error) {
                thrownError = error;
            }
            assert.include(
                thrownError.message,
                'Empty array is provided',
            )
        })
        it("bulk mint is not working with too big array", async () => {
            const contractAddress = contract.address;
            const tokenIds = new Array(101).fill(0).map((_, index) => index + 1);
            let sigs = [];
            for(let i = 0; i < tokenIds.length; i++) {
                const contractAddressTokenIdSha = soliditySha3( // Equal to keccak256(abi.encodePacked(address(this), tokenId));
                    refinableERC721TokenContract.address,
                    tokenIds[i],
                    contractAddress
                );
                
                sigs.push(web3.eth.accounts.sign(contractAddressTokenIdSha, account_private_keys[1]).signature);
            }
            const fees = new Array(101).fill([]);
            const tokenURIs = new Array(101).fill(0).map((_, index) =>`fakeTokenURI${ index + 1}`);

            let thrownError;

            try {
                await contract.bulk_mint_erc721_token(tokenIds, sigs, fees, tokenURIs, {from: accounts[0]});
            } catch (error) {
                thrownError = error;
            }
            assert.include(
                thrownError.message,
                'Too big array is provided',
            )
        })
        it("bulk mint is working if sizes of array are not same", async () => {
            const contractAddress = contract.address;
            const tokenIds = new Array(6).fill(0).map((_, index) => index + 1);
            let sigs = [];
            for(let i = 0; i < tokenIds.length; i++) {
                const contractAddressTokenIdSha = soliditySha3( // Equal to keccak256(abi.encodePacked(address(this), tokenId));
                    refinableERC721TokenContract.address,
                    tokenIds[i],
                    contractAddress
                );
                
                sigs.push(web3.eth.accounts.sign(contractAddressTokenIdSha, account_private_keys[1]).signature);
            }
            const fees = [[],[],[],[],[]];
            const tokenURIs = new Array(5).fill(0).map((_, index) =>`fakeTokenURI${ index + 1}`);

            let thrownError;

            try {
                await contract.bulk_mint_erc721_token(tokenIds, sigs, fees, tokenURIs, {from: accounts[0]});
            } catch (error) {
                thrownError = error;
            }
            assert.include(
                thrownError.message,
                'Size of params are not same',
            )
        })
        it("bulk mint is working not working with invalid signature", async () => {
            const contractAddress = contract.address;
            const tokenIds = new Array(5).fill(0).map((_, index) => index + 1);
            let sigs = [];
            for(let i = 0; i < tokenIds.length; i++) {
                const contractAddressTokenIdSha = soliditySha3( // Equal to keccak256(abi.encodePacked(address(this), tokenId));
                    refinableERC721TokenContract.address,
                    tokenIds[i],
                    accounts[0]
                );
                
                sigs.push(web3.eth.accounts.sign(contractAddressTokenIdSha, account_private_keys[1]).signature);
            }
            const fees = [[],[],[],[],[]];
            const tokenURIs = new Array(5).fill(0).map((_, index) =>`fakeTokenURI${ index + 1}`);

            let thrownError;

            try {
                await contract.bulk_mint_erc721_token(tokenIds, sigs, fees, tokenURIs, {from: accounts[0]});
            } catch (error) {
                thrownError = error;
            }
            assert.include(
                thrownError.message,
                'invalid signer',
            )
        })
        it("bulk mint is not working with same token ids", async () => {
            const contractAddress = contract.address;
            const tokenIds = new Array(5).fill(0);
            let sigs = [];
            for(let i = 0; i < tokenIds.length; i++) {
                const contractAddressTokenIdSha = soliditySha3( // Equal to keccak256(abi.encodePacked(address(this), tokenId));
                    refinableERC721TokenContract.address,
                    tokenIds[i],
                    contractAddress
                );
                
                sigs.push(web3.eth.accounts.sign(contractAddressTokenIdSha, account_private_keys[1]).signature);
            }
            const fees = [[],[],[],[],[]];
            const tokenURIs = new Array(5).fill(0).map((_, index) =>`fakeTokenURI${ index + 1}`);

            let thrownError;

            try {
                await contract.bulk_mint_erc721_token(tokenIds, sigs, fees, tokenURIs, {from: accounts[0]});
            } catch (error) {
                thrownError = error;
            }
            assert.include(
                thrownError.message,
                'ERC721: token already minted',
            )
        })
        it("bulk mint is working", async () => {
            const contractAddress = contract.address;
            const tokenIds = new Array(5).fill(0).map((_, index) => index + 100);
            let sigs = [];
            for(let i = 0; i < tokenIds.length; i++) {
                const contractAddressTokenIdSha = soliditySha3( // Equal to keccak256(abi.encodePacked(address(this), tokenId));
                    refinableERC721TokenContract.address,
                    tokenIds[i],
                    contractAddress
                );
                
                sigs.push(web3.eth.accounts.sign(contractAddressTokenIdSha, account_private_keys[1]).signature);
            }
            const fees = [[],[],[],[],[]];
            const tokenURIs = new Array(5).fill(0).map((_, index) =>`fakeTokenURI${ index + 1}`);

            await contract.bulk_mint_erc721_token(tokenIds, sigs, fees, tokenURIs, {from: accounts[0]});

            for(let i = 0; i < tokenIds.length; i++) {
                assert.equal(await refinableERC721TokenContract.ownerOf(tokenIds[i]), accounts[0]);
            }
        })
    });
});
