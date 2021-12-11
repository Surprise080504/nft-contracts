const RefinableERC721Token = artifacts.require("RefinableERC721Token");
const RefinableToken = artifacts.require("RefinableToken");
const ERC721AuctionMock = artifacts.require("ERC721AuctionMock");
const ServiceFeeProxy = artifacts.require("ServiceFeeProxy");
const ServiceFee = artifacts.require("ServiceFee");

const { soliditySha3, BN } = require("web3-utils");
const { account_private_keys } = require("../keys.json");

contract("ERC721Auction", (accounts) => {
    var refinableerc721token_contract;
    var auction_contract;
    var servicefee_contract;
    var servicefeeproxy_contract;
    var refinabletoken_contract;
    const tokenId = "0x222222229bd51a8f1fd5a5f74e4a256513210caf2ade63cd25c7e4c654174612"; // Randomly chosen
    const startBidPrice = new BN('100000000000000000');

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

        await RefinableToken.new({ from: accounts[0] }).then(function (instance) {
            refinabletoken_contract = instance;
        });

        await ServiceFee.new({ from: accounts[0] }).then(function (instance) {
            servicefee_contract = instance;
        });

        await ServiceFeeProxy.new({ from: accounts[0] }).then(function (instance) {
            servicefeeproxy_contract = instance;
        });

        await servicefee_contract.addProxy(servicefeeproxy_contract.address, { from: accounts[0] })
        await servicefeeproxy_contract.setServiceFeeContract(servicefee_contract.address, { from: accounts[0] })
        await servicefeeproxy_contract.setServiceFeeRecipient(accounts[4], { from: accounts[0] })
        await servicefee_contract.setRefinableTokenContract(refinabletoken_contract.address, { from: accounts[0] })

        await ERC721AuctionMock.new(
            refinableerc721token_contract.address,
            servicefeeproxy_contract.address,
            { from: accounts[0] }
        ).then(function (instance) {
            auction_contract = instance;
        });
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

    describe("auction", () => {
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
            await refinableerc721token_contract.setApprovalForAll(
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
                'Auction.createAuction: Caller is not the owner',
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
            let auctionInfo = await auction_contract.getAuction(tokenId);

            assert.equal(auctionInfo.owner, accounts[1]);
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
                bids[0]
            );

            let thrownError;
            try {
                await auction_contract.placeBid(
                    tokenId,
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
                    bids[i]
                );

                //Auction End time is increased because bid time is more than 5 mins before end time
                let auctionInfo = await auction_contract.getAuction(tokenId);
                assert.equal(auctionInfo.endTime, auctionOriginEndTime.add(new BN(300 * (i + 1))))

                const tx = await web3.eth.getTransaction(receipt.tx);
                const gasFee = new BN(receipt.receipt.gasUsed).mul(new BN(tx.gasPrice));
                bids[i].gasFee = gasFee;
            }

            auctionOriginEndTime = auctionOriginEndTime.add(new BN(300 * 3));

            for(let i = 3; i < bids.length; i++) {
                await auction_contract.setBlockTimeStamp(bidTimes[i], {from: accounts[0]});
                const receipt = await auction_contract.placeBid(
                    tokenId,
                    bids[i]
                );

                //Auction End time is not increased because bid time is no more than 5 mins before end time
                let auctionInfo = await auction_contract.getAuction(tokenId);
                assert.equal(auctionInfo.endTime, auctionOriginEndTime);

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

        it("withdraw bid not working if caller is not the bidder", async () => {
            let thrownError;
            try {
                await auction_contract.withdrawBid(tokenId, {from: accounts[2]});
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.withdrawBid: Caller is not the bidder',
            )
        });
        it("withdraw bid not working until auction ends", async () => {
            let thrownError;
            try {
                await auction_contract.withdrawBid(tokenId, {from: accounts[8]});
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.withdrawBid: Cannot withdraw until auction ends',
            )
        });
        it("withdraw bid", async () => {
            await auction_contract.setBlockTimeStamp('1816922014', {from: accounts[0]});
            const beforeBalance = new BN(await web3.eth.getBalance(accounts[8]))
            const receipt =  await auction_contract.withdrawBid(tokenId, {from: accounts[8]});
            const tx = await web3.eth.getTransaction(receipt.tx);
            const gasFee = new BN(receipt.receipt.gasUsed).mul(new BN(tx.gasPrice));
            const balance = new BN(await web3.eth.getBalance(accounts[8]))
            assert.equal(balance.sub(beforeBalance).add(gasFee).toString(), new BN('925000000000000000').toString());
        });
        
        it("result auction is not working if caller is not the owner or admin", async () => {
            let thrownError;
            try {
                await auction_contract.endAuction(tokenId, {from: accounts[9]});
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.endAuction: only admin or auction owner can result the auction',
            )
        });
        it("result auction is not working if it is before end time", async () => {
            await auction_contract.setBlockTimeStamp('0', {from: accounts[0]});
            let thrownError;
            try {
                await auction_contract.endAuction(tokenId, {from: accounts[1]});
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
            const receipt = await auction_contract.endAuction(tokenId, {from: accounts[1]});
            const tx = await web3.eth.getTransaction(receipt.tx);
            const gasFee = new BN(receipt.receipt.gasUsed).mul(new BN(tx.gasPrice));

            //Token transfered correctly
            assert.equal(await refinableerc721token_contract.ownerOf(tokenId, {from: accounts[0]}), accounts[9]);
            
            //Calculate balance of token owner and service fee recipient
            const OwnereBalance = new BN(await web3.eth.getBalance(accounts[1]))
            const serviceFeeRecipientBalance = new BN(await web3.eth.getBalance(accounts[4]))

            assert.equal(OwnereBalance.sub(OwnerBeforeBalance).add(gasFee).toString(), new BN('975000000000000000').toString())
            assert.equal(serviceFeeRecipientBalance.sub(serviceFeeRecipientBeforeBalance).toString(), new BN('50000000000000000').toString())
        });
        it("result auction again", async () => {
            let thrownError;
            try {
                await auction_contract.endAuction(tokenId, {from: accounts[1]});
            } catch (error) {
                thrownError = error;
            }

            assert.include(
                thrownError.message,
                'Auction.onlyCreatedAuction: Auction does not exist',
            )
        });
        it("cancel auction", async () => {
            await refinableerc721token_contract.setApprovalForAll(
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
                assert.equal(beforeBalances[i].sub(bids[i].value).sub(bids[i].gasFee).toString(), afterBalances[i].toString())
            }

            await auction_contract.cancelAuction(tokenId, {from: accounts[0]});

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
});
