// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/cryptography/ECDSA.sol";

import "../proxy/TransferProxy.sol";
import "../proxy/ServiceFeeProxy.sol";
import "./ERC721SaleNonceHolder.sol";
import "../tokens/HasSecondarySaleFees.sol";
import "../tokens/HasSecondarySale.sol";

contract ERC721Sale is ReentrancyGuard {
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
        address buyer
    );

    struct SaleInfo {
        uint256 approvedSaleDate;
    }

    bytes constant EMPTY = "";
    bytes4 private constant _INTERFACE_ID_FEES = 0xb7799584;
    bytes4 private constant _INTERFACE_ID_HAS_SECONDARY_SALE = 0x5595380a;

    TransferProxy public transferProxy;
    ServiceFeeProxy public serviceFeeProxy;
    ERC721SaleNonceHolder public nonceHolder;

    /// @dev address -> token id -> sale info
    mapping(address => mapping(uint256 => SaleInfo)) public saleInfos;

    constructor(
        TransferProxy _transferProxy,
        ERC721SaleNonceHolder _nonceHolder,
        ServiceFeeProxy _serviceFeeProxy
    ) public {
        transferProxy = _transferProxy;
        nonceHolder = _nonceHolder;
        serviceFeeProxy = _serviceFeeProxy;
    }

    function _getNow() internal virtual view returns (uint256) {
        return block.timestamp;
    }

    function buy(
        IERC721 token,
        uint256 tokenId,
        address payable owner,
        bytes memory signature
    ) public payable nonReentrant {
        require(
            saleInfos[owner][tokenId].approvedSaleDate <= _getNow(),
            "ERC721Sale.buy: Token is not open to sale yet"
        );

        uint256 price = msg.value.mul(10000).div(serviceFeeProxy.getBuyServiceFeeBps(msg.sender).add(10000));
        uint256 nonce = verifySignature(
            address(token),
            tokenId,
            owner,
            price,
            signature
        );
        verifyOpenAndModifyState(address(token), tokenId, owner, nonce);

        delete saleInfos[owner][tokenId];
        transferProxy.erc721safeTransferFrom(token, owner, msg.sender, tokenId);
        transferEther(token, tokenId, owner);
        if (token.supportsInterface(_INTERFACE_ID_HAS_SECONDARY_SALE)) {
            HasSecondarySale SecondarySale = HasSecondarySale(address(token));
            SecondarySale.setSecondarySale(tokenId);
        }
        emit Buy(address(token), tokenId, owner, price, msg.sender);
    }

    function transferEther(
        IERC721 token,
        uint256 tokenId,
        address payable owner
    ) internal {
        bool isSecondarySale;
        if (token.supportsInterface(_INTERFACE_ID_HAS_SECONDARY_SALE)) {
            HasSecondarySale SecondarySale = HasSecondarySale(address(token));
            isSecondarySale = SecondarySale.checkSecondarySale(tokenId);
        }
        uint256 sellerServiceFeeBps = serviceFeeProxy.getSellServiceFeeBps(owner, isSecondarySale);
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
        nonceHolder.setNonce(token, tokenId, msg.sender, nonce.add(1));

        emit CloseOrder(token, tokenId, msg.sender, nonce.add(1));
    }

    function verifySignature(
        address token,
        uint256 tokenId,
        address payable owner,
        uint256 price,
        bytes memory signature
    ) internal view returns (uint256 nonce) {
        nonce = nonceHolder.getNonce(token, tokenId, owner);
        require(
            keccak256(abi.encodePacked(token, tokenId, price, nonce)).toEthSignedMessageHash().recover(signature) == owner,
            "ERC721Sale.verifySignature: Incorrect signature"
        );
    }

    function verifyOpenAndModifyState(
        address token,
        uint256 tokenId,
        address payable owner,
        uint256 nonce
    ) internal {
        nonceHolder.setNonce(token, tokenId, owner, nonce.add(1));
        emit CloseOrder(token, tokenId, owner, nonce.add(1));
    }

    /**
     * @notice set approved sale date of tokens
     * @param _token ERC721 Token Interface
     * @param _tokenId Id of token
     * @param _approvedSaleDate approve sale date of token
     */
    function setApproveSaleDate(
        IERC721 _token,
        uint256 _tokenId,
        uint256 _approvedSaleDate
    ) public {
        require(
            _token.ownerOf(_tokenId) == msg.sender,
            "ERC721Sale.setApproveSaleDate: Caller is not the owner of the token"
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
    ) public view returns (SaleInfo memory) {
        return saleInfos[_owner][_tokenId];
    }
}
