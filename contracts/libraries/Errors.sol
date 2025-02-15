// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title Errors
/// @notice Defines custom errors used across the auction contract to optimize gas usage.
library Errors {
    // ---------------- GENERIC ERRORS ----------------

    /// @notice Error thrown when an invalid address is provided.
    /// @param addr The invalid address that caused the error.
    error InvalidAddress(address addr);

    /// @notice Error thrown when the total number of tokens for the auction is zero.
    error ZeroTotalTokens();

    // ---------------- AUCTION ERRORS ----------------

    /// @notice Error thrown when an auction is already in progress and a new one is attempted to
    /// start.
    error AuctionInProgress();

    /// @notice Error thrown when attempting to interact with an auction that has ended.
    error AuctionEnded();

    /// @notice Error thrown when an invalid auction duration is provided.
    error ZeroDuration();

    /// @notice Error thrown when the bid price per token is below the required minimum threshold.
    error InvalidPricePerToken();

    // ---------------- BIDDING ERRORS ----------------

    /// @notice Error thrown when a bid with zero quantity is placed.
    error InvalidBidQuantity();

    /// @notice Error thrown when the ETH value sent does not match the expected bid amount.
    error InvalidBidPrice();

    /// @notice Error thrown when the auction owner attempts to place a bid.
    error OwnerCannotPlaceBids();

    /// @notice Error thrown when a bidder attempts to place multiple bids.
    error BidAlreadyPlaced();

    // ---------------- ETH & TOKEN TRANSFERS ----------------

    /// @notice Error thrown when an ETH transfer fails.
    error EthTransferFailed();
}
