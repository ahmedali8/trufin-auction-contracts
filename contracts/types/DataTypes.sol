// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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
    // Storage slot 0
    address topBidder; // Highest priority bidder (doubly linked list head)
    address lastBidder; // Last bidder in the linked list (doubly linked list tail)
    // Storage slot 1
    uint128 totalBidCount; // Total number of bids placed
    uint128 totalTokensForSale; // Total tokens available for auction
    // Storage slot 2
    IERC20 token; // ERC20 token being auctioned
    uint40 endTime; // Auction end time (5 bytes)
    Status status; // Current auction status (1 byte)
}

/// @title Auction Bid Struct
/// @notice Represents a bid placed in the auction.
/// @dev Stored in a mapping (`mapping(uint256 => Bid) bids`) to track all bids.
struct Bid {
    // ---------------- SLOT 0 ----------------
    /// @notice The number of tokens the bidder wants to buy.
    uint128 quantity; // 16 bytes
    /// @notice The price per token the bidder is willing to pay (in Wei).
    uint128 pricePerToken; // 16 bytes
    // ---------------- SLOT 1 ----------------
    /// @notice The address of the bidder.
    /// @dev This address is used for refunds and token distribution.
    address bidder; // 20 bytes
    uint40 timestamp; // 5 bytes
    bool filled; // 1 byte
    // ---------------- SLOT 2 ----------------
    address prev; // 20 bytes
    address next; // 20 bytes
}
