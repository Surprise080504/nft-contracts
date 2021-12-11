# Rarible

## URL Structure

```
https://app.rarible.com/token/0xd07dc4262bcdbf85190c01c996b4c06a461d2430:63146:0x095d3f27c804bc892f58579046e9d3ad5f652e72
                 https://app.rarible.com/token/<RARIBLETOKEN CONTRACT>:<TOKEN ID>:<OWNER>
```

NFT TOKEN: 0x60f80121c31a0d46b5279700f9df786054aa5ee5 OR 0xd07dc4262bcdbf85190c01c996b4c06a461d2430 (ERC721 OR ERC1155)
id: 0xd07dc4262bcdbf85190c01c996b4c06a461d2430:63146

Stored document (/items):

```json
{
  "item": {
    "id": "0xd07dc4262bcdbf85190c01c996b4c06a461d2430:63146",
    "token": "0xd07dc4262bcdbf85190c01c996b4c06a461d2430",
    "tokenId": "63146",
    "unlockable": true,
    "creator": "0xd56dec90a190b637a5d05f6ab083ff97fd60f506",
    "blacklisted": false,
    "supply": 25,
    "royalties": [
      {
        "recipient": "0xd56dec90a190b637a5d05f6ab083ff97fd60f506",
        "value": 1000
      }
    ],
    "likes": 12,
    "offer": null,
    "categories": ["art"]
  },
  "properties": {
    "name": "Trump Mouth FKNG a Jaguar",
    "description": "Self Explanatory",
    "image": "ipfs://ipfs/QmVVuARfzvJwg12Ldh7LaxpwU9bkvGzZaEtSHixWcRGqpr",
    "imagePreview": "https://lh3.googleusercontent.com/c3ilSAEUrpc6tEXStJUdMG_Ag8-3pAZEu8-kW-IvvWHdd3WCK5Vf8ZoSQR8NSOKIqu7UEwy8IAKwR-F5uoEHOZWq=s250",
    "imageBig": "https://lh3.googleusercontent.com/c3ilSAEUrpc6tEXStJUdMG_Ag8-3pAZEu8-kW-IvvWHdd3WCK5Vf8ZoSQR8NSOKIqu7UEwy8IAKwR-F5uoEHOZWq",
    "animationUrl": null,
    "attributes": []
  },
  "id": "0xd07dc4262bcdbf85190c01c996b4c06a461d2430:63146"
}
```

Stored ownerships

```json
{
  "ownership": {
    "id": "0xd07dc4262bcdbf85190c01c996b4c06a461d2430:63146:0x095d3f27c804bc892f58579046e9d3ad5f652e72",
    "token": "0xd07dc4262bcdbf85190c01c996b4c06a461d2430",
    "tokenId": "63146",
    "owner": "0x095d3f27c804bc892f58579046e9d3ad5f652e72",
    "value": 2,
    "date": "2020-11-16T06:03:56.796+00:00",
    "price": 0.19999,
    "priceEth": 0.19999,
    "buyToken": "0x0000000000000000000000000000000000000000",
    "buyTokenId": "0",
    "selling": 2,
    "sold": 0,
    "stock": 2,
    "signature": "0xe56b1449829fa2150095dac69ff7ca5db42aed602780aaf0dd03f54cf388821f30f03ade07109ca3d987ab1891c650daf647099cbf4449db69772fa5e39bc9ad1c",
    "pending": [],
    "blacklisted": false,
    "creator": "0xd56dec90a190b637a5d05f6ab083ff97fd60f506",
    "verified": true,
    "categories": ["art"],
    "likes": 12,
    "offer": null,
    "orderId": "0xd07dc4262bcdbf85190c01c996b4c06a461d2430:63146:0x095d3f27c804bc892f58579046e9d3ad5f652e72:0x0000000000000000000000000000000000000000:0"
  },
  "item": {
    "id": "0xd07dc4262bcdbf85190c01c996b4c06a461d2430:63146",
    "token": "0xd07dc4262bcdbf85190c01c996b4c06a461d2430",
    "tokenId": "63146",
    "unlockable": true,
    "creator": "0xd56dec90a190b637a5d05f6ab083ff97fd60f506",
    "blacklisted": false,
    "supply": 25,
    "royalties": [
      {
        "recipient": "0xd56dec90a190b637a5d05f6ab083ff97fd60f506",
        "value": 1000
      }
    ],
    "likes": 12,
    "offer": null,
    "categories": ["art"]
  },
  "properties": {
    "name": "Trump Mouth FKNG a Jaguar",
    "description": "Self Explanatory",
    "image": "ipfs://ipfs/QmVVuARfzvJwg12Ldh7LaxpwU9bkvGzZaEtSHixWcRGqpr",
    "imagePreview": "https://lh3.googleusercontent.com/c3ilSAEUrpc6tEXStJUdMG_Ag8-3pAZEu8-kW-IvvWHdd3WCK5Vf8ZoSQR8NSOKIqu7UEwy8IAKwR-F5uoEHOZWq=s250",
    "imageBig": "https://lh3.googleusercontent.com/c3ilSAEUrpc6tEXStJUdMG_Ag8-3pAZEu8-kW-IvvWHdd3WCK5Vf8ZoSQR8NSOKIqu7UEwy8IAKwR-F5uoEHOZWq",
    "animationUrl": null,
    "attributes": []
  },
  "id": "0xd07dc4262bcdbf85190c01c996b4c06a461d2430:63146:0x095d3f27c804bc892f58579046e9d3ad5f652e72"
}
```

## Steps

These are ASSUMPTIONS

- Create toking with URI = `mint` (ex. https://etherscan.io/tx/0x257c2848da383e13eeaa4ca2074a0c06501abb2bd699c42151f45207db2f7d16)
- `burn` (ex. https://etherscan.io/tx/0xff0fd71bb72d74d2828f593030ff6c0eeb68fa4a2afdebe63332588169f6fd26)
- Buying art = `transferFrom` (ex. https://etherscan.io/tx/0x80df15ef1d67a632921fd2907ba3ea85c617dc38bcc457075de234b64c9da69e)
- `setApprovalForAll` ? (ex. https://etherscan.io/tx/0x39311ea0f1453d2438cc1ac7657fb494e961ff98fe8097eff344738c76fabfe1)
