const RefinableERC1155Token = artifacts.require("RefinableERC1155Token");
const RefinableToken = artifacts.require("RefinableToken");
const ERC1155AuctionMock = artifacts.require("ERC1155AuctionMock");
const ServiceFeeProxy = artifacts.require("ServiceFeeProxy");
const ServiceFee = artifacts.require("ServiceFee");
const ERC1155SaleNonceHolder = artifacts.require("ERC1155SaleNonceHolder");
const ERC1155Sale = artifacts.require("ERC1155Sale");
const TransferProxy = artifacts.require("TransferProxy");

const { soliditySha3, BN } = require("web3-utils");
const { account_private_keys } = require("../keys.json");

function getUnixEpochTimeStamp(value) {
    return Math.floor(value.getTime() / 1000);
}

contract("ERC1155Auction", (accounts) => {
    var refinableerc1155token_contract;
    var auction_contract;
    var servicefee_contract;
    var servicefeeproxy_contract;
    var refinabletoken_contract;
    const tokenId = "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174612"; // Randomly chosen
    const startBidPrice = new BN('100000000000000000');

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

        await RefinableToken.new({ from: accounts[0] }).then(function (instance) {
            refinabletoken_contract = instance;
        });

        await ServiceFee.new({ from: accounts[0] }).then(function (instance) {
            servicefee_contract = instance;
        });

        await ServiceFeeProxy.new({ from: accounts[0] }).then(function (instance) {
            servicefeeproxy_contract = instance;
        });

        await TransferProxy.new({ from: accounts[0] }).then(function (instance) {
            transferproxy_contract = instance;
        });

        await servicefee_contract.addProxy(servicefeeproxy_contract.address, { from: accounts[0] })
        await servicefeeproxy_contract.setServiceFeeContract(servicefee_contract.address, { from: accounts[0] })
        await servicefeeproxy_contract.setServiceFeeRecipient(accounts[4], { from: accounts[0] })
        await servicefee_contract.setRefinableTokenContract(refinabletoken_contract.address, { from: accounts[0] })

        await ERC1155AuctionMock.new(
            refinableerc1155token_contract.address,
            servicefeeproxy_contract.address,
            { from: accounts[0] }
        ).then(function (instance) {
            auction_contract = instance;
        });

        await ERC1155SaleNonceHolder.new({ from: accounts[0] }).then(function (
            instance
        ) {
            salenonceholder_contract = instance;
        });

        await ERC1155Sale.new(
            transferproxy_contract.address,
            salenonceholder_contract.address,
            servicefeeproxy_contract.address,
            { from: accounts[0] }
        ).then(function (instance) {
            sale_contract = instance;
        });

        // The admin of sale_contract set in OperatorRole of TransferProxy
        // Has to add the sale contract as an operator because the sale contract calls erc721safeTransferFrom on TransferProxy
        await transferproxy_contract.addOperator(sale_contract.address, {
            from: accounts[0],
        });
        await salenonceholder_contract.addOperator(sale_contract.address, {
            from: accounts[0],
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

    describe("auction with single token", () => {
        it("creating auction not working if caller has not approved", async () => {
            await mint(accounts[1], tokenId);
            let thrownError;
            try {
                await auction_contract.createAuction(
                    tokenId,
                    startBidPrice,
                    '0',
                    '1716922014',
                    { from: accounts[1] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.createAuction: Owner has not approved',
            )
        });
        it("creating auction not working if caller is not the owner of the token", async () => {
            await refinableerc1155token_contract.setApprovalForAll(
                auction_contract.address,
                true,
                { from: accounts[1] }
            );

            let thrownError;
            try {
                await auction_contract.createAuction(
                    tokenId,
                    startBidPrice,
                    '0',
                    '1716922014',
                    { from: accounts[2] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.createAuction: Caller does not have the token',
            )
        });
        it("creating auction not working if end time is before now", async () => {
            let thrownError;
            try {
                await auction_contract.createAuction(
                    tokenId,
                    startBidPrice,
                    '0',
                    '1',
                    { from: accounts[1] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.createAuction: End time passed. Nobody can bid',
            )
        });
        it("creating auction not working if end time smaller than start time", async () => {
            let thrownError;
            try {
                await auction_contract.createAuction(
                    tokenId,
                    startBidPrice,
                    '1',
                    '0',
                    { from: accounts[1] }
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.createAuction: End time must be greater than start',
            )
        });
        it("creating auction is working fine with all correct info", async () => {
            //create Auction
            await auction_contract.createAuction(
                tokenId,
                startBidPrice,
                '0',
                '1716922014',
                { from: accounts[1] }
            );

            //Auction Created Correctly
            let auctionInfo = await auction_contract.getAuction(tokenId, accounts[1]);

            assert.equal(auctionInfo.startTime, new BN('0'));
            assert.equal(auctionInfo.endTime, new BN('1716922014'));
        });
        it("bid amount should be higer than start bid price", async () => {
            const bid = {
                from: accounts[2],
                value: new BN('25000000000000000'),
            };

            let thrownError;
            try {
                await auction_contract.placeBid(
                    tokenId,
                    accounts[1],
                    bid
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.placeBid: Bid amount should be higher than start price',
            )
        });
        it("bid amount should be min bid incremental amount higher than prev bid amount", async () => {
            const bids = [
                {
                    from: accounts[2],
                    value: new BN('325000000000000000'),
                },
                {
                    from: accounts[3],
                    value: new BN('334000000000000000'),
                },
            ]
            await auction_contract.placeBid(
                tokenId,
                accounts[1],
                bids[0]
            );

            let thrownError;
            try {
                await auction_contract.placeBid(
                    tokenId,
                    accounts[1],
                    bids[1]
                );
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.placeBid: Failed to outbid highest bidder',
            )
        });
        it("working bid", async () => {
            //Bidding
            const bids = [
                {
                    from: accounts[5],
                    value: new BN('625000000000000000'),
                },
                {
                    from: accounts[6],
                    value: new BN('725000000000000000'),
                },
                {
                    from: accounts[7],
                    value: new BN('825000000000000000'),
                },
                {
                    from: accounts[8],
                    value: new BN('925000000000000000'),
                },
                {
                    from: accounts[9],
                    value: new BN('1025000000000000000'),
                },
            ];

            const bidTimes = [
                '1716922000',
                '1716922300',
                '1716922600',
                '1716922600',
                '1716922600',
            ]

            let auctionOriginEndTime = new BN('1716922014');

            const beforeBalances = [
                new BN(await web3.eth.getBalance(accounts[5])),
                new BN(await web3.eth.getBalance(accounts[6])),
                new BN(await web3.eth.getBalance(accounts[7])),
                new BN(await web3.eth.getBalance(accounts[8])),
                new BN(await web3.eth.getBalance(accounts[9])),
            ]

            for(let i = 0; i < 3; i++) {
                await auction_contract.setBlockTimeStamp(bidTimes[i], {from: accounts[0]});
                const receipt = await auction_contract.placeBid(
                    tokenId,
                    accounts[1],
                    bids[i]
                );

                //Auction End time is increased because bid time is more than 5 mins before end time
                let auctionInfo = await auction_contract.getAuction(tokenId, accounts[1]);
                assert.equal(auctionInfo.endTime, auctionOriginEndTime.add(new BN(300 * (i + 1))).toString())

                const tx = await web3.eth.getTransaction(receipt.tx);
                const gasFee = new BN(receipt.receipt.gasUsed).mul(new BN(tx.gasPrice));
                bids[i].gasFee = gasFee;
            }

            auctionOriginEndTime = auctionOriginEndTime.add(new BN(300 * 3));

            for(let i = 3; i < bids.length; i++) {
                await auction_contract.setBlockTimeStamp(bidTimes[i], {from: accounts[0]});
                const receipt = await auction_contract.placeBid(
                    tokenId,
                    accounts[1],
                    bids[i]
                );

                //Auction End time is not increased because bid time is no more than 5 mins before end time
                let auctionInfo = await auction_contract.getAuction(tokenId, accounts[1]);
                assert.equal(auctionInfo.endTime, auctionOriginEndTime.toString());

                const tx = await web3.eth.getTransaction(receipt.tx);
                const gasFee = new BN(receipt.receipt.gasUsed).mul(new BN(tx.gasPrice));
                bids[i].gasFee = gasFee;
            }

            //Bidding works correctly
            const afterBalances = [
                new BN(await web3.eth.getBalance(accounts[5])),
                new BN(await web3.eth.getBalance(accounts[6])),
                new BN(await web3.eth.getBalance(accounts[7])),
                new BN(await web3.eth.getBalance(accounts[8])),
                new BN(await web3.eth.getBalance(accounts[9])),
            ]

            for(let i = 0; i < 2; i++) {
                assert.equal(beforeBalances[i].sub(bids[i].gasFee).toString(), afterBalances[i].toString())
            }

            for(let i = 2; i < bids.length; i++) {
                assert.equal(beforeBalances[i].sub(bids[i].value).sub(bids[i].gasFee).toString(), afterBalances[i])
            }
        })
        it("withdraw bid not working if call is not the bidder", async () => {
            let thrownError;
            try {
                await auction_contract.withdrawBid(tokenId, accounts[1], {from: accounts[4]});
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.withdrawBid: Caller is not the bidder',
            )
        });
        it("withdraw bid not working until lock time has passed", async () => {
            let thrownError;
            try {
                await auction_contract.withdrawBid(tokenId, accounts[1], {from: accounts[8]});
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.withdrawBid: Cannot withdraw until auction ends',
            )
        });
        it("withdraw bid", async () => {
            await auction_contract.setBlockTimeStamp('1806922014', {from: accounts[0]});
            const beforeBalance = new BN(await web3.eth.getBalance(accounts[8]))
            const receipt =  await auction_contract.withdrawBid(tokenId, accounts[1], {from: accounts[8]});
            const tx = await web3.eth.getTransaction(receipt.tx);
            const gasFee = new BN(receipt.receipt.gasUsed).mul(new BN(tx.gasPrice));
            const balance = new BN(await web3.eth.getBalance(accounts[8]))
            assert.equal(balance.sub(beforeBalance).add(gasFee).toString(), new BN('925000000000000000').toString());
        });
        it("result auction is not working if caller is not the owner or admin", async () => {
            let thrownError;
            try {
                await auction_contract.endAuction(tokenId, accounts[1], {from: accounts[9]});
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.endAuction: Only admin or auction owner can result the auction',
            )
        });
        it("result auction is not working if it is before end time", async () => {
            await auction_contract.setBlockTimeStamp('0', {from: accounts[0]});
            let thrownError;
            try {
                await auction_contract.endAuction(tokenId, accounts[1], {from: accounts[1]});
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.endAuction: The auction has not ended',
            )
        });
        it("result auction", async () => {
            const OwnerBeforeBalance = new BN(await web3.eth.getBalance(accounts[1]))
            const serviceFeeRecipientBeforeBalance = new BN(await web3.eth.getBalance(accounts[4]))

            //manipulate auction contract time
            await auction_contract.setBlockTimeStamp('1816922014', {from: accounts[0]});

            //finish auction
            const receipt = await auction_contract.endAuction(tokenId, accounts[1], {from: accounts[1]});
            const tx = await web3.eth.getTransaction(receipt.tx);
            const gasFee = new BN(receipt.receipt.gasUsed).mul(new BN(tx.gasPrice));

            //Token transfered correctly
            assert.equal(await refinableerc1155token_contract.balanceOf(accounts[9], tokenId), 1);
            
            //Calculate balance of token owner and service fee recipient
            const OwnereBalance = new BN(await web3.eth.getBalance(accounts[1]))
            const serviceFeeRecipientBalance = new BN(await web3.eth.getBalance(accounts[4]))

            assert.equal(OwnereBalance.sub(OwnerBeforeBalance).add(gasFee).toString(), new BN('975000000000000000').toString())
            assert.equal(serviceFeeRecipientBalance.sub(serviceFeeRecipientBeforeBalance).toString(), new BN('50000000000000000').toString())
        });
        it("result auction again", async () => {
            let thrownError;
            try {
                await auction_contract.endAuction(tokenId, accounts[1], {from: accounts[1]});
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.onlyCreatedAuction: Auction does not exist',
            )
        });
        it("cancel auction", async () => {
            await refinableerc1155token_contract.setApprovalForAll(
                auction_contract.address,
                true,
                { from: accounts[9] }
            );
            
            await auction_contract.createAuction(
                tokenId,
                startBidPrice,
                '0',
                '1916922014',
                { from: accounts[9] }
            );

            const bids = [
                {
                    from: accounts[5],
                    value: new BN('625000000000000000'),
                },
                {
                    from: accounts[6],
                    value: new BN('725000000000000000'),
                },
                {
                    from: accounts[7],
                    value: new BN('825000000000000000'),
                },
                {
                    from: accounts[8],
                    value: new BN('925000000000000000'),
                },
            ];

            const beforeBalances = [
                new BN(await web3.eth.getBalance(accounts[5])),
                new BN(await web3.eth.getBalance(accounts[6])),
                new BN(await web3.eth.getBalance(accounts[7])),
                new BN(await web3.eth.getBalance(accounts[8])),
            ]

            for(let i = 0; i < bids.length; i++) {
                const receipt = await auction_contract.placeBid(
                    tokenId,
                    accounts[9],
                    bids[i]
                );
                const tx = await web3.eth.getTransaction(receipt.tx);
                const gasFee = new BN(receipt.receipt.gasUsed).mul(new BN(tx.gasPrice));
                bids[i].gasFee = gasFee;
            }

            //Bidding works correctly
            let afterBalances = [
                new BN(await web3.eth.getBalance(accounts[5])),
                new BN(await web3.eth.getBalance(accounts[6])),
                new BN(await web3.eth.getBalance(accounts[7])),
                new BN(await web3.eth.getBalance(accounts[8])),
            ]

            for(let i = 0; i < 1; i++) {
                assert.equal(beforeBalances[i].sub(bids[i].gasFee).toString(), afterBalances[i].toString())
            }

            for(let i = 1; i < bids.length; i++) {
                assert.equal(beforeBalances[i].sub(bids[i].value).sub(bids[i].gasFee).toString(), afterBalances[i])
            }

            await auction_contract.cancelAuction(tokenId, accounts[9], {from: accounts[0]});

            afterBalances = [
                new BN(await web3.eth.getBalance(accounts[5])),
                new BN(await web3.eth.getBalance(accounts[6])),
                new BN(await web3.eth.getBalance(accounts[7])),
                new BN(await web3.eth.getBalance(accounts[8])),
            ]

            for(let i = 2; i < bids.length; i++) {
                assert.equal(beforeBalances[i].sub(afterBalances[i]).toString(), bids[i].gasFee.toString())
            }
        });
    });
    describe("auction with multiple tokens", () => {
        it("working with multiple tokens", async () => {

            //Mint and sell
            const tokenId = "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174656"; // Randomly chosen
            await mint(accounts[1], tokenId, 2);
            await refinableerc1155token_contract.setApprovalForAll(
                transferproxy_contract.address,
                true,
                { from: accounts[1] }
            );
            const messageValue = new BN('1025000000000000000');
            const nonce = await salenonceholder_contract.getNonce(
                refinableerc1155token_contract.address,
                tokenId,
                accounts[1]
            );
            const saleContractBuySignature = soliditySha3(
                refinableerc1155token_contract.address, // token
                tokenId, // tokenId
                new BN('1000000000000000000'), // price
                2, // sellingAmount #
                nonce // nonce
            );
            const saleApprovalSignature = web3.eth.accounts.sign(
                saleContractBuySignature,
                account_private_keys[1],
            );
            
            await sale_contract.buy(
                refinableerc1155token_contract.address, //IERC1155 token,
                tokenId, //uint256 tokenId HAS TO BE THE PASSED TOKEN ID OF A MINTED TOKEN (RefinableERC1155Token)
                accounts[1], //address payable owner, the owner of the token from who we are buyingAmount the token from
                2, // sellingAmount
                1, // buyingAmount
                saleApprovalSignature.signature, //signature
                { from: accounts[2], value: messageValue.toString() }
            );

            //Owner do auction with remaining token
            await refinableerc1155token_contract.setApprovalForAll(
                auction_contract.address,
                true,
                { from: accounts[1] }
            );
            await auction_contract.setBlockTimeStamp('0', {from: accounts[0]});
            await auction_contract.createAuction(
                tokenId,
                startBidPrice,
                '0',
                '1716922014',
                { from: accounts[1] }
            );
            let bids = [
                {
                    from: accounts[5],
                    value: new BN('625000000000000000'),
                },
                {
                    from: accounts[6],
                    value: new BN('1025000000000000000'),
                },
            ];
            let beforeBalances = [
                new BN(await web3.eth.getBalance(accounts[5])),
                new BN(await web3.eth.getBalance(accounts[6])),
            ]
            for(let i = 0; i < bids.length; i++) {
                const receipt = await auction_contract.placeBid(
                    tokenId,
                    accounts[1],
                    bids[i]
                );
                const tx = await web3.eth.getTransaction(receipt.tx);
                const gasFee = new BN(receipt.receipt.gasUsed).mul(new BN(tx.gasPrice));
                bids[i].gasFee = gasFee;
            }
            //Bidding works correctly
            let afterBalances = [
                new BN(await web3.eth.getBalance(accounts[5])),
                new BN(await web3.eth.getBalance(accounts[6])),
            ]

            for(let i = 0; i < bids.length; i++) {
                assert.equal(beforeBalances[i].sub(bids[i].value).sub(bids[i].gasFee).toString(), afterBalances[i])
            }

            let OwnerBeforeBalance = new BN(await web3.eth.getBalance(accounts[1]))
            let serviceFeeRecipientBeforeBalance = new BN(await web3.eth.getBalance(accounts[4]))

            //manipulate auction contract time
            await auction_contract.setBlockTimeStamp('1816922014', {from: accounts[0]});

            //finish auction
            let receipt = await auction_contract.endAuction(tokenId, accounts[1], {from: accounts[1]});
            let tx = await web3.eth.getTransaction(receipt.tx);
            let gasFee = new BN(receipt.receipt.gasUsed).mul(new BN(tx.gasPrice));

            //Token transfered correctly
            assert.equal(await refinableerc1155token_contract.balanceOf(accounts[6], tokenId), 1);
            
            //Calculate balance of token owner and service fee recipient
            let OwnereBalance = new BN(await web3.eth.getBalance(accounts[1]))
            let serviceFeeRecipientBalance = new BN(await web3.eth.getBalance(accounts[4]))

            assert.equal(OwnereBalance.sub(OwnerBeforeBalance).add(gasFee).toString(), new BN('975000000000000000').toString())
            assert.equal(serviceFeeRecipientBalance.sub(serviceFeeRecipientBeforeBalance).toString(), new BN('50000000000000000').toString())

            //Buyer do auction with bought token
            await refinableerc1155token_contract.setApprovalForAll(
                auction_contract.address,
                true,
                { from: accounts[2] }
            );

            await auction_contract.setBlockTimeStamp('0', {from: accounts[0]});
            
            await auction_contract.createAuction(
                tokenId,
                startBidPrice,
                '0',
                '1716922014',
                { from: accounts[2] }
            );

            bids = [
                {
                    from: accounts[7],
                    value: new BN('625000000000000000'),
                },
                {
                    from: accounts[8],
                    value: new BN('1025000000000000000'),
                },
            ];

            beforeBalances = [
                new BN(await web3.eth.getBalance(accounts[7])),
                new BN(await web3.eth.getBalance(accounts[8])),
            ]

            for(let i = 0; i < bids.length; i++) {
                const receipt = await auction_contract.placeBid(
                    tokenId,
                    accounts[2],
                    bids[i]
                );
                const tx = await web3.eth.getTransaction(receipt.tx);
                const gasFee = new BN(receipt.receipt.gasUsed).mul(new BN(tx.gasPrice));
                bids[i].gasFee = gasFee;
            }

            //Bidding works correctly
            afterBalances = [
                new BN(await web3.eth.getBalance(accounts[7])),
                new BN(await web3.eth.getBalance(accounts[8])),
            ]

            for(let i = 0; i < bids.length; i++) {
                assert.equal(beforeBalances[i].sub(bids[i].value).sub(bids[i].gasFee).toString(), afterBalances[i])
            }

            OwnerBeforeBalance = new BN(await web3.eth.getBalance(accounts[2]))
            serviceFeeRecipientBeforeBalance = new BN(await web3.eth.getBalance(accounts[4]))

            //manipulate auction contract time
            await auction_contract.setBlockTimeStamp('1816922014', {from: accounts[0]});

            //finish auction
            receipt = await auction_contract.endAuction(tokenId, accounts[2], {from: accounts[2]});
            tx = await web3.eth.getTransaction(receipt.tx);
            gasFee = new BN(receipt.receipt.gasUsed).mul(new BN(tx.gasPrice));

            //Token transfered correctly
            assert.equal(await refinableerc1155token_contract.balanceOf(accounts[8], tokenId), 1);
            
            //Calculate balance of token owner and service fee recipient
            OwnereBalance = new BN(await web3.eth.getBalance(accounts[2]))
            serviceFeeRecipientBalance = new BN(await web3.eth.getBalance(accounts[4]))

            assert.equal(OwnereBalance.sub(OwnerBeforeBalance).add(gasFee).toString(), new BN('975000000000000000').toString())
            assert.equal(serviceFeeRecipientBalance.sub(serviceFeeRecipientBeforeBalance).toString(), new BN('50000000000000000').toString())
        });
    })
});
