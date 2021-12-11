# How to verify contract

- go to: https://etherscan.io/verifyContract-solc
- create and use a flattened contract

```
npx truffle-flattener ./contracts/SpectreToken.sol > ./contracts/SpectreToken_flattened.sol
```

- test in remix https://remix.ethereum.org/#optimize=false&evmVersion=null&version=soljson-v0.6.12+commit.27d51765.js

## Verifying Timelock

Sometimes it's a bit harder as it doesn't always recognise the constructor arguments directly.
In order to identify the manually, take the entire payload and search for the arguments you need.

In the case of the Timelock contract, there are 2 arguments, an admin address and the delay time. So we need to identify 2 arguments.

we'll see the encoded version ends on `00000000000000000000000009de39a3cc8925782a5d33ff63de784ca9bdaced000000000000000000000000000000000000000000000000000000000002a301` in https://etherscan.io/tx/0x07b24ad1e2fac7eb61f148a0873864fe67a89b2897cb07f381a03bc43d22d07e

arguments are of the form `000000000...` so we can identify that there are 2 parameters as an argument is proceeded with many 0s.

we paste that in then to verify the contract
