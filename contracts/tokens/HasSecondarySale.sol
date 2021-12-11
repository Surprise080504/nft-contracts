pragma solidity ^0.6.12;
// SPDX-License-Identifier: UNLICENSED

import "@openzeppelin/contracts/introspection/ERC165.sol";

abstract contract HasSecondarySale is ERC165 {

    /*
     * bytes4(keccak256('checkSecondarySale(uint256)')) == 0x0e883747
     * bytes4(keccak256('setSecondarySale(uint256)')) == 0x5b1d0f4d
     *
     * => 0x0e883747 ^ 0x5b1d0f4d == 0x5595380a
     */
    bytes4 private constant _INTERFACE_ID_HAS_SECONDARY_SALE = 0x5595380a;

    constructor() public {
        _registerInterface(_INTERFACE_ID_HAS_SECONDARY_SALE);
    }

    function checkSecondarySale(uint256 id) public virtual view returns (bool);
    function setSecondarySale(uint256 id) public virtual;
}