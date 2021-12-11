// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/GSN/Context.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @notice Airdrop contract for Refinable NFT Marketplace
 */
contract ERC721Airdrop is Context, ReentrancyGuard {

    /// @notice ERC721 NFT
    IERC721 public token;

    event AirdropContractDeployed();
    event AirdropFinished(
        uint256[] tokenIds,
        address[] recipients
    );

    /**
     * @dev Constructor Function
    */
    constructor(
        IERC721 _token
    ) public {
        require(address(_token) != address(0), "Invalid NFT");

        token = _token;

        emit AirdropContractDeployed();
    }

    /**
     * @dev Owner of token can airdrop tokens to recipients
     * @param _tokenIds array of token id
     * @param _recipients addresses of recipients
     */
    function airdrop(uint256[] memory _tokenIds, address[] memory _recipients) external nonReentrant {
        require(
            _recipients.length == _tokenIds.length,
            "ERC721Airdrop.airdrop: Count of recipients should be same as count of token ids"
        );

        for (uint256 i = 0; i < _tokenIds.length; i++) {
            require(
                token.ownerOf(_tokenIds[i]) == _msgSender(),
                "ERC721Airdrop.airdrop: Caller is not the owner"
            );
        }

        require(
            token.isApprovedForAll(_msgSender(), address(this)),
            "ERC721Airdrop.airdrop: Owner has not approved"
        );

        for (uint256 i = 0; i < _tokenIds.length; i++) {
            token.safeTransferFrom(_msgSender(), _recipients[i], _tokenIds[i]);
        }

        emit AirdropFinished(_tokenIds, _recipients);
    }
}
