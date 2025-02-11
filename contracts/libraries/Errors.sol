// SPDX-License-Identifier: MIT

pragma solidity ^0.8.22;

import { Status } from "../types/DataTypes.sol";

/// @title Errors
/// @notice Library to manage error messages for the LaunchpadV3 contracts.
library Errors {
    // Generic Errors
    error InvalidAddress(address addr);
    error ZeroTotalTokens();

    // Auction Errors
    error InvalidAuctionStatus(Status expected, Status current);
    error AuctionExists();
    error CanOnlySubmitOnce();
    error InvalidSecurityDeposit();
    error InvalidPricePerToken();
    error InvalidAuctionTimeParams(uint40 startTime, uint40 endTime);

    // Bidding Errors
    error InvalidBidQuantity();
    error InvalidBidPrice();
    error BidDoesNotExist();
    error OwnerCannotPlaceBids();

    // Merkle & Hash Errors
    error InvalidMerkleRoot(bytes32 merkleRoot);
    error InvalidMerkleProof(bytes32[] proof);
    error InvalidMultiHash(bytes32 digest, uint8 hashFunction, uint8 size);

    // Verification & Slashing
    error VerificationPeriodNotOver();
    error VerificationWindowExpired();
    error OnlyVerifierCanResolveDispute();

    // ETH & Token Transfers
    error EthTransferFailed();
}
