// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

// DATA TYPES
import { Status } from "../types/DataTypes.sol";

/// @title Errors
/// @notice Contains custom errors for the auction contract.
/// @dev Using custom errors reduces gas costs compared to traditional `require` statements with
/// strings.
library Errors {
    // ---------------- GENERIC ERRORS ----------------

    /// @notice Error for when an invalid address is provided.
    /// @param addr The invalid address.
    error InvalidAddress(address addr);

    /// @notice Error when total tokens provided for the auction is zero.
    error ZeroTotalTokens();

    // ---------------- AUCTION ERRORS ----------------

    /// @notice Error when an auction already exists.
    error AuctionInProgress();

    error AuctionEnded();

    error ZeroDuration();

    /// @notice Error when the bid price per token is below the minimum threshold.
    error InvalidPricePerToken();

    // ---------------- BIDDING ERRORS ----------------

    /// @notice Error when an invalid bid quantity is provided.
    error InvalidBidQuantity();

    /// @notice Error when an invalid bid price is provided.
    error InvalidBidPrice();

    /// @notice Error when the owner attempts to place a bid.
    error OwnerCannotPlaceBids();

    error BidAlreadyPlaced();

    // ---------------- ETH & TOKEN TRANSFERS ----------------

    /// @notice Error when ETH transfer fails.
    error EthTransferFailed();
}
