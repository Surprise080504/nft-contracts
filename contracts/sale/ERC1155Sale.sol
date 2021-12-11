// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "../libs/StringLibrary.sol";
import "./ERC1155SaleNonceHolder.sol";
import "../tokens/HasSecondarySaleFees.sol";
import "../proxy/TransferProxy.sol";
import "../proxy/ServiceFeeProxy.sol";

contract ERC1155Sale is ReentrancyGuard {
    using SafeMath for uint256;
    using ECDSA for bytes32;

    event CloseOrder(
        address indexed token,
        uint256 indexed tokenId,
        address owner,
        uint256 nonce
    );
    event Buy(
        address indexed token,
        uint256 indexed tokenId,
        address owner,
        uint256 price,
        address buyer,
        uint256 value
    );

    struct SaleInfo {
        uint256 approvedSaleDate;
    }

    bytes constant EMPTY = "";
    bytes4 private constant _INTERFACE_ID_FEES = 0xb7799584;

    /// @dev address -> token id -> sale info
    mapping(address => mapping(uint256 => SaleInfo)) public saleInfos;

    TransferProxy public transferProxy;
    ServiceFeeProxy public serviceFeeProxy;
    ERC1155SaleNonceHolder public nonceHolder;

    constructor(
        TransferProxy _transferProxy,
        ERC1155SaleNonceHolder _nonceHolder,
        ServiceFeeProxy _serviceFeeProxy
    ) public {
        transferProxy = _transferProxy;
        nonceHolder = _nonceHolder;
        serviceFeeProxy = _serviceFeeProxy;
    }

    function buy(
        IERC1155 token,
        uint256 tokenId,
        address payable owner,
        uint256 selling,
        uint256 buying,
        bytes memory signature
    ) public payable nonReentrant {
        require(
            saleInfos[owner][tokenId].approvedSaleDate <= _getNow(),
            "ERC1155Sale.buy: Tokens is not open to sale yet"
        );

        uint256 price = msg.value.mul(10000).div(serviceFeeProxy.getBuyServiceFeeBps(msg.sender).add(10000)).div(buying);
        uint256 nonce = verifySignature(
            address(token),
            tokenId,
            owner,
            selling,
            price,
            signature
        );
        verifyOpenAndModifyState(
            address(token),
            tokenId,
            owner,
            nonce,
            selling,
            buying
        );

        delete saleInfos[owner][tokenId];
        transferProxy.erc1155safeTransferFrom(
            token,
            owner,
            msg.sender,
            tokenId,
            buying,
            EMPTY
        );

        transferEther(token, tokenId, owner);
        emit Buy(address(token), tokenId, owner, price, msg.sender, buying);
    }

    function transferEther(
        IERC1155 token,
        uint256 tokenId,
        address payable owner
    ) internal {
        uint256 sellerServiceFeeBps = serviceFeeProxy.getSellServiceFeeBps(owner, false);
        uint256 buyerServiceFeeBps = serviceFeeProxy.getBuyServiceFeeBps(msg.sender);
        address payable serviceFeeRecipient = serviceFeeProxy.getServiceFeeRecipient();

        uint256 tokenPrice = msg.value.mul(10000).div(buyerServiceFeeBps.add(10000));
        uint256 sellerServiceFee = tokenPrice.mul(sellerServiceFeeBps).div(10000);
        uint256 ownerValue = tokenPrice.sub(sellerServiceFee);
        uint256 sumFee;

        if (token.supportsInterface(_INTERFACE_ID_FEES)) {
            HasSecondarySaleFees withFees = HasSecondarySaleFees(address(token));
            address payable[] memory recipients = withFees.getFeeRecipients(tokenId);
            uint256[] memory fees = withFees.getFeeBps(tokenId);
            require(fees.length == recipients.length);
            for (uint256 i = 0; i < fees.length; i++) {
                uint256 current = ownerValue.mul(fees[i]).div(10000);
                recipients[i].transfer(current);
                sumFee = sumFee.add(current);
            }
        }
        ownerValue = ownerValue.sub(sumFee);
        serviceFeeRecipient.transfer(sellerServiceFee.add(msg.value.sub(tokenPrice)));
        owner.transfer(ownerValue);
    }

    function cancel(address token, uint256 tokenId) public payable {
        uint256 nonce = nonceHolder.getNonce(token, tokenId, msg.sender);
        nonceHolder.setNonce(token, tokenId, msg.sender, nonce .add(1));

        emit CloseOrder(token, tokenId, msg.sender, nonce .add(1));
    }

    function verifySignature(
        address token,
        uint256 tokenId,
        address payable owner,
        uint256 selling,
        uint256 price,
        bytes memory signature
    ) internal view returns (uint256 nonce) {
        nonce = nonceHolder.getNonce(token, tokenId, owner);
        require(
            keccak256(abi.encodePacked(token, tokenId, price, selling, nonce))
                .toEthSignedMessageHash()
                .recover(signature) == owner,
            "ERC1155Sale.verifySignature: Incorrect signature"
        );
    }

    function verifyOpenAndModifyState(
        address token,
        uint256 tokenId,
        address payable owner,
        uint256 nonce,
        uint256 selling,
        uint256 buying
    ) internal {
        uint256 comp = nonceHolder
            .getCompleted(token, tokenId, owner, nonce)
            .add(buying);
        require(comp <= selling);
        nonceHolder.setCompleted(token, tokenId, owner, nonce, comp);

        if (comp == selling) {
            nonceHolder.setNonce(token, tokenId, owner, nonce .add(1));
            emit CloseOrder(token, tokenId, owner, nonce .add(1));
        }
    }

    /**
     * @notice set approved sale date of tokens
     * @param _token ERC1155 Token Interface
     * @param _tokenId Id of token
     * @param _approvedSaleDate approve sale date of token
     */
    function setApprovedSaleDate(
        IERC1155 _token,
        uint256 _tokenId,
        uint256 _approvedSaleDate
    ) public {
        require(
            _token.balanceOf(msg.sender, _tokenId) > 0,
            "ERC1155Sale.setApprovedSaleDate: Caller doesn't have tokens"
        );

        saleInfos[msg.sender][_tokenId] = SaleInfo({
            approvedSaleDate: _approvedSaleDate
        });
    }

    /**
     * @notice Get Sale info with owner address and token id
     * @param _owner address of token Owner
     * @param _tokenId Id of token
     */
    function getSaleInfo(
        address _owner,
        uint256 _tokenId
    ) public view returns(SaleInfo memory) {
        return saleInfos[_owner][_tokenId];
    }

    function _getNow() internal virtual view returns (uint256) {
        return block.timestamp;
    }
}
