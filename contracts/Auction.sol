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
    uint256 public nextBidId;

    error AuctionAlreadyExists();
    error InvalidAuctionTime();
    error InvalidTokenAddress();
    error InvalidTotalTokens();

    event AuctionStarted(address token, uint256 totalTokens, uint256 startTime, uint256 endTime);

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
    // endAuction -> callable by anyone, finalizes the auction
    // claimTokens -> only callable by the winners to claim tokens and pay money in eth

    constructor(address _initialOwner) Ownable(_initialOwner) { }
}
