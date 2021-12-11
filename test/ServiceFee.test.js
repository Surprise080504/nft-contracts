const RefinableERC721Token = artifacts.require("RefinableERC721Token");
const RefinableToken = artifacts.require("RefinableToken");
const ERC721Sale = artifacts.require("ERC721Sale");
const TransferProxy = artifacts.require("TransferProxy");
const ServiceFeeProxy = artifacts.require("ServiceFeeProxy");
const ServiceFee = artifacts.require("ServiceFee");
const ERC721SaleNonceHolder = artifacts.require("ERC721SaleNonceHolder");
const ERC721AuctionMock = artifacts.require("ERC721AuctionMock");

const { soliditySha3, BN } = require("web3-utils");
const { account_private_keys } = require("../keys.json");

function getUnixEpochTimeStamp(value) {
    return Math.floor(value.getTime() / 1000);
}

contract("ServiceFee", (accounts) => {
    var refinableerc721token_contract;
    var transferproxy_contract;
    var servicefee_contract;
    var servicefeeproxy_contract;
    var salenonceholder_contract;
    var sale_contract;
    var refinabletoken_contract;
    let auction_contract;

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

        await RefinableToken.new({ from: accounts[1] }).then(function (instance) {
            refinabletoken_contract = instance;
        });

        await TransferProxy.new({ from: accounts[0] }).then(function (instance) {
            transferproxy_contract = instance;
        });

        await ServiceFeeProxy.new({ from: accounts[0] }).then(function (instance) {
            servicefeeproxy_contract = instance;
        });

        await ServiceFee.new({ from: accounts[0] }).then(function (instance) {
            servicefee_contract = instance;
        });

        await servicefee_contract.addProxy(servicefeeproxy_contract.address, { from: accounts[0] })
        await servicefeeproxy_contract.setServiceFeeContract(servicefee_contract.address, { from: accounts[0] })
        await servicefeeproxy_contract.setServiceFeeRecipient(accounts[5], { from: accounts[0] });
        await servicefee_contract.setRefinableTokenContract(refinabletoken_contract.address, { from: accounts[0] })

        await ERC721SaleNonceHolder.new({ from: accounts[0] }).then(function (
            instance
        ) {
            salenonceholder_contract = instance;
        });

        await ERC721Sale.new(
            transferproxy_contract.address,
            salenonceholder_contract.address,
            servicefeeproxy_contract.address,
            { from: accounts[0] }
        ).then(function (instance) {
            sale_contract = instance;
        });

        await transferproxy_contract.addOperator(sale_contract.address, {
            from: accounts[0],
        });

        await salenonceholder_contract.addOperator(sale_contract.address, {
            from: accounts[0],
        });

        await ERC721AuctionMock.new(
            refinableerc721token_contract.address,
            servicefeeproxy_contract.address,
            { from: accounts[0] }
        ).then(function (instance) {
            auction_contract = instance;
        });
    });

    describe("security", () => {
        it("can not access service fee contract from anywhere", async () => {
            let thrownError;
            try {
                await servicefee_contract.getSellServiceFeeBps(accounts[0], { from: accounts[3] });
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Ownable: caller is not the proxy',
            )
        });
        it("can access service fee contract from only proxy", async () => {
            await servicefeeproxy_contract.getSellServiceFeeBps(accounts[0], { from: accounts[3] });
        });
        it("can not add or remove proxy address in service fee contract from anywhere", async () => {
            let thrownError;
            try {
                await servicefee_contract.addProxy(accounts[0], { from: accounts[3] });
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Ownable: caller is not the admin',
            )

            try {
                await servicefee_contract.removeProxy(servicefee_contract.address, { from: accounts[3] });
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Ownable: caller is not the admin',
            )
        });
        it("only admin can add or remove the proxy address in service fee contract", async () => {
            await servicefee_contract.addProxy(servicefeeproxy_contract.address, { from: accounts[0] });
            await servicefee_contract.removeProxy(servicefeeproxy_contract.address, { from: accounts[0] });
        });
        it("can not add external address as proxy", async () => {
            let thrownError;
            try {
                await servicefee_contract.addProxy(accounts[9], { from: accounts[0] });
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'ServiceFee.addProxy: address is not a contract address',
            )
        });
        it("can not change service fee recipient address from anywhere", async () => {
            let thrownError;
            try {
                await servicefeeproxy_contract.setServiceFeeRecipient(accounts[0], { from: accounts[2] });
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Ownable: caller is not the admin',
            )
        });
        it("only admin can change the recipient address using proxy", async () => {
            await servicefee_contract.addProxy(servicefeeproxy_contract.address, { from: accounts[0] });
            await servicefeeproxy_contract.setServiceFeeRecipient(accounts[5], { from: accounts[0] });
            const serviceFeeRecipient = await servicefeeproxy_contract.getServiceFeeRecipient({ from: accounts[0] });
            assert.equal(serviceFeeRecipient, accounts[5]);
        });
    });

    describe("calculate fee", () => {
        it("works fine with existing service fee contract", async () => {
            var tokenId = "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174612";
            await mint(accounts[6], tokenId);

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
        })
        it("deploy new service fee contract", async () => {
            await ServiceFee.new({ from: accounts[0] }).then(function (instance) {
                servicefee_contract = instance;
            });
    
            await servicefee_contract.addProxy(servicefeeproxy_contract.address, { from: accounts[0] })
            await servicefeeproxy_contract.setServiceFeeContract(servicefee_contract.address, { from: accounts[0] })
            await servicefeeproxy_contract.setServiceFeeRecipient(accounts[5], { from: accounts[0] });
            await servicefee_contract.setRefinableTokenContract(refinabletoken_contract.address, { from: accounts[0] })
        });
        it("works fine with new service fee contract", async () => {
            var tokenId = "0x222222229bd51a8f1fd5a5f74e4b256513210caf2ade63cd25c7e4c654174612";
            await mint(accounts[6], tokenId);

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
        })
    })
    describe("Buyer Service Fee", () => {
        it("The buyer service fee is 250 bps as default", async () => {
            const buyerServiceFeeBps = new BN(await servicefeeproxy_contract.getBuyServiceFeeBps(accounts[9]))
            assert.equal(buyerServiceFeeBps.toString(), '250');
        })
        it("The buyer service fee is 225 bps if holds more than 100 of refinable tokens.", async () => {
            await refinabletoken_contract.transfer(accounts[9], new BN('100000000000000000000'), {from: accounts[1]});
            const buyerServiceFeeBps = new BN(await servicefeeproxy_contract.getBuyServiceFeeBps(accounts[9]))
            assert.equal(buyerServiceFeeBps.toString(), '225');
        })
        it("The buyer service fee is 200 bps if holds more than 1000 of refinable tokens.", async () => {
            await refinabletoken_contract.transfer(accounts[9], new BN('1000000000000000000000'), {from: accounts[1]});
            const buyerServiceFeeBps = new BN(await servicefeeproxy_contract.getBuyServiceFeeBps(accounts[9]))
            assert.equal(buyerServiceFeeBps.toString(), '200');
        })
        it("The buyer service fee is 175 bps if holds more than 2500 of refinable tokens.", async () => {
            await refinabletoken_contract.transfer(accounts[9], new BN('2500000000000000000000'), {from: accounts[1]});
            const buyerServiceFeeBps = new BN(await servicefeeproxy_contract.getBuyServiceFeeBps(accounts[9]))
            assert.equal(buyerServiceFeeBps.toString(), '175');
        })
        it("The buyer service fee is 150 bps if holds more than 10000 of refinable tokens.", async () => {
            await refinabletoken_contract.transfer(accounts[9], new BN('10000000000000000000000'), {from: accounts[1]});
            const buyerServiceFeeBps = new BN(await servicefeeproxy_contract.getBuyServiceFeeBps(accounts[9]))
            assert.equal(buyerServiceFeeBps.toString(), '150');
        })
    })
    describe("Sell Primary Service Fee", () => {
        it("The seller service fee is 250 bps as default", async () => {
            const sellerServiceFeeBps = new BN(await servicefeeproxy_contract.getSellServiceFeeBps(accounts[7], false))
            assert.equal(sellerServiceFeeBps.toString(), '250');
        })
        it("The seller service fee is 225 bps if holds more than 100 of refinable tokens.", async () => {
            await refinabletoken_contract.transfer(accounts[7], new BN('100000000000000000000'), {from: accounts[1]});
            const sellerServiceFeeBps = new BN(await servicefeeproxy_contract.getSellServiceFeeBps(accounts[7], false))
            assert.equal(sellerServiceFeeBps.toString(), '225');
        })
        it("The seller service fee is 200 bps if holds more than 1000 of refinable tokens.", async () => {
            await refinabletoken_contract.transfer(accounts[7], new BN('1000000000000000000000'), {from: accounts[1]});
            const sellerServiceFeeBps = new BN(await servicefeeproxy_contract.getSellServiceFeeBps(accounts[7], false))
            assert.equal(sellerServiceFeeBps.toString(), '200');
        })
    })
    describe("Sell Secondary Service Fee", () => {
        it("The seller service fee is 250 bps as default", async () => {
            const sellerServiceFeeBps = new BN(await servicefeeproxy_contract.getSellServiceFeeBps(accounts[8], true))
            assert.equal(sellerServiceFeeBps.toString(), '250');
        })
        it("The seller service fee is 225 bps if holds more than 100 of refinable tokens.", async () => {
            await refinabletoken_contract.transfer(accounts[8], new BN('100000000000000000000'), {from: accounts[1]});
            const sellerServiceFeeBps = new BN(await servicefeeproxy_contract.getSellServiceFeeBps(accounts[8], true))
            assert.equal(sellerServiceFeeBps.toString(), '225');
        })
        it("The seller service fee is 200 bps if holds more than 10,00 of refinable tokens.", async () => {
            await refinabletoken_contract.transfer(accounts[8], new BN('1000000000000000000000'), {from: accounts[1]});
            const sellerServiceFeeBps = new BN(await servicefeeproxy_contract.getSellServiceFeeBps(accounts[8], true))
            assert.equal(sellerServiceFeeBps.toString(), '200');
        })
        it("The seller service fee is 175 bps if holds more than 2500 of refinable tokens.", async () => {
            await refinabletoken_contract.transfer(accounts[8], new BN('2500000000000000000000'), {from: accounts[1]});
            const sellerServiceFeeBps = new BN(await servicefeeproxy_contract.getSellServiceFeeBps(accounts[8], true))
            assert.equal(sellerServiceFeeBps.toString(), '175');
        })
        it("The seller service fee is 175 bps if holds more than 10000 of refinable tokens.", async () => {
            await refinabletoken_contract.transfer(accounts[8], new BN('10000000000000000000000'), {from: accounts[1]});
            const sellerServiceFeeBps = new BN(await servicefeeproxy_contract.getSellServiceFeeBps(accounts[8], true))
            assert.equal(sellerServiceFeeBps.toString(), '150');
        })
    })

    describe("Complex Service Fee", () => {
        it("account 9 buys token from account 7", async () => {
            const tokenId =
                "0x222222229bd51a8f1fd5a5f74e4a256513210caa2ade63cd25c7e4c654174612"; // Randomly chosen
            await mint(accounts[7], tokenId);

            // The owner of the token has to approve the transferproxy for sale once
            await refinableerc721token_contract.setApprovalForAll(
                transferproxy_contract.address,
                true,
                { from: accounts[7] }
            );

            const messageValue = new BN('1015000000000000000');
            const nonce = await salenonceholder_contract.getNonce(
                refinableerc721token_contract.address,
                tokenId,
                accounts[7]
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
                account_private_keys[7]
            );

            const buyerBalanceBeforeSale = new BN(await web3.eth.getBalance(accounts[9]));
            const sellerBalanceBeforeSale = new BN(await web3.eth.getBalance(accounts[7]));
            const serviceFeeRecipientBeforeBalance = new BN(await web3.eth.getBalance(accounts[5]));

            await sale_contract.buy(
                refinableerc721token_contract.address, //IERC721 token,
                tokenId, //uint256 tokenId HAS TO BE THE PASSED TOKEN ID OF A MINTED TOKEN (RefinableERC721Token)
                accounts[7], //address payable owner, the owner of the token from who we are buying the token from
                saleApprovalSignature.signature,
                { from: accounts[9], value: messageValue.toString() }
            );

            const buyerBalance = new BN(await web3.eth.getBalance(accounts[9]));
            const sellerBalance = new BN(await web3.eth.getBalance(accounts[7]));
            const servieFeeRecipientBalance = new BN(await web3.eth.getBalance(accounts[5]));

            const buyerLostBalance = buyerBalanceBeforeSale.sub(buyerBalance);
            const sellerGainedBalance = sellerBalance.sub(sellerBalanceBeforeSale);
            const serviceFeeRecipientGainedBalance = servieFeeRecipientBalance.sub(serviceFeeRecipientBeforeBalance);

            assert.equal(buyerLostBalance.cmp(messageValue), 1);
            assert.equal(sellerGainedBalance.toString(), new BN('980000000000000000').toString())
            assert.equal(serviceFeeRecipientGainedBalance.toString(), new BN('35000000000000000').toString());
        })

        it("account 8 get the token from account 9 with auction", async () => {
            const tokenId =
                "0x222222229bd51a8f1fd5a5f74e4a256513210caa2ade63cd25c7e4c654174612";
            await refinableerc721token_contract.setApprovalForAll(
                auction_contract.address,
                true,
                { from: accounts[9] }
            );
            await auction_contract.createAuction(
                tokenId,
                0,
                new BN('0'),
                new BN('1716922014'),
                { from: accounts[9] }
            );

            //Bidding
            const bids = [
                {
                    from: accounts[8],
                    value: new BN('1015000000000000000'),
                },
            ];

            for(let i = 0; i < bids.length; i++) {
                await auction_contract.placeBid(
                    tokenId,
                    bids[i]
                );
            }

            const OwnerBeforeBalance = new BN(await web3.eth.getBalance(accounts[9]))
            const serviceFeeRecipientBeforeBalance = new BN(await web3.eth.getBalance(accounts[5]))

            //manipulate auction contract time
            await auction_contract.setBlockTimeStamp('1816922014', {from: accounts[0]});

            //finish auction
            const receipt = await auction_contract.endAuction(tokenId, {from: accounts[9]});
            const tx = await web3.eth.getTransaction(receipt.tx);
            const gasFee = new BN(receipt.receipt.gasUsed).mul(new BN(tx.gasPrice));
            
            //Calculate balance of token owner and service fee recipient
            const OwnereBalance = new BN(await web3.eth.getBalance(accounts[9]))
            const serviceFeeRecipientBalance = new BN(await web3.eth.getBalance(accounts[5]))

            assert.equal(OwnereBalance.sub(OwnerBeforeBalance).add(gasFee).toString(), new BN('985000000000000000').toString())
            assert.equal(serviceFeeRecipientBalance.sub(serviceFeeRecipientBeforeBalance).toString(), new BN('30000000000000000').toString())
        })
    })
})
