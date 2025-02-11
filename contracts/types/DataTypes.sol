// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.26;

/// @title Auction Status Enum
/// @notice Represents the different states an auction can be in.
/// @dev Used in the `State` struct to track the auction's lifecycle.
enum Status {
    /// @notice The auction has not started yet.
    INACTIVE,
    /// @notice The auction is currently active and accepting bids.
    ACTIVE,
    /// @notice The auction has ended, and the Merkle root has been submitted for verification.
    MERKLE_SUBMITTED,
    /// @notice The auction has been finalized, and no further actions can be taken.
    ENDED
}

/// @title Auction State Struct
/// @notice Stores the current state of an auction.
/// @dev This struct is stored in storage and used to track auction progress.
struct State {
    // ---------------- SLOT 0 ----------------
    /// @notice The current status of the auction (INACTIVE, ACTIVE, MERKLE_SUBMITTED, ENDED).
    Status status; // 1 byte
    /// @notice The timestamp when the auction starts.
    /// @dev Stored as a 40-bit integer to save storage space.
    uint40 startTime; // 5 bytes
    /// @notice The timestamp when the auction ends.
    /// @dev Must be greater than `startTime`.
    uint40 endTime; // 5 bytes
    /// @notice The total number of tokens available in the auction.
    uint128 totalTokens; // 16 bytes
    /// @notice The timestamp when the verification period for Merkle root submission ends.
    /// @dev This is set when the Merkle root is submitted.
    uint40 verificationDeadline; // 5 bytes
    // ---------------- SLOT 1 ----------------
    /// @notice The ERC20 token being auctioned.
    /// @dev This address should be a valid ERC20 token contract.
    address token; // 20 bytes
    /// @notice Flag indicating if the auction owner has been penalized for fraud.
    bool isOwnerSlashed; // 1 byte
    /// @notice The hash function used for Merkle root verification.
    /// @dev Follows the MultiHash standard.
    uint8 hashFunction; // 1 byte
    /// @notice The size of the Merkle digest output.
    /// @dev Ensures correct parsing of Merkle proofs.
    uint8 size; // 1 byte
    // ---------------- SLOT 2 ----------------
    /// @notice The digest of the Merkle tree, used for verifying auction results.
    /// @dev The digest is generated from the auction's bid data.
    bytes32 digest; // 32 bytes
    // ---------------- SLOT 3 ----------------
    /// @notice The Merkle root representing the valid winning bids.
    /// @dev Submitted after auction ends for verification.
    bytes32 merkleRoot; // 32 bytes
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
}
