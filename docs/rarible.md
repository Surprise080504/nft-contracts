# Rarible

- Create (not connected, not authorized)

  - Create Single
  - Fill in details and click create item
  - Connect your wallet
  - Back to create collectible (had to click it manually)
  - Continue modal
  - Click continue
  - click create item
  - nft deploying modal (Uploading files)
    - it created a nonce (i think this is generated before minting in order to use `sendSignedTransaction`): https://web3js.readthedocs.io/en/v1.2.9/web3-eth.html#signtransaction
      NOTICE: These values are all generated!! The owner is supposed to sign the tokenId with the r,s,v value
    ```
    {
        r: "0xd30589f2cd0e38a4febd51339409298c6ac3db1bb2c4fbc14116e5d98d5232a4"
        s: "0x52f4189fb5bb211f677e2b90e4de4cbc7135d5f19fa0b97503dd79e67f5f96ef"
        v: 28
        value: 71136
    }
    ```
    - in the background it's now uploading my files to pinata.rarible.com
    ```
    {
        IpfsHash: "QmU1GC83r9p7B2VGSzUZt5EZRgBe35sxCqMM3HdP1jyR6J"
        PinSize: 47677
        Timestamp: "2020-11-26T06:45:24.366Z"
    }
    ```
  - click: Mint token (so it's the user who creates the token himself)

    - Contract interaction request from metamask

    ```
    0x672a940000000000000000000000000000000000000000000000000000000000000115e0000000000000000000000000000000000000000000000000000000000000001cd30589f2cd0e38a4febd51339409298c6ac3db1bb2c4fbc14116e5d98d5232a452f4189fb5bb211f677e2b90e4de4cbc7135d5f19fa0b97503dd79e67f5f96ef00000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000000010000000000000000000000002942b38f037b16df326bec3a4fe2ff65cef5aa0300000000000000000000000000000000000000000000000000000000000003e800000000000000000000000000000000000000000000000000000000000000342f697066732f516d55515270515053344d777851737772695463506f6f52414363537a48596779626e7231557536666b317a3171000000000000000000000000
    ```

    I suspect (very sure actually) it's mint, because it looks like:

    ```
    0x672a940000000000000000000000000000000000000000000000000000000000000115b7000000000000000000000000000000000000000000000000000000000000001bd7291f63d1d6225f8a0a4974eb1dc759600b0df8e23754fabfebc6650972e8d46be7e8df8fafd0b642a8a017b3ff0246c714b494c7b4024487448bb37702f5d300000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000000010000000000000000000000009fb83c3626620ea39f770a8fe2ae217db97ac0540000000000000000000000000000000000000000000000000000000000000ce400000000000000000000000000000000000000000000000000000000000000342f697066732f516d516a7355394e516b50426b594a536f56446e545050527661586e6547577a506e5847357475685361594c664d000000000000000000000000
    ```

    which has args:

    ```
    Function: mint(uint256, uint8, bytes32, bytes32, (address,uint256)[], string)
    #	Name	        Type	    Data
    1	tokenId	        uint256	    71095
    3	r	            bytes32	    0xd7291f63d1d6225f8a0a4974eb1dc759600b0df8e23754fabfebc6650972e8d4
    4	s	            bytes32	    0x6be7e8df8fafd0b642a8a017b3ff0246c714b494c7b4024487448bb37702f5d3
    4	_fees.recipient	address	    0x9fB83C3626620Ea39F770a8fe2Ae217DB97ac054
    4	_fees.value	    uint256	    3300
    6	tokenURI	    string	    /ipfs/QmQjsU9NQkPBkYJSoVDnTPPRvaXneGWzPnXG5tuhSaYLfM
    ```

    - tokenId: id of the nFT: https://etherscan.io/token/0x60f80121c31a0d46b5279700f9df786054aa5ee5?a=71095
    - \_fees.recipient: the contract creator (so me)
    - r: x-coordinate of the random curve point (get them from the nonce response and send to mint)
    - s: y-coordinate, depends on r but never used (get them from the nonce response and send to mint)

    so we can also see that the tokenId is the nonce in this case

    explanation for the `ecrecover`

    - https://coders-errand.com/ecrecover-signature-verification-ethereum/
    - https://medium.com/@yaoshiang/ethereums-ecrecover-openzeppelin-s-ecdsa-and-web3-s-sign-8ff8d16595e1

* Buying:

  - Click "Buy Now"
    - Modal Opens with summary, your balance, service fee and you will pay.
  - Click "Proceed to payment"
    - it did a request to purchase service
      - ERC721
    ```json
    {
      "token": "0x60f80121c31a0d46b5279700f9df786054aa5ee5",
      "tokenId": "49022",
      "assetType": "ERC721",
      "owner": "0x0e899c117108656887790caa4b4a44d263993245",
      "salt": {
        "value": "11015232012527405026147581717439959250891068480556067710335452631623469862839",
        "type": "SALT"
      },
      "buyValue": 0.0004,
      "buyToken": "0x0000000000000000000000000000000000000000",
      "buyTokenId": "0",
      "buyAssetType": "ETH",
      "value": 1,
      "signature": "0xa74442bdec40a00885400b8126059adad6b9bd7c9b25d9bb0aea11afa26f9d3d701a865a78d4541556f7b8e1718f62a95b6ade701b27770df0f68b87c7acfe861c",
      "createDate": "2020-12-05T07:27:14.693+00:00",
      "contractVersion": 2,
      "fee": 250,
      "sellPriceEth": 0.0004,
      "id": "0x60f80121c31a0d46b5279700f9df786054aa5ee5:49022:0x0e899c117108656887790caa4b4a44d263993245:0x0000000000000000000000000000000000000000:0",
      "buyPrice": 2.5e3,
      "sellPrice": 0.0004
    }
    ```
    - ERC1155
    ```json
    {
      blacklisted: false
      buyToken: "0x0000000000000000000000000000000000000000"
      buyTokenId: "0"
      categories: ["art"]
      creator: "0x56610aeee7a6f5ead02c6833a95cdbbdac7e17d9"
      date: "2020-12-06T19:26:17.000+00:00"
      id: "0xd07dc4262bcdbf85190c01c996b4c06a461d2430:61433:0x56610aeee7a6f5ead02c6833a95cdbbdac7e17d9"
      likes: 31
      offer: null
      orderId: "0xd07dc4262bcdbf85190c01c996b4c06a461d2430:61433:0x56610aeee7a6f5ead02c6833a95cdbbdac7e17d9:0x0000000000000000000000000000000000000000:0"
      owner: "0x56610aeee7a6f5ead02c6833a95cdbbdac7e17d9"
      pending: []
      price: 0.00001
      priceEth: 0.00001
      selling: 25000
      signature: "0x5c9f9ffda93f548e2790550c6543b69169d2b0027cc057e2a3868da8e226b1336475a801cce0f4f4faeb2a4bddc0e19f17856bcf593b757cc57b9cefa6bbd86a1c"
      sold: 11017
      stock: 11982
      token: "0xd07dc4262bcdbf85190c01c996b4c06a461d2430"
      tokenId: "61433"
      value: 11982
      verified: true
    }
    ```
  - Metamask opens for payment

    - ERC721
      - method: "buy"
      - contract: 0xcd4EC7b66fbc029C116BA9Ffb3e59351c20B5B06
      - args:
      ```
      0: token: Array(4)
        0: Array(4)
          0: "0x3de83eeda936c1a880e599e5342a926dfb63a297"
          1: "35605854309404712830798232152004358801347168332391526661300393652615291528746"
          2: Array(3)
            0: "0x60f80121c31a0d46b5279700f9df786054aa5ee5"
            1: "71663"
            2: 3
          3: Array(3)
            0: "0x0000000000000000000000000000000000000000"
            1: "0"
            2: 0
        1: "1"
        2: "930000000000000"
        3: "250"
      1: Array(3)
        0: signature.v: 28
        1: signature.r: "0x5c9f9ffda93f548e2790550c6543b69169d2b0027cc057e2a3868da8e226b133"
        2: signature.s: "0x6475a801cce0f4f4faeb2a4bddc0e19f17856bcf593b757cc57b9cefa6bbd86a"
      2: buyerFee: 250
      3: selling: Array(3)
        0: signature.v: 27
        1: signature.r: "0x553c839f7f90ca27b07b90236108d39c1a53f66881271709d2fe4e86da6642fb"
        2: signature.s: "0x6fcfd842b6fa8043c1542849463e7fd36e9b67ade3cf2b55adc3c7dd1042a689"
      4: buying: "1"
      5: price: "0x0000000000000000000000000000000000000000"
      ```
      - Contract: 0xcd4EC7b66fbc029C116BA9Ffb3e59351c20B5B06 (ERC721Sale: https://etherscan.io/address/0xcd4EC7b66fbc029C116BA9Ffb3e59351c20B5B06#code)
    - ERC1155
      - method: "buy"
        - contract: "0x93F2a75d771628856f37f256dA95e99Ea28AaFbE"
        - args:
        ```
        0: token: "0xd07dc4262bcdbf85190c01c996b4c06a461d2430" (ERC721)
        1: tokenId: "61433"
        2: owner: "0x56610aeee7a6f5ead02c6833a95cdbbdac7e17d9"
        3: selling: 25000
        4: buying: 1
        5: price: "10000000000000" (priceEth * 1e18)
        6: sellerFee: 250
        7: Array(3)
          0: signature.v: 28
          1: signature.r: "0x5c9f9ffda93f548e2790550c6543b69169d2b0027cc057e2a3868da8e226b133"
          2: signature.s: "0x6475a801cce0f4f4faeb2a4bddc0e19f17856bcf593b757cc57b9cefa6bbd86a"
        ```
      - Contract: 0x93F2a75d771628856f37f256dA95e99Ea28AaFbE (ERC1155Sale: https://etherscan.io/address/0x93f2a75d771628856f37f256da95e99ea28aafbe#code)

- setApprovalForAll
