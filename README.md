# Binance project

# Read respective folders

- www: [Frontend](./www)

# Setup

## Compile contracts

`npm run build` (runs `truffle compile`)

## Run tests

Run each command in a separate terminal:

```
npx truffle develop -m 'pipe sponsor ski junk pact refuse ketchup basket return choose network purchase'
npx truffle test
```

Starting truffle develop with this specific mnemonic is needed to have access to the private keys in the tests, to able to sign messages.

# Truffle

# Resources

https://docs.binance.org/smart-chain/developer/deploy/truffle.html

- Checking deployment status: https://bscscan.com/
- testnet: https://testnet.bscscan.com/
- deploy NFT on BSC: https://docs.binance.org/smart-chain/developer/ERC721.html

## NFT

ERC721 standard: Non-fungible, tokens are not the same
ERC-1155: Combines benefits of fungible and non fungible (more for games, allows you mint both fungible and non-fungible)

- ERC721: Create single collectible (https://app.rarible.com/create/erc721)
- ERC1155: Create Multiple collectibles (selling multiple pieces of an art) (https://app.rarible.com/create/erc1155)

### NFT Explanations

- https://youtu.be/hYYxBgyOtdM

### NFT Tutorials

- https://youtu.be/YPbgjPPC1d0

# Chain ids

- 3: Ropsten

## Art NFT networks

SuperRare
OpenSea
Rarible (cannibalizing sales)

- unlockable art: extra stuff that comes available when you own it
- royalties
- supports in-game items
- insurance for yearn.finance?
- 4 wallets: fortmatic/walletconnect/walletlink/metamask
- supports erc 721 and ERC 1155
- governance through RARI token
- Liquidity mining: they distribute 75k rari tokens every sunday to people who bought or sold stuff on the platform (DROVE TRAFFIC!!)
- their inflation is too high!! 75k is too high, they already suggested burn mechanism
- they're implemention commission
