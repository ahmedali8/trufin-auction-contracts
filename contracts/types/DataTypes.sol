// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Auction Status Enum
/// @notice Represents the different states an auction can be in.
/// @dev Used in the `State` struct to track the auction's lifecycle.
enum Status {
    /// @notice The auction has not started yet.
    NOT_STARTED,
    /// @notice The auction is currently active and accepting bids.
    STARTED,
    /// @notice The auction has been finalized, and no further actions can be taken.
    ENDED
}

/// @title Auction State Struct
/// @notice Stores the current state of an auction.
/// @dev This struct is stored in storage and used to track auction progress.
struct State {
    // ---------------- SLOT 0 ----------------
    /// @notice Address of the highest priority bidder (head of the doubly linked list).
    address topBidder;
    /// @notice Address of the last bidder in the linked list (tail of the doubly linked list).
    address lastBidder;
    // ---------------- SLOT 1 ----------------
    /// @notice Total number of bids placed in the auction.
    uint128 totalBidCount;
    /// @notice Total number of tokens available for auction.
    uint128 totalTokensForSale;
    // ---------------- SLOT 2 ----------------
    /// @notice The ERC20 token being auctioned.
    IERC20 token;
    /// @notice The timestamp when the auction ends.
    uint40 endTime;
    /// @notice The current status of the auction.
    Status status;
}

/// @title Auction Bid Struct
/// @notice Represents a bid placed in the auction.
/// @dev Stored in a mapping (`mapping(uint256 => Bid) bids`) to track all bids.
struct Bid {
    // ---------------- SLOT 0 ----------------
    /// @notice The number of tokens the bidder wants to buy.
    uint128 quantity;
    /// @notice The price per token the bidder is willing to pay (in Wei).
    uint128 pricePerToken;
    // ---------------- SLOT 1 ----------------
    /// @notice The address of the bidder.
    address bidder;
    /// @notice Timestamp when the bid was placed.
    uint40 timestamp;
    /// @notice Indicates whether the bid has been filled.
    bool filled;
    // ---------------- SLOT 2 ----------------
    /// @notice Address of the previous bid in the linked list.
    address prev;
    /// @notice Address of the next bid in the linked list.
    address next;
}
