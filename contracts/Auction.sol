// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract Auction is Ownable {
    struct Auction {
        address token;
        uint256 totalTokens;
        uint256 startTime;
        uint256 endTime;
        bytes32 merkleRoot;
        string ipfsHash;
        bool isFinalized;
    }

    struct Bid {
        address bidder;
        uint256 quantity;
        uint256 pricePerToken;
    }

    Auction public auction;
    mapping(uint256 bidId => Bid bid) public bids;
    uint256 public nextBidId;

    // TODO: Add events

    // TODO: Functions to add:
    // startAuction -> only callable by the owner, starts the auction
    // placeBid -> only callable by non-owner, places a bid
    // endAuction -> callable by anyone, finalizes the auction
    // claimTokens -> only callable by the winners to claim tokens and pay money in eth

    constructor(address _initialOwner) Ownable(_initialOwner) { }
}
