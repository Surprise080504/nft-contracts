const RefinableERC1155Token = artifacts.require("RefinableERC1155Token");
const RefinableToken = artifacts.require("RefinableToken");
const ERC1155Sale = artifacts.require("ERC1155Sale");
const TransferProxy = artifacts.require("TransferProxy");
const ServiceFeeProxy = artifacts.require("ServiceFeeProxy");
const ServiceFee = artifacts.require("ServiceFee");
const ERC1155SaleNonceHolder = artifacts.require("ERC1155SaleNonceHolder");

const { soliditySha3, BN } = require("web3-utils");
const { account_private_keys } = require("../keys.json");

function getUnixEpochTimeStamp(value) {
    return Math.floor(value.getTime() / 1000);
}

contract("ERC1155Sale", (accounts) => {
    var refinableerc1155token_contract;
    var transferproxy_contract;
    var servicefee_contract;
    var servicefeeproxy_contract;
    var salenonceholder_contract;
    var sale_contract;
    var refinabletoken_contract;

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
        
        await RefinableToken.new({ from: accounts[1] }).then(function (instance) {
            refinabletoken_contract = instance;
        });

        await TransferProxy.new({ from: accounts[1] }).then(function (instance) {
            transferproxy_contract = instance;
        });

        await ServiceFee.new({ from: accounts[1] }).then(function (instance) {
            servicefee_contract = instance;
        });

        await ServiceFeeProxy.new({ from: accounts[1] }).then(function (instance) {
            servicefeeproxy_contract = instance;
        });

        await servicefee_contract.addProxy(servicefeeproxy_contract.address, { from: accounts[1] })
        await servicefeeproxy_contract.setServiceFeeContract(servicefee_contract.address, { from: accounts[1] })
        await servicefeeproxy_contract.setServiceFeeRecipient(accounts[5], { from: accounts[1] })
        await servicefee_contract.setRefinableTokenContract(refinabletoken_contract.address, { from: accounts[1] })

        await ERC1155SaleNonceHolder.new({ from: accounts[1] }).then(function (
            instance
        ) {
            salenonceholder_contract = instance;
        });

        await ERC1155Sale.new(
            transferproxy_contract.address,
            salenonceholder_contract.address,
            servicefeeproxy_contract.address,
            { from: accounts[1] }
        ).then(function (instance) {
            sale_contract = instance;
        });

        // The admin of sale_contract set in OperatorRole of TransferProxy
        // Has to add the sale contract as an operator because the sale contract calls erc721safeTransferFrom on TransferProxy
        await transferproxy_contract.addOperator(sale_contract.address, {
            from: accounts[1],
        });
        await salenonceholder_contract.addOperator(sale_contract.address, {
            from: accounts[1],
        });
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

    describe("buy", () => {
        it("works and costs something (minter:6)", async () => {
            const tokenId =
                "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174612"; // Randomly chosen
            await mint(accounts[6], tokenId);

            // The owner of the token has to approve the transferproxy for sale once
            await refinableerc1155token_contract.setApprovalForAll(
                transferproxy_contract.address,
                true,
                { from: accounts[6] }
            );

            const messageValue = new BN('1025000000000000000');
            const nonce = await salenonceholder_contract.getNonce(
                refinableerc1155token_contract.address,
                tokenId,
                accounts[6]
            );

            const saleContractBuySignature = soliditySha3(
                refinableerc1155token_contract.address, // token
                tokenId, // tokenId
                new BN('1000000000000000000').toString(), // price
                1, // sellingAmount #
                nonce // nonce
            );
            const saleApprovalSignature = web3.eth.accounts.sign(
                saleContractBuySignature,
                account_private_keys[6],
            );

            await sale_contract.setApprovedSaleDate(refinableerc1155token_contract.address, tokenId, getUnixEpochTimeStamp(new Date('2021-03-31')), { from: accounts[6] })
            let saleInfo = await sale_contract.getSaleInfo(accounts[6], tokenId, { from: accounts[9] });
            assert.equal(saleInfo.approvedSaleDate, getUnixEpochTimeStamp(new Date('2021-03-31')));

            const buyerBalanceBeforeSale = new BN(await web3.eth.getBalance(accounts[7]));
            const sellerBalanceBeforeSale = new BN(await web3.eth.getBalance(accounts[6]));
            const serviceFeeRecipientBeforeBalance = new BN(await web3.eth.getBalance(accounts[5]));

            await sale_contract.buy(
                refinableerc1155token_contract.address, //IERC1155 token,
                tokenId, //uint256 tokenId HAS TO BE THE PASSED TOKEN ID OF A MINTED TOKEN (RefinableERC1155Token)
                accounts[6], //address payable owner, the owner of the token from who we are buyingAmount the token from
                1, // sellingAmount
                1, // buyingAmount
                saleApprovalSignature.signature, //signature
                { from: accounts[7], value: messageValue.toString() }
            );

            // Owner changed
            const ownedAmount = await refinableerc1155token_contract.balanceOf(
                accounts[7],
                tokenId
            );
            assert.equal(1, ownedAmount);

            const buyerServiceFeeBps = new BN(await servicefeeproxy_contract.getBuyServiceFeeBps(accounts[7], { from: accounts[1] }))
            const sellerServiceFeeBps = new BN(await servicefeeproxy_contract.getSellServiceFeeBps(accounts[6], { from: accounts[1] }))
            const tokenPrice = messageValue.mul(new BN('10000')).div(buyerServiceFeeBps.add(new BN('10000')));
            const buyerServiceFee = messageValue.sub(tokenPrice);
            const sellerServiceFee = new BN('' + tokenPrice).mul(sellerServiceFeeBps).div(new BN('10000'));
            let ownerValue = new BN('' + tokenPrice).sub(sellerServiceFee);

            // Payment was transfered
            const buyerBalance = new BN(await web3.eth.getBalance(accounts[7]));
            const sellerBalance = new BN(await web3.eth.getBalance(accounts[6]));
            const servieFeeRecipientBalance = new BN(await web3.eth.getBalance(accounts[5]));

            const buyerLostBalance = buyerBalanceBeforeSale.sub(buyerBalance);
            const sellerGainedBalance = sellerBalance.sub(sellerBalanceBeforeSale);
            const serviceFeeRecipientGainedBalance = servieFeeRecipientBalance.sub(serviceFeeRecipientBeforeBalance);

            assert.equal(buyerLostBalance.cmp(messageValue), 1);
            assert.equal(sellerGainedBalance.toString(), new BN('975000000000000000').toString())
            assert.equal(serviceFeeRecipientGainedBalance.toString(), new BN('50000000000000000').toString());
        });

        it("fails when buying for another value (minter:6)", async () => {
            const tokenId =
                "0x111122229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174612"; // Randomly chosen
            await mint(accounts[6], tokenId);

            // The owner of the token has to approve the transferproxy for sale == settings something on sale
            await refinableerc1155token_contract.setApprovalForAll(
                transferproxy_contract.address,
                true,
                { from: accounts[6] }
            );

            const messageValue = new BN('1025000000000000000');
            const nonce = await salenonceholder_contract.getNonce(
                refinableerc1155token_contract.address,
                tokenId,
                accounts[6]
            );

            const saleContractBuySignature = soliditySha3(
                refinableerc1155token_contract.address, // token
                tokenId, // tokenId
                messageValue.toString(), // price
                1, // sellingAmount #
                nonce // nonce
            );
            const saleApprovalSignature = web3.eth.accounts.sign(
                saleContractBuySignature,
                account_private_keys[6],
            );

            const tooLowValue = messageValue.div(new BN('2'));
            let thrownError;

            await sale_contract.setApprovedSaleDate(refinableerc1155token_contract.address, tokenId, getUnixEpochTimeStamp(new Date('2021-03-31')), { from: accounts[6] })

            try {
                await sale_contract.buy(
                    refinableerc1155token_contract.address, //IERC1155 token,
                    tokenId, //uint256 tokenId HAS TO BE THE PASSED TOKEN ID OF A MINTED TOKEN (RefinableERC1155Token)
                    accounts[6], //address payable owner, the owner of the token from who we are buyingAmount the token from
                    1, // sellingAmount
                    1, // buyingAmount
                    saleApprovalSignature.signature, //signature
                    { from: accounts[7], value: tooLowValue }
                );
            } catch (error) {
                thrownError = error;
            }
            assert.include(thrownError.message, "ERC1155Sale.verifySignature: Incorrect signature");
        });

        it("fails without minted token owner approval (minter:3)", async () => {
            const tokenId = "0x333322229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174612"; // Randomly chosen
            await mint(accounts[3], tokenId);

            // The owner of the token has to approve the transferproxy for sale == settings something on sale
            // DISABLED TO TEST --> await mintabletoken_contract.setApprovalForAll(transferproxy_contract.address, true, {from: accounts[3]});

            const messageValue = new BN('1025000000000000000');
            const nonce = await salenonceholder_contract.getNonce(refinableerc1155token_contract.address, tokenId, accounts[3]);

            const saleContractBuySignature = soliditySha3(
                refinableerc1155token_contract.address, // token
                tokenId, // tokenId
                new BN('1000000000000000000').toString(), // price
                1, // sellingAmount #
                nonce, // nonce
            );
            const saleApprovalSignature = web3.eth.accounts.sign(saleContractBuySignature, account_private_keys[3]);

            await sale_contract.setApprovedSaleDate(refinableerc1155token_contract.address, tokenId, getUnixEpochTimeStamp(new Date('2021-03-31')), { from: accounts[3] })

            let thrownError;
            try {
                await sale_contract.buy(
                    refinableerc1155token_contract.address, //IERC1155 token,
                    tokenId, //uint256 tokenId HAS TO BE THE PASSED TOKEN ID OF A MINTED TOKEN (RefinableERC1155Token)
                    accounts[3], //address payable owner, the owner of the token from who we are buyingAmount the token from
                    1, // sellingAmount
                    1, // buyingAmount
                    saleApprovalSignature.signature, //signaure
                    { from: accounts[7], value: messageValue.toString() }
                );
            } catch (error) {
                thrownError = error;
            }

            const ownedAmount = await refinableerc1155token_contract.balanceOf(accounts[7], tokenId);
            assert.equal(0, ownedAmount);

            assert.include(
                thrownError.message,
                'ERC1155: caller is not owner nor approved',
            )
        });
        it("does not work if prev owner try to approve", async () => {
            const tokenId =
                "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174699"; // Randomly chosen
            await mint(accounts[6], tokenId);

            // The owner of the token has to approve the transferproxy for sale once
            await refinableerc1155token_contract.setApprovalForAll(
                transferproxy_contract.address,
                true,
                { from: accounts[6] }
            );

            let messageValue = new BN('1025000000000000000');
            let nonce = await salenonceholder_contract.getNonce(
                refinableerc1155token_contract.address,
                tokenId,
                accounts[6]
            );

            let saleContractBuySignature = soliditySha3(
                refinableerc1155token_contract.address, // token
                tokenId, // tokenId
                new BN('1000000000000000000').toString(), // price
                1, // sellingAmount #
                nonce // nonce
            );
            let saleApprovalSignature = web3.eth.accounts.sign(
                saleContractBuySignature,
                account_private_keys[6],
            );

            await sale_contract.setApprovedSaleDate(refinableerc1155token_contract.address, tokenId, getUnixEpochTimeStamp(new Date('2021-03-31')), { from: accounts[6] })

            await sale_contract.buy(
                refinableerc1155token_contract.address, //IERC1155 token,
                tokenId, //uint256 tokenId HAS TO BE THE PASSED TOKEN ID OF A MINTED TOKEN (RefinableERC1155Token)
                accounts[6], //address payable owner, the owner of the token from who we are buyingAmount the token from
                1, // sellingAmount
                1, // buyingAmount
                saleApprovalSignature.signature, //signature
                { from: accounts[7], value: messageValue.toString() }
            );

            // Owner changed
            let ownedAmount = await refinableerc1155token_contract.balanceOf(
                accounts[7],
                tokenId
            );
            assert.equal(1, ownedAmount);

            await refinableerc1155token_contract.setApprovalForAll(
                transferproxy_contract.address,
                true,
                { from: accounts[6] }
            );

            messageValue = new BN('1025000000000000000');
            nonce = await salenonceholder_contract.getNonce(
                refinableerc1155token_contract.address,
                tokenId,
                accounts[6]
            );

            saleContractBuySignature = soliditySha3(
                refinableerc1155token_contract.address, // token
                tokenId, // tokenId
                messageValue.toString(), // price
                1, // sellingAmount #
                nonce // nonce
            );

            saleApprovalSignature = web3.eth.accounts.sign(
                saleContractBuySignature,
                account_private_keys[6],
            );

            try {
                await sale_contract.setApprovedSaleDate(refinableerc1155token_contract.address, tokenId, getUnixEpochTimeStamp(new Date('2021-03-31')), { from: accounts[6] })
            } catch (error) {
                thrownError = error;
            }
            assert.include(thrownError.message, "ERC1155Sale.setApprovedSaleDate: Caller doesn't have tokens");
        });

        it("can't buy token again once it was bought.", async () => {
            const tokenId =
                "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174688"; // Randomly chosen
            await mint(accounts[6], tokenId);

            // The owner of the token has to approve the transferproxy for sale once
            await refinableerc1155token_contract.setApprovalForAll(
                transferproxy_contract.address,
                true,
                { from: accounts[6] }
            );

            let messageValue = new BN('1025000000000000000');
            let nonce = await salenonceholder_contract.getNonce(
                refinableerc1155token_contract.address,
                tokenId,
                accounts[6]
            );

            let saleContractBuySignature = soliditySha3(
                refinableerc1155token_contract.address, // token
                tokenId, // tokenId
                new BN('1000000000000000000').toString(), // price
                1, // sellingAmount #
                nonce // nonce
            );
            let saleApprovalSignature = web3.eth.accounts.sign(
                saleContractBuySignature,
                account_private_keys[6],
            );

            await sale_contract.setApprovedSaleDate(refinableerc1155token_contract.address, tokenId, getUnixEpochTimeStamp(new Date('2021-03-31')), { from: accounts[6] })

            await sale_contract.buy(
                refinableerc1155token_contract.address, //IERC1155 token,
                tokenId, //uint256 tokenId HAS TO BE THE PASSED TOKEN ID OF A MINTED TOKEN (RefinableERC1155Token)
                accounts[6], //address payable owner, the owner of the token from who we are buyingAmount the token from
                1, // sellingAmount
                1, // buyingAmount
                saleApprovalSignature.signature, //signature
                { from: accounts[7], value: messageValue.toString() }
            );

            // Owner changed
            let ownedAmount = await refinableerc1155token_contract.balanceOf(
                accounts[7],
                tokenId
            );
            assert.equal(1, ownedAmount);

            try {
                await sale_contract.buy(
                    refinableerc1155token_contract.address, //IERC1155 token,
                    tokenId, //uint256 tokenId HAS TO BE THE PASSED TOKEN ID OF A MINTED TOKEN (RefinableERC1155Token)
                    accounts[6], //address payable owner, the owner of the token from who we are buyingAmount the token from
                    1, // sellingAmount
                    1, // buyingAmount
                    saleApprovalSignature.signature, //signature
                    { from: accounts[8], value: messageValue.toString() }
                );
            } catch (error) {
                thrownError = error;
            }
            assert.include(thrownError.message, "ERC1155Sale.verifySignature: Incorrect signature");
        });
    });

    describe("buy with multiple supply", () => {
        it("works and costs something (minter:6)", async () => {
            const tokenId =
                "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174613"; // Randomly chosen
            const buyingAmount = 50;
            const sellingAmount = 100;
            await mint(accounts[6], tokenId, 100);

            // The owner of the token has to approve the transferproxy for sale once
            await refinableerc1155token_contract.setApprovalForAll(
                transferproxy_contract.address,
                true,
                { from: accounts[6] }
            );

            const messageValue = new BN('1025000000000000000');
            const nonce = await salenonceholder_contract.getNonce(
                refinableerc1155token_contract.address,
                tokenId,
                accounts[6]
            );

            const saleContractBuySignature = soliditySha3(
                refinableerc1155token_contract.address, // token
                tokenId, // tokenId
                new BN('1000000000000000000').div(new BN('' + buyingAmount)), // price
                sellingAmount, // sellingAmount #
                nonce // nonce
            );
            const saleApprovalSignature = web3.eth.accounts.sign(
                saleContractBuySignature,
                account_private_keys[6],
            );

            await sale_contract.setApprovedSaleDate(refinableerc1155token_contract.address, tokenId, getUnixEpochTimeStamp(new Date('2021-03-31')), { from: accounts[6] })
            let saleInfo = await sale_contract.getSaleInfo(accounts[6], tokenId, { from: accounts[9] });
            assert.equal(saleInfo.approvedSaleDate, getUnixEpochTimeStamp(new Date('2021-03-31')));

            const buyerBalanceBeforeSale = new BN(await web3.eth.getBalance(accounts[7]));
            const sellerBalanceBeforeSale = new BN(await web3.eth.getBalance(accounts[6]));
            const serviceFeeRecipientBeforeBalance = new BN(await web3.eth.getBalance(accounts[5]));

            await sale_contract.buy(
                refinableerc1155token_contract.address, //IERC1155 token,
                tokenId, //uint256 tokenId HAS TO BE THE PASSED TOKEN ID OF A MINTED TOKEN (RefinableERC1155Token)
                accounts[6], //address payable owner, the owner of the token from who we are buyingAmount the token from
                sellingAmount, // sellingAmount
                buyingAmount, // buyingAmount
                saleApprovalSignature.signature, //signature
                { from: accounts[7], value: messageValue.toString() }
            );

            // Owner changed
            const ownedAmount = await refinableerc1155token_contract.balanceOf(
                accounts[7],
                tokenId
            );
            assert.equal(50, ownedAmount);

            const buyerServiceFeeBps = new BN(await servicefeeproxy_contract.getBuyServiceFeeBps(accounts[7], { from: accounts[1] }))
            const sellerServiceFeeBps = new BN(await servicefeeproxy_contract.getSellServiceFeeBps(accounts[6], { from: accounts[1] }))
            const tokenPrice = messageValue.mul(new BN('10000')).div(buyerServiceFeeBps.add(new BN('10000')));
            const buyerServiceFee = messageValue.sub(tokenPrice);
            const sellerServiceFee = new BN('' + tokenPrice).mul(sellerServiceFeeBps).div(new BN('10000'));
            let ownerValue = new BN('' + tokenPrice).sub(sellerServiceFee);

            // Payment was transfered
            const buyerBalance = new BN(await web3.eth.getBalance(accounts[7]));
            const sellerBalance = new BN(await web3.eth.getBalance(accounts[6]));
            const servieFeeRecipientBalance = new BN(await web3.eth.getBalance(accounts[5]));

            const buyerLostBalance = buyerBalanceBeforeSale.sub(buyerBalance);
            const sellerGainedBalance = sellerBalance.sub(sellerBalanceBeforeSale);
            const serviceFeeRecipientGainedBalance = servieFeeRecipientBalance.sub(serviceFeeRecipientBeforeBalance);

            assert.equal(buyerLostBalance.cmp(messageValue), 1);
            assert.equal(sellerGainedBalance.toString(), new BN('975000000000000000').toString())
            assert.equal(serviceFeeRecipientGainedBalance.toString(), new BN('50000000000000000').toString());
        });

        it("fails when buying for another value (minter:6)", async () => {
            const tokenId =
                "0x111122229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174111"; // Randomly chosen
            await mint(accounts[6], tokenId, 100);

            // The owner of the token has to approve the transferproxy for sale == settings something on sale
            await refinableerc1155token_contract.setApprovalForAll(
                transferproxy_contract.address,
                true,
                { from: accounts[6] }
            );

            const messageValue = new BN('1025000000000000000');
            const nonce = await salenonceholder_contract.getNonce(
                refinableerc1155token_contract.address,
                tokenId,
                accounts[6]
            );

            const saleContractBuySignature = soliditySha3(
                refinableerc1155token_contract.address, // token
                tokenId, // tokenId
                messageValue.div(new BN('50')), // price
                100, // sellingAmount #
                nonce // nonce
            );
            const saleApprovalSignature = web3.eth.accounts.sign(
                saleContractBuySignature,
                account_private_keys[6],
            );

            const tooLowValue = messageValue.div(new BN('2'));
            let thrownError;

            await sale_contract.setApprovedSaleDate(refinableerc1155token_contract.address, tokenId, getUnixEpochTimeStamp(new Date('2021-03-31')), { from: accounts[6] })

            try {
                await sale_contract.buy(
                    refinableerc1155token_contract.address, //IERC1155 token,
                    tokenId, //uint256 tokenId HAS TO BE THE PASSED TOKEN ID OF A MINTED TOKEN (RefinableERC1155Token)
                    accounts[6], //address payable owner, the owner of the token from who we are buyingAmount the token from
                    100, // sellingAmount
                    50, // buyingAmount
                    saleApprovalSignature.signature, //signature
                    { from: accounts[7], value: tooLowValue }
                );
            } catch (error) {
                thrownError = error;
            }
            assert.include(thrownError.message, "ERC1155Sale.verifySignature: Incorrect signature");
        });

        it("fails without minted token owner approval (minter:3)", async () => {
            const tokenId = "0x333322329bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174612"; // Randomly chosen
            await mint(accounts[3], tokenId);

            // The owner of the token has to approve the transferproxy for sale == settings something on sale
            // DISABLED TO TEST --> await mintabletoken_contract.setApprovalForAll(transferproxy_contract.address, true, {from: accounts[3]});

            const messageValue = new BN('1025000000000000000');
            const nonce = await salenonceholder_contract.getNonce(refinableerc1155token_contract.address, tokenId, accounts[3]);

            const saleContractBuySignature = soliditySha3(
                refinableerc1155token_contract.address, // token
                tokenId, // tokenId
                messageValue.div(new BN('100')), // price
                100, // sellingAmount #
                nonce, // nonce
            );
            const saleApprovalSignature = web3.eth.accounts.sign(saleContractBuySignature, account_private_keys[3]);

            await sale_contract.setApprovedSaleDate(refinableerc1155token_contract.address, tokenId, getUnixEpochTimeStamp(new Date('2021-03-31')), { from: accounts[3] })

            let thrownError;
            try {
                await sale_contract.buy(
                    refinableerc1155token_contract.address, //IERC1155 token,
                    tokenId, //uint256 tokenId HAS TO BE THE PASSED TOKEN ID OF A MINTED TOKEN (RefinableERC1155Token)
                    accounts[3], //address payable owner, the owner of the token from who we are buyingAmount the token from
                    100, // sellingAmount
                    50, // buyingAmount
                    saleApprovalSignature.signature, //signaure
                    { from: accounts[7], value: messageValue.toString() }
                );
            } catch (error) {
                thrownError = error;
            }

            const ownedAmount = await refinableerc1155token_contract.balanceOf(accounts[7], tokenId);
            assert.equal(0, ownedAmount);

            assert.include(
                thrownError.message,
                "ERC1155Sale.verifySignature: Incorrect signature",
            )
        });
        it("can't buy if token is not open to sale", async () => {
            const tokenId =
                "0x222222229bd51a8f2fd5a5f74e4a256513210caf2ade63cd25c7e4c654174612"; // Randomly chosen
            await mint(accounts[6], tokenId);

            // The owner of the token has to approve the transferproxy for sale once
            await refinableerc1155token_contract.setApprovalForAll(
                transferproxy_contract.address,
                true,
                { from: accounts[6] }
            );

            const messageValue = new BN('1025000000000000000');
            const nonce = await salenonceholder_contract.getNonce(
                refinableerc1155token_contract.address,
                tokenId,
                accounts[6]
            );

            const saleContractBuySignature = soliditySha3(
                refinableerc1155token_contract.address, // token
                tokenId, // tokenId
                messageValue.toString(), // price
                1, // sellingAmount #
                nonce // nonce
            );
            const saleApprovalSignature = web3.eth.accounts.sign(
                saleContractBuySignature,
                account_private_keys[6],
            );

            await sale_contract.setApprovedSaleDate(refinableerc1155token_contract.address, tokenId, getUnixEpochTimeStamp(new Date('2022-03-31')), { from: accounts[6] })

            let thrownError;
            try {
                await sale_contract.buy(
                    refinableerc1155token_contract.address, //IERC1155 token,
                    tokenId, //uint256 tokenId HAS TO BE THE PASSED TOKEN ID OF A MINTED TOKEN (RefinableERC1155Token)
                    accounts[6], //address payable owner, the owner of the token from who we are buyingAmount the token from
                    1, // sellingAmount
                    1, // buyingAmount
                    saleApprovalSignature.signature, //signature
                    { from: accounts[7], value: messageValue.toString() }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                "ERC1155Sale.buy: Tokens is not open to sale yet",
            )
        });

        it("can't set sale date if owner doesn not have amount of token", async () => {
            const tokenId =
                "0x222222229bd51a8f1fd5a6f74e4a256513210caf2ade63cd25c7e4c654174613"; // Randomly chosen
            await mint(accounts[6], tokenId, 100);

            // The owner of the token has to approve the transferproxy for sale once
            await refinableerc1155token_contract.setApprovalForAll(
                transferproxy_contract.address,
                true,
                { from: accounts[6] }
            );

            let thrownError;
            try {
                await sale_contract.setApprovedSaleDate(refinableerc1155token_contract.address, tokenId, getUnixEpochTimeStamp(new Date('2021-03-31')), { from: accounts[5] })
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                "ERC1155Sale.setApprovedSaleDate: Caller doesn't have tokens",
            )
        });

        it("fails set approved sale date with zero amount", async () => {
            const tokenId =
                "0x222222229bd51a8f1fd5a6f74e4a256523210caf2ade63cd25c7e4c654174613"; // Randomly chosen
            await mint(accounts[6], tokenId, 100);

            // The owner of the token has to approve the transferproxy for sale once
            await refinableerc1155token_contract.setApprovalForAll(
                transferproxy_contract.address,
                true,
                { from: accounts[6] }
            );

            let thrownError;
            try {
                await sale_contract.setApprovedSaleDate(refinableerc1155token_contract.address, tokenId, getUnixEpochTimeStamp(new Date('2021-03-31')), { from: accounts[5] })
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                "ERC1155Sale.setApprovedSaleDate: Caller doesn't have tokens",
            )
        });

        it("works and costs something (minter:6)", async () => {
            const tokenId =
                "0x222222229bd51a8f1ed5a5f74e4a256513210caf2ade63cd25c7e4c654174613"; // Randomly chosen
            const buyingAmount = 50;
            const sellingAmount = 100;
            await mint(accounts[6], tokenId, 100);

            // The owner of the token has to approve the transferproxy for sale once
            await refinableerc1155token_contract.setApprovalForAll(
                transferproxy_contract.address,
                true,
                { from: accounts[6] }
            );

            const messageValue = new BN('1025000000000000000');
            const nonce = await salenonceholder_contract.getNonce(
                refinableerc1155token_contract.address,
                tokenId,
                accounts[6]
            );

            const saleContractBuySignature = soliditySha3(
                refinableerc1155token_contract.address, // token
                tokenId, // tokenId
                new BN('1000000000000000000').div(new BN('' + buyingAmount)), // price
                sellingAmount, // sellingAmount #
                nonce // nonce
            );
            const saleApprovalSignature = web3.eth.accounts.sign(
                saleContractBuySignature,
                account_private_keys[6],
            );

            await sale_contract.setApprovedSaleDate(refinableerc1155token_contract.address, tokenId, getUnixEpochTimeStamp(new Date('2021-03-31')), { from: accounts[6] })
            let saleInfo = await sale_contract.getSaleInfo(accounts[6], tokenId, { from: accounts[9] });
            assert.equal(saleInfo.approvedSaleDate, getUnixEpochTimeStamp(new Date('2021-03-31')));

            const buyerBalanceBeforeSale = new BN(await web3.eth.getBalance(accounts[7]));
            const sellerBalanceBeforeSale = new BN(await web3.eth.getBalance(accounts[6]));
            const serviceFeeRecipientBeforeBalance = new BN(await web3.eth.getBalance(accounts[5]));

            await sale_contract.buy(
                refinableerc1155token_contract.address, //IERC1155 token,
                tokenId, //uint256 tokenId HAS TO BE THE PASSED TOKEN ID OF A MINTED TOKEN (RefinableERC1155Token)
                accounts[6], //address payable owner, the owner of the token from who we are buyingAmount the token from
                sellingAmount, // sellingAmount
                buyingAmount, // buyingAmount
                saleApprovalSignature.signature, //signature
                { from: accounts[7], value: messageValue.toString() }
            );

            // Owner changed
            const ownedAmount = await refinableerc1155token_contract.balanceOf(
                accounts[7],
                tokenId
            );
            assert.equal(50, ownedAmount);

            const buyerServiceFeeBps = new BN(await servicefeeproxy_contract.getBuyServiceFeeBps(accounts[7], { from: accounts[1] }))
            const sellerServiceFeeBps = new BN(await servicefeeproxy_contract.getSellServiceFeeBps(accounts[6], { from: accounts[1] }))
            const tokenPrice = messageValue.mul(new BN('10000')).div(buyerServiceFeeBps.add(new BN('10000')));
            const buyerServiceFee = messageValue.sub(tokenPrice);
            const sellerServiceFee = new BN('' + tokenPrice).mul(sellerServiceFeeBps).div(new BN('10000'));
            let ownerValue = new BN('' + tokenPrice).sub(sellerServiceFee);

            // Payment was transfered
            const buyerBalance = new BN(await web3.eth.getBalance(accounts[7]));
            const sellerBalance = new BN(await web3.eth.getBalance(accounts[6]));
            const servieFeeRecipientBalance = new BN(await web3.eth.getBalance(accounts[5]));

            const buyerLostBalance = buyerBalanceBeforeSale.sub(buyerBalance);
            const sellerGainedBalance = sellerBalance.sub(sellerBalanceBeforeSale);
            const serviceFeeRecipientGainedBalance = servieFeeRecipientBalance.sub(serviceFeeRecipientBeforeBalance);

            assert.equal(buyerLostBalance.cmp(messageValue), 1);
            assert.equal(sellerGainedBalance.toString(), new BN('975000000000000000').toString())
            assert.equal(serviceFeeRecipientGainedBalance.toString(), new BN('50000000000000000').toString());
        });

        it("fails if remaining amount of sale tokens are not enough", async () => {
            const tokenId =
                "0x222222229bd51a8f1fd5a5f74e4b256513210caf2ade63cd25c7e4c654174613"; // Randomly chosen
            const buyingAmount = 50;
            const sellingAmount = 100;
            await mint(accounts[6], tokenId, 100);

            // The owner of the token has to approve the transferproxy for sale once
            await refinableerc1155token_contract.setApprovalForAll(
                transferproxy_contract.address,
                true,
                { from: accounts[6] }
            );

            const messageValue = new BN('1025000000000000000');
            let nonce = await salenonceholder_contract.getNonce(
                refinableerc1155token_contract.address,
                tokenId,
                accounts[6]
            );

            let saleContractBuySignature = soliditySha3(
                refinableerc1155token_contract.address, // token
                tokenId, // tokenId
                new BN('1000000000000000000').div(new BN('' + buyingAmount)), // price
                sellingAmount, // sellingAmount #
                nonce // nonce
            );
            let saleApprovalSignature = web3.eth.accounts.sign(
                saleContractBuySignature,
                account_private_keys[6],
            );

            await sale_contract.setApprovedSaleDate(refinableerc1155token_contract.address, tokenId, getUnixEpochTimeStamp(new Date('2021-03-31')), { from: accounts[6] })
            let saleInfo = await sale_contract.getSaleInfo(accounts[6], tokenId, { from: accounts[9] });
            assert.equal(saleInfo.approvedSaleDate, getUnixEpochTimeStamp(new Date('2021-03-31')));

            const buyerBalanceBeforeSale = new BN(await web3.eth.getBalance(accounts[7]));
            const sellerBalanceBeforeSale = new BN(await web3.eth.getBalance(accounts[6]));
            const serviceFeeRecipientBeforeBalance = new BN(await web3.eth.getBalance(accounts[5]));

            await sale_contract.buy(
                refinableerc1155token_contract.address, //IERC1155 token,
                tokenId, //uint256 tokenId HAS TO BE THE PASSED TOKEN ID OF A MINTED TOKEN (RefinableERC1155Token)
                accounts[6], //address payable owner, the owner of the token from who we are buyingAmount the token from
                sellingAmount, // sellingAmount
                buyingAmount, // buyingAmount
                saleApprovalSignature.signature, //signature
                { from: accounts[7], value: messageValue.toString() }
            );

            // Owner changed
            const ownedAmount = await refinableerc1155token_contract.balanceOf(
                accounts[7],
                tokenId
            );
            assert.equal(50, ownedAmount);

            const buyerServiceFeeBps = new BN(await servicefeeproxy_contract.getBuyServiceFeeBps(accounts[7], { from: accounts[1] }))
            const sellerServiceFeeBps = new BN(await servicefeeproxy_contract.getSellServiceFeeBps(accounts[6], { from: accounts[1] }))
            const tokenPrice = messageValue.mul(new BN('10000')).div(buyerServiceFeeBps.add(new BN('10000')));
            const buyerServiceFee = messageValue.sub(tokenPrice);
            const sellerServiceFee = new BN('' + tokenPrice).mul(sellerServiceFeeBps).div(new BN('10000'));
            let ownerValue = new BN('' + tokenPrice).sub(sellerServiceFee);

            // Payment was transfered
            const buyerBalance = new BN(await web3.eth.getBalance(accounts[7]));
            const sellerBalance = new BN(await web3.eth.getBalance(accounts[6]));
            const servieFeeRecipientBalance = new BN(await web3.eth.getBalance(accounts[5]));

            const buyerLostBalance = buyerBalanceBeforeSale.sub(buyerBalance);
            const sellerGainedBalance = sellerBalance.sub(sellerBalanceBeforeSale);
            const serviceFeeRecipientGainedBalance = servieFeeRecipientBalance.sub(serviceFeeRecipientBeforeBalance);

            assert.equal(buyerLostBalance.cmp(messageValue), 1);
            assert.equal(sellerGainedBalance.toString(), new BN('975000000000000000').toString())
            assert.equal(serviceFeeRecipientGainedBalance.toString(), new BN('50000000000000000').toString());
            
            nonce = await salenonceholder_contract.getNonce(
                refinableerc1155token_contract.address,
                tokenId,
                accounts[6]
            );

            saleContractBuySignature = soliditySha3(
                refinableerc1155token_contract.address, // token
                tokenId, // tokenId
                messageValue.div(new BN('50')), // price
                sellingAmount - buyingAmount, // sellingAmount #
                nonce // nonce
            );
            saleApprovalSignature = web3.eth.accounts.sign(
                saleContractBuySignature,
                account_private_keys[6],
            );

            let thrownError;
            try {
                await sale_contract.buy(
                    refinableerc1155token_contract.address, //IERC1155 token,
                    tokenId, //uint256 tokenId HAS TO BE THE PASSED TOKEN ID OF A MINTED TOKEN (RefinableERC1155Token)
                    accounts[6], //address payable owner, the owner of the token from who we are buyingAmount the token from
                    sellingAmount - buyingAmount, // sellingAmount
                    100, // buyingAmount
                    saleApprovalSignature.signature, //signature
                    { from: accounts[7], value: messageValue.toString() }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                "ERC1155Sale.verifySignature: Incorrect signature",
            )
        });
    });

    describe("fees", () => {
        it("fees are correct sent to recipients & service fee recipient", async () => {
            let tokenId = "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174656"; // Randomly chosen
            let buyingAmount = 50;
            let sellingAmount = 100;
            let fees = [
                {
                    recipient: accounts[0],
                    value: 10,
                },
                {
                    recipient: accounts[1],
                    value: 10,
                },
            ];
            let beforeBalances = [
                new BN(await web3.eth.getBalance(accounts[0])),
                new BN(await web3.eth.getBalance(accounts[1])),
            ]
            await mint(accounts[6], tokenId, sellingAmount, fees);

            // The owner of the token has to approve the transferproxy for sale once
            await refinableerc1155token_contract.setApprovalForAll(
                transferproxy_contract.address,
                true,
                { from: accounts[6] }
            );

            let messageValue = new BN('1025000000000000000');
            let nonce = await salenonceholder_contract.getNonce(
                refinableerc1155token_contract.address,
                tokenId,
                accounts[6]
            );

            let saleContractBuySignature = soliditySha3(
                refinableerc1155token_contract.address, // token
                tokenId, // tokenId
                new BN('1000000000000000000').div(new BN('' + buyingAmount)), // price
                sellingAmount, // sellingAmount #
                nonce // nonce
            );
            let saleApprovalSignature = web3.eth.accounts.sign(
                saleContractBuySignature,
                account_private_keys[6],
            );

            await sale_contract.setApprovedSaleDate(refinableerc1155token_contract.address, tokenId, getUnixEpochTimeStamp(new Date('2021-03-31')), { from: accounts[6] })

            let buyerBalanceBeforeSale = new BN(await web3.eth.getBalance(accounts[7]));
            let sellerBalanceBeforeSale = new BN(await web3.eth.getBalance(accounts[6]));
            let serviceFeeRecipientBeforeBalance = new BN(await web3.eth.getBalance(accounts[5]));

            await sale_contract.buy(
                refinableerc1155token_contract.address, //IERC1155 token,
                tokenId, //uint256 tokenId HAS TO BE THE PASSED TOKEN ID OF A MINTED TOKEN (RefinableERC1155Token)
                accounts[6], //address payable owner, the owner of the token from who we are buyingAmount the token from
                sellingAmount, // sellingAmount
                buyingAmount, // buyingAmount
                saleApprovalSignature.signature, //signature
                { from: accounts[7], value: messageValue.toString() }
            );

            // Owner changed
            let ownedAmount = await refinableerc1155token_contract.balanceOf(
                accounts[7],
                tokenId
            );
            assert.equal(50, ownedAmount);

            let buyerServiceFeeBps = new BN(await servicefeeproxy_contract.getBuyServiceFeeBps(accounts[7], { from: accounts[1] }))
            let sellerServiceFeeBps = new BN(await servicefeeproxy_contract.getSellServiceFeeBps(accounts[6], { from: accounts[1] }))
            let tokenPrice = messageValue.mul(new BN('10000')).div(buyerServiceFeeBps.add(new BN('10000')));
            let buyerServiceFee = messageValue.sub(tokenPrice);
            let sellerServiceFee = new BN('' + tokenPrice).mul(sellerServiceFeeBps).div(new BN('10000'));
            let ownerValue = new BN('' + tokenPrice).sub(sellerServiceFee);

            let sumFee = new BN('0');
            for (let i = 0; i < fees.length; i++) {
                const fee = ownerValue.mul(new BN('' + fees[i].value)).div(new BN('10000'));
                const balance = new BN(await web3.eth.getBalance(fees[i].recipient));
                assert.equal(balance.sub(beforeBalances[i]).toString(), fee.toString())

                sumFee = sumFee.add(fee);
            }

            // Payment was transfered
            let buyerBalance = new BN(await web3.eth.getBalance(accounts[7]));
            let sellerBalance = new BN(await web3.eth.getBalance(accounts[6]));
            let servieFeeRecipientBalance = new BN(await web3.eth.getBalance(accounts[5]));

            let buyerLostBalance = buyerBalanceBeforeSale.sub(buyerBalance);
            let sellerGainedBalance = sellerBalance.sub(sellerBalanceBeforeSale);
            let serviceFeeRecipientGainedBalance = servieFeeRecipientBalance.sub(serviceFeeRecipientBeforeBalance);

            assert.equal(buyerLostBalance.cmp(messageValue), 1);
            assert.equal(sellerGainedBalance.toString(), new BN('975000000000000000').sub(sumFee).toString())
            assert.equal(serviceFeeRecipientGainedBalance.toString(), new BN('50000000000000000').toString());

            buyingAmount = 50;
            sellingAmount = 50;
            fees = [
                {
                    recipient: accounts[0],
                    value: 10,
                },
                {
                    recipient: accounts[1],
                    value: 10,
                },
            ];
            beforeBalances = [
                new BN(await web3.eth.getBalance(accounts[0])),
                new BN(await web3.eth.getBalance(accounts[1])),
            ]

            // The owner of the token has to approve the transferproxy for sale once
            await refinableerc1155token_contract.setApprovalForAll(
                transferproxy_contract.address,
                true,
                { from: accounts[7] }
            );

            messageValue = new BN('1025000000000000000');
            nonce = await salenonceholder_contract.getNonce(
                refinableerc1155token_contract.address,
                tokenId,
                accounts[7]
            );

            saleContractBuySignature = soliditySha3(
                refinableerc1155token_contract.address, // token
                tokenId, // tokenId
                new BN('1000000000000000000').div(new BN('' + buyingAmount)), // price
                sellingAmount, // sellingAmount #
                nonce // nonce
            );
            saleApprovalSignature = web3.eth.accounts.sign(
                saleContractBuySignature,
                account_private_keys[7],
            );

            await sale_contract.setApprovedSaleDate(refinableerc1155token_contract.address, tokenId, getUnixEpochTimeStamp(new Date('2021-03-31')), { from: accounts[7] })

            buyerBalanceBeforeSale = new BN(await web3.eth.getBalance(accounts[8]));
            sellerBalanceBeforeSale = new BN(await web3.eth.getBalance(accounts[7]));
            serviceFeeRecipientBeforeBalance = new BN(await web3.eth.getBalance(accounts[5]));

            await sale_contract.buy(
                refinableerc1155token_contract.address, //IERC1155 token,
                tokenId, //uint256 tokenId HAS TO BE THE PASSED TOKEN ID OF A MINTED TOKEN (RefinableERC1155Token)
                accounts[7], //address payable owner, the owner of the token from who we are buyingAmount the token from
                sellingAmount, // sellingAmount
                buyingAmount, // buyingAmount
                saleApprovalSignature.signature, //signature
                { from: accounts[8], value: messageValue.toString() }
            );

            // Owner changed
            ownedAmount = await refinableerc1155token_contract.balanceOf(
                accounts[8],
                tokenId
            );
            assert.equal(50, ownedAmount);

            buyerServiceFeeBps = new BN(await servicefeeproxy_contract.getBuyServiceFeeBps(accounts[8], { from: accounts[1] }))
            sellerServiceFeeBps = new BN(await servicefeeproxy_contract.getSellServiceFeeBps(accounts[7], { from: accounts[1] }))
            tokenPrice = messageValue.mul(new BN('10000')).div(buyerServiceFeeBps.add(new BN('10000')));
            buyerServiceFee = messageValue.sub(tokenPrice);
            sellerServiceFee = new BN('' + tokenPrice).mul(sellerServiceFeeBps).div(new BN('10000'));
            ownerValue = new BN('' + tokenPrice).sub(sellerServiceFee);

            sumFee = new BN('0');
            for (let i = 0; i < fees.length; i++) {
                const fee = ownerValue.mul(new BN('' + fees[i].value)).div(new BN('10000'));
                const balance = new BN(await web3.eth.getBalance(fees[i].recipient));
                assert.equal(balance.sub(beforeBalances[i]).toString(), fee.toString())

                sumFee = sumFee.add(fee);
            }

            // Payment was transfered
            buyerBalance = new BN(await web3.eth.getBalance(accounts[8]));
            sellerBalance = new BN(await web3.eth.getBalance(accounts[7]));
            servieFeeRecipientBalance = new BN(await web3.eth.getBalance(accounts[5]));

            buyerLostBalance = buyerBalanceBeforeSale.sub(buyerBalance);
            sellerGainedBalance = sellerBalance.sub(sellerBalanceBeforeSale);
            serviceFeeRecipientGainedBalance = servieFeeRecipientBalance.sub(serviceFeeRecipientBeforeBalance);

            assert.equal(buyerLostBalance.cmp(messageValue), 1);
            assert.equal(sellerGainedBalance.toString(), new BN('975000000000000000').sub(sumFee).toString())
            assert.equal(serviceFeeRecipientGainedBalance.toString(), new BN('50000000000000000').toString());
        });

        it("complex buying", async () => {
            let tokenId = "0x222222229cd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174656"; // Randomly chosen

            await mint(accounts[6], tokenId, 5);

            // The owner of the token has to approve the transferproxy for sale once
            await refinableerc1155token_contract.setApprovalForAll(
                transferproxy_contract.address,
                true,
                { from: accounts[6] }
            );

            let messageValue = new BN('1025000000000000000');
            let nonce = await salenonceholder_contract.getNonce(
                refinableerc1155token_contract.address,
                tokenId,
                accounts[6]
            );

            let saleContractBuySignature = soliditySha3(
                refinableerc1155token_contract.address, // token
                tokenId, // tokenId
                new BN('1000000000000000000').div(new BN('' + 1)), // price
                5, // sellingAmount #
                nonce // nonce
            );
            let saleApprovalSignature = web3.eth.accounts.sign(
                saleContractBuySignature,
                account_private_keys[6],
            );

            await sale_contract.setApprovedSaleDate(refinableerc1155token_contract.address, tokenId, getUnixEpochTimeStamp(new Date('2021-03-31')), { from: accounts[6] })

            await sale_contract.buy(
                refinableerc1155token_contract.address, //IERC1155 token,
                tokenId, //uint256 tokenId HAS TO BE THE PASSED TOKEN ID OF A MINTED TOKEN (RefinableERC1155Token)
                accounts[6], //address payable owner, the owner of the token from who we are buyingAmount the token from
                5, // sellingAmount
                1, // buyingAmount
                saleApprovalSignature.signature, //signature
                { from: accounts[7], value: messageValue.toString() }
            );

            assert.equal(
                await refinableerc1155token_contract.balanceOf(accounts[7], tokenId),
                1
            );
            assert.equal(
                await refinableerc1155token_contract.balanceOf(accounts[6], tokenId),
                4
            );

            nonce = await salenonceholder_contract.getNonce(
                refinableerc1155token_contract.address,
                tokenId,
                accounts[6]
            );

            saleContractBuySignature = soliditySha3(
                refinableerc1155token_contract.address, // token
                tokenId, // tokenId
                new BN('1000000000000000000').div(new BN('' + 1)), // price
                4, // sellingAmount #
                nonce // nonce
            );
            saleApprovalSignature = web3.eth.accounts.sign(
                saleContractBuySignature,
                account_private_keys[6],
            );

            await sale_contract.buy(
                refinableerc1155token_contract.address, //IERC1155 token,
                tokenId, //uint256 tokenId HAS TO BE THE PASSED TOKEN ID OF A MINTED TOKEN (RefinableERC1155Token)
                accounts[6], //address payable owner, the owner of the token from who we are buyingAmount the token from
                4, // sellingAmount
                1, // buyingAmount
                saleApprovalSignature.signature, //signature
                { from: accounts[8], value: messageValue.toString() }
            );

            assert.equal(
                await refinableerc1155token_contract.balanceOf(accounts[8], tokenId),
                1
            );
            assert.equal(
                await refinableerc1155token_contract.balanceOf(accounts[6], tokenId),
                3
            );

            nonce = await salenonceholder_contract.getNonce(
                refinableerc1155token_contract.address,
                tokenId,
                accounts[7]
            );

            saleContractBuySignature = soliditySha3(
                refinableerc1155token_contract.address, // token
                tokenId, // tokenId
                new BN('1000000000000000000').div(new BN('' + 1)), // price
                1, // sellingAmount #
                nonce // nonce
            );
            saleApprovalSignature = web3.eth.accounts.sign(
                saleContractBuySignature,
                account_private_keys[7],
            );

            await refinableerc1155token_contract.setApprovalForAll(
                transferproxy_contract.address,
                true,
                { from: accounts[7] }
            );

            await sale_contract.setApprovedSaleDate(refinableerc1155token_contract.address, tokenId, getUnixEpochTimeStamp(new Date('2021-03-31')), { from: accounts[7] })

            await sale_contract.buy(
                refinableerc1155token_contract.address, //IERC1155 token,
                tokenId, //uint256 tokenId HAS TO BE THE PASSED TOKEN ID OF A MINTED TOKEN (RefinableERC1155Token)
                accounts[7], //address payable owner, the owner of the token from who we are buyingAmount the token from
                1, // sellingAmount
                1, // buyingAmount
                saleApprovalSignature.signature, //signature
                { from: accounts[8], value: messageValue.toString() }
            );

            assert.equal(
                await refinableerc1155token_contract.balanceOf(accounts[8], tokenId),
                2
            );
            assert.equal(
                await refinableerc1155token_contract.balanceOf(accounts[7], tokenId),
                0
            );
            assert.equal(
                await refinableerc1155token_contract.balanceOf(accounts[6], tokenId),
                3
            );
        });
    });
});
