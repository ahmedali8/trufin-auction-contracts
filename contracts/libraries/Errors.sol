// SPDX-License-Identifier: MIT

pragma solidity ^0.8.22;

/// @title Errors
/// @notice Library to manage error messages for the LaunchpadV3 contracts.
library Errors {
    error AddressZero();
    error CanOnlySubmitOnce();
    error AuctionAlreadyExists();
    error InvalidAuctionTime();
    error InvalidTokenAddress();
    error InvalidTotalTokens();
    error AuctionNotActive();
    error InvalidBidQuantity();
    error InvalidBidPrice();
    error OwnerCannotPlaceABid();
    error AuctionStillActive();
    error AuctionAlreadyFinalized();
    error InvalidIPFSHash();
    error InvalidMerkleRoot();
    error AuctionNotFinalized();
    error BidDoesNotExist();
    error TokensAlreadyClaimed();
    error InvalidProof();
    error EthTransferFailed();
    error ZeroAddress();
    error InvalidSecurityDeposit();
    error VerificationPeriodNotOver();
    error OnlyVerifierCanResolveDispute();
    error AuctionMustHaveAnInitialMerkleRoot();
    error VerificationWindowExpired();
    error InvalidPricePerToken();
    error InvalidMultiHash();
}
