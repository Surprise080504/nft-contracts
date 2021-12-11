const RefinableERC721Token = artifacts.require("RefinableERC721Token");
const RefinableToken = artifacts.require("RefinableToken");
const ERC721Sale = artifacts.require("ERC721Sale");
const TransferProxy = artifacts.require("TransferProxy");
const ServiceFeeProxy = artifacts.require("ServiceFeeProxy");
const ServiceFee = artifacts.require("ServiceFee");
const ERC721SaleNonceHolder = artifacts.require("ERC721SaleNonceHolder");

const { soliditySha3, BN } = require("web3-utils");
const { account_private_keys } = require("../keys.json");

function getUnixEpochTimeStamp(value) {
    return Math.floor(value.getTime() / 1000);
}

contract("ERC721Sale", (accounts) => {
    var refinableerc721token_contract;
    var transferproxy_contract;
    var servicefee_contract;
    var servicefeeproxy_contract;
    var salenonceholder_contract;
    var sale_contract;
    var refinabletoken_contract;

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

        await TransferProxy.new({ from: accounts[1] }).then(function (instance) {
            transferproxy_contract = instance;
        });

        await RefinableToken.new({ from: accounts[1] }).then(function (instance) {
            refinabletoken_contract = instance;
        });

        await ServiceFee.new({ from: accounts[1] }).then(function (instance) {
            servicefee_contract = instance;
        });

        await ServiceFeeProxy.new({ from: accounts[1] }).then(function (instance) {
            servicefeeproxy_contract = instance;
        });

        await servicefee_contract.addProxy(servicefeeproxy_contract.address, { from: accounts[1] })
        await servicefee_contract.setRefinableTokenContract(refinabletoken_contract.address, { from: accounts[1] })
        await servicefeeproxy_contract.setServiceFeeContract(servicefee_contract.address, { from: accounts[1] })
        await servicefeeproxy_contract.setServiceFeeRecipient(accounts[5], { from: accounts[1] })

        await ERC721SaleNonceHolder.new({ from: accounts[1] }).then(function (
            instance
        ) {
            salenonceholder_contract = instance;
        });

        await ERC721Sale.new(
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

    const mint = async (minter, tokenId, fees = []) => {
        const contractAddressTokenIdSha = soliditySha3(
            refinableerc721token_contract.address,
            tokenId,
            minter,
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

    describe("buy", () => {
        it("works and costs something (minter:6)", async () => {
            const tokenId =
                "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174612"; // Randomly chosen
            await mint(accounts[6], tokenId);

            // The owner of the token has to approve the transferproxy for sale once
            await refinableerc721token_contract.setApprovalForAll(
                transferproxy_contract.address,
                true,
                { from: accounts[6] }
            );

            const messageValue = new BN('1025000000000000000');
            const nonce = await salenonceholder_contract.getNonce(
                refinableerc721token_contract.address,
                tokenId,
                accounts[6]
            );

            const nonceBigNumber = new BN(nonce);
            const saleContractBuySignature = soliditySha3(
                refinableerc721token_contract.address, // token
                tokenId, // tokenId
                new BN('1000000000000000000').toString(), // price
                nonceBigNumber.toNumber() // nonce
            );
            const saleApprovalSignature = web3.eth.accounts.sign(
                saleContractBuySignature,
                account_private_keys[6]
            );

            await sale_contract.setApproveSaleDate(refinableerc721token_contract.address, tokenId, getUnixEpochTimeStamp(new Date('2021-03-31')), { from: accounts[6] })
            let saleInfo = await sale_contract.getSaleInfo(accounts[6], tokenId, {from: accounts[9]});
            assert.equal(saleInfo.approvedSaleDate, getUnixEpochTimeStamp(new Date('2021-03-31')));

            const buyerBalanceBeforeSale = new BN(await web3.eth.getBalance(accounts[7]));
            const sellerBalanceBeforeSale = new BN(await web3.eth.getBalance(accounts[6]));
            const serviceFeeRecipientBeforeBalance = new BN(await web3.eth.getBalance(accounts[5]));

            await sale_contract.buy(
                refinableerc721token_contract.address, //IERC721 token,
                tokenId, //uint256 tokenId HAS TO BE THE PASSED TOKEN ID OF A MINTED TOKEN (RefinableERC721Token)
                accounts[6], //address payable owner, the owner of the token from who we are buying the token from
                saleApprovalSignature.signature,
                { from: accounts[7], value: messageValue.toString() }
            );

            // Owner changed
            const newOwner = await refinableerc721token_contract.ownerOf(tokenId);
            assert.equal(accounts[7], newOwner);

            // Payment was transfered
            const buyerServiceFeeBps = new BN(await servicefeeproxy_contract.getBuyServiceFeeBps(accounts[7], { from: accounts[1] }))
            const sellerServiceFeeBps = new BN(await servicefeeproxy_contract.getSellServiceFeeBps(accounts[6], { from: accounts[1] }))
            const tokenPrice = messageValue.mul(new BN('10000')).div(buyerServiceFeeBps.add(new BN('10000')));
            const sellerServiceFee = new BN('' + tokenPrice).mul(sellerServiceFeeBps).div(new BN('10000'));
            const buyerBalance = new BN(await web3.eth.getBalance(accounts[7]));
            const sellerBalance = new BN(await web3.eth.getBalance(accounts[6]));
            const servieFeeRecipientBalance = new BN(await web3.eth.getBalance(accounts[5]));

            const buyerLostBalance = buyerBalanceBeforeSale.sub(buyerBalance);
            const sellerGainedBalance = sellerBalance.sub(sellerBalanceBeforeSale);
            const serviceFeeRecipientGainedBalance = servieFeeRecipientBalance.sub(serviceFeeRecipientBeforeBalance);

            assert.equal(buyerLostBalance.cmp(messageValue), 1);
            assert.equal(sellerGainedBalance.toString(), new BN('975000000000000000').toString())
            assert.equal(serviceFeeRecipientGainedBalance.toString(), new BN('50000000000000000').toString());

            //SaleInfo changed
            saleInfo = sale_contract.getSaleInfo(accounts[6], tokenId, {from: accounts[9]});
            assert.equal(saleInfo.approvedSaleDate, undefined);
        });

        it("fails when buying for another value (minter:6)", async () => {
            const tokenId =
                "0x111122229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174612"; // Randomly chosen
            await mint(accounts[6], tokenId);

            // The owner of the token has to approve the transferproxy for sale == settings something on sale
            await refinableerc721token_contract.setApprovalForAll(
                transferproxy_contract.address,
                true,
                { from: accounts[6] }
            );

            const messageValue = 10000000000000000;
            const saleContractBuySignature = soliditySha3(
                refinableerc721token_contract.address, // token
                tokenId, // tokenId
                messageValue, // price
                0 // nonce
            );
            const saleApprovalSignature = web3.eth.accounts.sign(
                saleContractBuySignature,
                account_private_keys[6]
            );

            await sale_contract.setApproveSaleDate(refinableerc721token_contract.address, tokenId, getUnixEpochTimeStamp(new Date('2021-03-31')), { from: accounts[6] })

            const tooLowValue = messageValue / 2;
            let thrownError;
            try {
                await sale_contract.buy(
                    refinableerc721token_contract.address, //IERC721 token,
                    tokenId, //uint256 tokenId HAS TO BE THE PASSED TOKEN ID OF A MINTED TOKEN (RefinableERC721Token)
                    accounts[6], //address payable owner,
                    saleApprovalSignature.signature, //signature,
                    { from: accounts[7], value: tooLowValue }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                "ERC721Sale.verifySignature: Incorrect signature"
            );
        });

        it("fails without minted token owner approval (minter:3)", async () => {
            const tokenId =
                "0x333322229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174612"; // Randomly chosen
            await mint(accounts[3], tokenId);

            // The owner of the token has to approve the transferproxy for sale == settings something on sale
            // DISABLED TO TEST --> await refinableerc721token_contract.setApprovalForAll(transferproxy_contract.address, true, {from: accounts[3]});

            const messageValue = new BN('1025000000000000000');
            const saleContractBuySignature = soliditySha3(
                refinableerc721token_contract.address, // token
                tokenId, // tokenId
                new BN('1000000000000000000').toString(), // price
                0 // nonce
            );
            const saleApprovalSignature = web3.eth.accounts.sign(
                saleContractBuySignature,
                account_private_keys[3],
            );

            await sale_contract.setApproveSaleDate(refinableerc721token_contract.address, tokenId, getUnixEpochTimeStamp(new Date('2021-03-31')), { from: accounts[3] })

            let thrownError;
            try {
                await sale_contract.buy(
                    refinableerc721token_contract.address, //IERC721 token,
                    tokenId, //uint256 tokenId HAS TO BE THE PASSED TOKEN ID OF A MINTED TOKEN (RefinableERC721Token)
                    accounts[3], //address payable owner,
                    saleApprovalSignature.signature, //signature
                    { from: accounts[7], value: messageValue }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.equal(
                thrownError,
                "Error: Returned error: VM Exception while processing transaction: revert ERC721: transfer caller is not owner nor approved -- Reason given: ERC721: transfer caller is not owner nor approved."
            );
        });

        it("ApproveAll only needed once per minter (minter:4)", async () => {
            const tokenId1 =
                "0x444422229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174612"; // Randomly chosen
            const tokenId2 =
                "0x555522229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174612"; // Randomly chosen
            await mint(accounts[4], tokenId1);
            await mint(accounts[4], tokenId2);

            // setApprovalForAll ONCE
            await refinableerc721token_contract.setApprovalForAll(
                transferproxy_contract.address,
                true,
                { from: accounts[4] }
            );

            // Backend sign first sale
            const messageValue = new BN('1025000000000000000');
            const saleContractBuySignature1 = soliditySha3(
                refinableerc721token_contract.address, // token
                tokenId1, // tokenId
                new BN('1000000000000000000').toString(), // price
                0 // nonce
            );
            const saleApprovalSignature1 = web3.eth.accounts.sign(
                saleContractBuySignature1,
                account_private_keys[4],
            );

            // Backend sign second sale
            const saleContractBuySignature2 = soliditySha3(
                refinableerc721token_contract.address, // token
                tokenId2, // tokenId
                new BN('1000000000000000000').toString(), // price
                0 // nonce
            );
            const saleApprovalSignature2 = web3.eth.accounts.sign(
                saleContractBuySignature2,
                account_private_keys[4],
            );

            await sale_contract.setApproveSaleDate(refinableerc721token_contract.address, tokenId1, getUnixEpochTimeStamp(new Date('2021-03-31')), { from: accounts[4] })

            // Sold one token
            await sale_contract.buy(
                refinableerc721token_contract.address, //IERC721 token,
                tokenId1, //uint256 tokenId HAS TO BE THE PASSED TOKEN ID OF A MINTED TOKEN (RefinableERC721Token)
                accounts[4], //address payable owner, the owner of the token from who we are buying the token from
                saleApprovalSignature1.signature, //signature
                { from: accounts[7], value: messageValue }
            );

            const newOwner = await refinableerc721token_contract.ownerOf(tokenId1);
            assert.equal(accounts[7], newOwner);

            await sale_contract.setApproveSaleDate(refinableerc721token_contract.address, tokenId2, getUnixEpochTimeStamp(new Date('2021-03-31')), { from: accounts[4] })

            // Sold two tokens
            await sale_contract.buy(
                refinableerc721token_contract.address, //IERC721 token,
                tokenId2, //uint256 tokenId HAS TO BE THE PASSED TOKEN ID OF A MINTED TOKEN (RefinableERC721Token)
                accounts[4], //address payable owner, the owner of the token from who we are buying the token from
                saleApprovalSignature2.signature, //signtaure
                { from: accounts[8], value: messageValue }
            );

            const newOwner2 = await refinableerc721token_contract.ownerOf(tokenId2);
            assert.equal(accounts[8], newOwner2);
        });

        it("does not work if prev owner try to approve", async () => {
            const tokenId =
                "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174655"; // Randomly chosen
            await mint(accounts[6], tokenId);

            // The owner of the token has to approve the transferproxy for sale once
            await refinableerc721token_contract.setApprovalForAll(
                transferproxy_contract.address,
                true,
                { from: accounts[6] }
            );

            let messageValue = new BN('1025000000000000000');
            let nonce = await salenonceholder_contract.getNonce(
                refinableerc721token_contract.address,
                tokenId,
                accounts[6]
            );

            let nonceBigNumber = new BN(nonce);
            let saleContractBuySignature = soliditySha3(
                refinableerc721token_contract.address, // token
                tokenId, // tokenId
                new BN('1000000000000000000').toString(), // price
                nonceBigNumber.toNumber() // nonce
            );
            let saleApprovalSignature = web3.eth.accounts.sign(
                saleContractBuySignature,
                account_private_keys[6]
            );

            await sale_contract.setApproveSaleDate(refinableerc721token_contract.address, tokenId, getUnixEpochTimeStamp(new Date('2021-03-31')), { from: accounts[6] })

            await sale_contract.buy(
                refinableerc721token_contract.address, //IERC721 token,
                tokenId, //uint256 tokenId HAS TO BE THE PASSED TOKEN ID OF A MINTED TOKEN (RefinableERC721Token)
                accounts[6], //address payable owner, the owner of the token from who we are buying the token from
                saleApprovalSignature.signature,
                { from: accounts[7], value: messageValue }
            );

            // Owner changed
            let newOwner = await refinableerc721token_contract.ownerOf(tokenId);
            assert.equal(accounts[7], newOwner);

            // The owner of the token has to approve the transferproxy for sale once
            await refinableerc721token_contract.setApprovalForAll(
                transferproxy_contract.address,
                true,
                { from: accounts[6] }
            );

            buyerBalanceBeforeSale = await web3.eth.getBalance(accounts[7]);
            sellerBalanceBeforeSale = await web3.eth.getBalance(accounts[6]);

            messageValue = 10000000000000000;
            nonce = await salenonceholder_contract.getNonce(
                refinableerc721token_contract.address,
                tokenId,
                accounts[6]
            );

            nonceBigNumber = new BN(nonce);
            saleContractBuySignature = soliditySha3(
                refinableerc721token_contract.address, // token
                tokenId, // tokenId
                messageValue, // price
                nonceBigNumber.toNumber() // nonce
            );
            saleApprovalSignature = web3.eth.accounts.sign(
                saleContractBuySignature,
                account_private_keys[6]
            );

            try {
                await sale_contract.setApproveSaleDate(refinableerc721token_contract.address, tokenId, getUnixEpochTimeStamp(new Date('2021-03-31')), { from: accounts[6] })
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Caller is not the owner of the token',
            )
        });

        it("can't buy token again once it was bought.", async () => {
            const tokenId =
                "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7c4c654174612"; // Randomly chosen
            await mint(accounts[6], tokenId);

            // The owner of the token has to approve the transferproxy for sale once
            await refinableerc721token_contract.setApprovalForAll(
                transferproxy_contract.address,
                true,
                { from: accounts[6] }
            );

            const messageValue = new BN('1025000000000000000');
            const nonce = await salenonceholder_contract.getNonce(
                refinableerc721token_contract.address,
                tokenId,
                accounts[6]
            );

            const nonceBigNumber = new BN(nonce);
            const saleContractBuySignature = soliditySha3(
                refinableerc721token_contract.address, // token
                tokenId, // tokenId
                new BN('1000000000000000000').toString(), // price
                nonceBigNumber.toNumber() // nonce
            );
            const saleApprovalSignature = web3.eth.accounts.sign(
                saleContractBuySignature,
                account_private_keys[6]
            );

            await sale_contract.setApproveSaleDate(refinableerc721token_contract.address, tokenId, getUnixEpochTimeStamp(new Date('2021-03-31')), { from: accounts[6] })

            const buyerBalanceBeforeSale = new BN(await web3.eth.getBalance(accounts[7]));
            const sellerBalanceBeforeSale = new BN(await web3.eth.getBalance(accounts[6]));
            const serviceFeeRecipientBeforeBalance = new BN(await web3.eth.getBalance(accounts[5]));

            await sale_contract.buy(
                refinableerc721token_contract.address, //IERC721 token,
                tokenId, //uint256 tokenId HAS TO BE THE PASSED TOKEN ID OF A MINTED TOKEN (RefinableERC721Token)
                accounts[6], //address payable owner, the owner of the token from who we are buying the token from
                saleApprovalSignature.signature,
                { from: accounts[7], value: messageValue.toString() }
            );

            // Owner changed
            const newOwner = await refinableerc721token_contract.ownerOf(tokenId);
            assert.equal(accounts[7], newOwner);

            // Payment was transfered
            const buyerServiceFeeBps = new BN(await servicefeeproxy_contract.getBuyServiceFeeBps(accounts[7], { from: accounts[1] }))
            const sellerServiceFeeBps = new BN(await servicefeeproxy_contract.getSellServiceFeeBps(accounts[6], { from: accounts[1] }))
            const tokenPrice = messageValue.mul(new BN('10000')).div(buyerServiceFeeBps.add(new BN('10000')));
            const sellerServiceFee = new BN('' + tokenPrice).mul(sellerServiceFeeBps).div(new BN('10000'));
            const buyerBalance = new BN(await web3.eth.getBalance(accounts[7]));
            const sellerBalance = new BN(await web3.eth.getBalance(accounts[6]));
            const servieFeeRecipientBalance = new BN(await web3.eth.getBalance(accounts[5]));

            const buyerLostBalance = buyerBalanceBeforeSale.sub(buyerBalance);
            const sellerGainedBalance = sellerBalance.sub(sellerBalanceBeforeSale);
            const serviceFeeRecipientGainedBalance = servieFeeRecipientBalance.sub(serviceFeeRecipientBeforeBalance);

            assert.equal(buyerLostBalance.cmp(messageValue), 1);
            assert.equal(sellerGainedBalance.toString(), new BN('975000000000000000').toString())
            assert.equal(serviceFeeRecipientGainedBalance.toString(), new BN('50000000000000000').toString());

            let thrownError;
            try {
                await sale_contract.setApproveSaleDate(refinableerc721token_contract.address, tokenId, getUnixEpochTimeStamp(new Date('2021-03-31')), { from: accounts[8] })
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'ERC721Sale.setApproveSaleDate: Caller is not the owner of the token',
            )
        });

        it("can't buy if the token is not open to sale", async () => {
            const tokenId =
                "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654175555"; // Randomly chosen
            await mint(accounts[6], tokenId);

            // The owner of the token has to approve the transferproxy for sale once
            await refinableerc721token_contract.setApprovalForAll(
                transferproxy_contract.address,
                true,
                { from: accounts[6] }
            );

            const messageValue = 10000000000000000;
            const nonce = await salenonceholder_contract.getNonce(
                refinableerc721token_contract.address,
                tokenId,
                accounts[6]
            );

            const nonceBigNumber = new BN(nonce);
            const saleContractBuySignature = soliditySha3(
                refinableerc721token_contract.address, // token
                tokenId, // tokenId
                messageValue, // price
                nonceBigNumber.toNumber() // nonce
            );
            const saleApprovalSignature = web3.eth.accounts.sign(
                saleContractBuySignature,
                account_private_keys[6]
            );

            await sale_contract.setApproveSaleDate(refinableerc721token_contract.address, tokenId, getUnixEpochTimeStamp(new Date('2021-05-30')), { from: accounts[6] })

            let thrownError;
            try {
                await sale_contract.buy(
                    refinableerc721token_contract.address, //IERC721 token,
                    tokenId, //uint256 tokenId HAS TO BE THE PASSED TOKEN ID OF A MINTED TOKEN (RefinableERC721Token)
                    accounts[6], //address payable owner, the owner of the token from who we are buying the token from
                    saleApprovalSignature.signature,
                    { from: accounts[7], value: messageValue }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'ERC721Sale.buy: Token is not open to sale yet',
            )
        });

        it("can't set sale date if not owner", async () => {
            const tokenId =
                "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c554175555"; // Randomly chosen
            await mint(accounts[6], tokenId);

            // The owner of the token has to approve the transferproxy for sale once
            await refinableerc721token_contract.setApprovalForAll(
                transferproxy_contract.address,
                true,
                { from: accounts[6] }
            );

            try {
                await sale_contract.setApproveSaleDate(refinableerc721token_contract.address, tokenId, getUnixEpochTimeStamp(new Date('2021-05-30')), { from: accounts[5] })
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Caller is not the owner of the token',
            )
        });
    });

    describe("fees", () => {
        it("fees are correctly sent to recipients & service fee recipient.", async () => {
            const tokenId = "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174623"; // Randomly chosen
            const fees = [
                {
                    recipient: accounts[0],
                    value: 10,
                },
                {
                    recipient: accounts[1],
                    value: 10,
                },
            ];
            await mint(accounts[6], tokenId, fees);

            // The owner of the token has to approve the transferproxy for sale once
            await refinableerc721token_contract.setApprovalForAll(
                transferproxy_contract.address,
                true,
                { from: accounts[6] }
            );

            const beforeBalances = [
                new BN(await web3.eth.getBalance(accounts[0])),
                new BN(await web3.eth.getBalance(accounts[1])),
            ]

            const serviceFeeRecipientBeforeBalance = new BN(await web3.eth.getBalance(accounts[5]));

            const messageValue = new BN('1025000000000000000');
            const nonce = await salenonceholder_contract.getNonce(
                refinableerc721token_contract.address,
                tokenId,
                accounts[6]
            );

            const nonceBigNumber = new BN(nonce);
            const saleContractBuySignature = soliditySha3(
                refinableerc721token_contract.address, // token
                tokenId, // tokenId
                new BN('1000000000000000000').toString(), // price
                nonceBigNumber.toNumber() // nonce
            );
            const saleApprovalSignature = web3.eth.accounts.sign(
                saleContractBuySignature,
                account_private_keys[6]
            );

            await sale_contract.setApproveSaleDate(refinableerc721token_contract.address, tokenId, getUnixEpochTimeStamp(new Date('2021-03-31')), { from: accounts[6] })

            const buyerBalanceBeforeSale = new BN(await web3.eth.getBalance(accounts[7]));
            const sellerBalanceBeforeSale = new BN(await web3.eth.getBalance(accounts[6]));

            await sale_contract.buy(
                refinableerc721token_contract.address, //IERC721 token,
                tokenId, //uint256 tokenId HAS TO BE THE PASSED TOKEN ID OF A MINTED TOKEN (RefinableERC721Token)
                accounts[6], //address payable owner, the owner of the token from who we are buying the token from
                saleApprovalSignature.signature,
                { from: accounts[7], value: messageValue.toString() }
            );

            // Owner changed
            const newOwner = await refinableerc721token_contract.ownerOf(tokenId);
            assert.equal(accounts[7], newOwner);

            const buyerServiceFeeBps = new BN(await servicefeeproxy_contract.getBuyServiceFeeBps(accounts[7], { from: accounts[1] }))
            const sellerServiceFeeBps = new BN(await servicefeeproxy_contract.getSellServiceFeeBps(accounts[6], { from: accounts[1] }))
            const tokenPrice = messageValue.mul(new BN('10000')).div(buyerServiceFeeBps.add(new BN('10000')));
            const buyerServiceFee = messageValue.sub(tokenPrice);
            const sellerServiceFee = new BN('' + tokenPrice).mul(sellerServiceFeeBps).div(new BN('10000'));
            let ownerValue = new BN('' + tokenPrice).sub(sellerServiceFee);
            
            let sumFee = new BN('0');
            for (let i = 0; i < fees.length; i++) {
                const fee = ownerValue.mul(new BN('' + fees[i].value)).div(new BN('10000'));
                const balance = new BN(await web3.eth.getBalance(fees[i].recipient));
                assert.equal(balance.sub(beforeBalances[i]).toString(), fee.toString())

                sumFee = sumFee.add(fee);
            }

            // Payment was transfered
            const buyerBalance = new BN(await web3.eth.getBalance(accounts[7]));
            const sellerBalance = new BN(await web3.eth.getBalance(accounts[6]));
            const servieFeeRecipientBalance = new BN(await web3.eth.getBalance(accounts[5]));
            
            const buyerLostBalance = buyerBalanceBeforeSale.sub(buyerBalance);
            const sellerGainedBalance = sellerBalance.sub(sellerBalanceBeforeSale);
            const serviceFeeRecipientGainedBalance = servieFeeRecipientBalance.sub(serviceFeeRecipientBeforeBalance);

            assert.equal(buyerLostBalance.cmp(messageValue), 1);
            assert.equal(sellerGainedBalance.toString(), new BN('975000000000000000').sub(sumFee).toString())
            assert.equal(serviceFeeRecipientGainedBalance.toString(), new BN('50000000000000000').toString());
        });
    });
});
