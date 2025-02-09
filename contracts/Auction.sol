// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract Auction is Ownable {
    struct AuctionState {
        address token;
        uint256 totalTokens;
        uint256 startTime;
        uint256 endTime;
        bytes32 merkleRoot;
        string ipfsHash;
        bool isFinalized;
    }

    struct BidState {
        address bidder;
        uint256 quantity;
        uint256 pricePerToken;
    }

    AuctionState public auction;
    mapping(uint256 bidId => BidState bid) public bids;
    uint256 public nextBidId = 1; // to save gas

    error AuctionAlreadyExists();
    error InvalidAuctionTime();
    error InvalidTokenAddress();
    error InvalidTotalTokens();
    error AuctionNotActive();
    error InvalidBidQuantity();
    error InvalidBidPrice();
    error OwnerCannotPlaceABid();

    event AuctionStarted(address token, uint256 totalTokens, uint256 startTime, uint256 endTime);
    event BidPlaced(uint256 indexed bidId, address bidder, uint256 quantity, uint256 pricePerToken);

    modifier onlyDuringAuction() {
        if (block.timestamp < auction.startTime || block.timestamp > auction.endTime) {
            revert AuctionNotActive();
        }
        _;
    }

    // TODO: Functions to add:
    // startAuction -> only callable by the owner, starts the auction
    function startAuction(
        address token,
        uint256 totalTokens,
        uint256 startTime,
        uint256 endTime
    )
        external
        onlyOwner
    {
        if (auction.token != address(0)) {
            revert AuctionAlreadyExists();
        }
        if (token == address(0)) {
            revert InvalidTokenAddress();
        }
        if (totalTokens == 0) {
            revert InvalidTotalTokens();
        }
        if (startTime < block.timestamp || endTime <= startTime) {
            revert InvalidAuctionTime();
        }

        auction = AuctionState({
            token: token,
            totalTokens: totalTokens,
            startTime: startTime,
            endTime: endTime,
            merkleRoot: bytes32(0),
            ipfsHash: "",
            isFinalized: false
        });

        emit AuctionStarted(token, totalTokens, startTime, endTime);
    }

    // placeBid -> only callable by non-owner, places a bid
    function placeBid(uint256 quantity, uint256 pricePerToken) external payable onlyDuringAuction {
        if (_msgSender() == owner()) {
            revert OwnerCannotPlaceABid();
        }
        if (quantity == 0) {
            revert InvalidBidQuantity();
        }
        if (pricePerToken == 0 || (quantity * pricePerToken) != msg.value) {
            revert InvalidBidPrice();
        }

        bids[nextBidId] =
            BidState({ bidder: _msgSender(), quantity: quantity, pricePerToken: pricePerToken });

        emit BidPlaced(nextBidId, _msgSender(), quantity, pricePerToken);
        nextBidId++;
    }

    // endAuction -> callable by anyone, finalizes the auction
    // claimTokens -> only callable by the winners to claim tokens and pay money in eth

    constructor(address _initialOwner) Ownable(_initialOwner) { }
}
