// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "../ERC721Auction.sol";

/**
 * @notice Mock Contract of ERC721Auction
 */
contract ERC721AuctionMock is ERC721Auction {
    uint256 public fakeBlockTimeStamp = 100;

    /**
     * @notice Auction Constructor
     * @param _token Token Interface
     * @param _serviceFeeProxy service fee proxy
     */
    constructor(
        IERC721 _token,
        ServiceFeeProxy _serviceFeeProxy
    ) ERC721Auction(_token, _serviceFeeProxy)
    public {}

    function setBlockTimeStamp(uint256 _now) external {
        fakeBlockTimeStamp = _now;
    }

    function _getNow() internal override view returns (uint256) {
        return fakeBlockTimeStamp;
    }
}