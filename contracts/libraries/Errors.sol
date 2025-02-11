// SPDX-License-Identifier: MIT

pragma solidity ^0.8.26;

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

    /// @notice Error when the auction is in an invalid state.
    /// @param expected The expected auction status.
    /// @param current The current auction status.
    error InvalidAuctionStatus(Status expected, Status current);

    /// @notice Error when an auction already exists.
    error AuctionExists();

    /// @notice Error when trying to submit Merkle data more than once.
    error CanOnlySubmitOnce();

    /// @notice Error when the security deposit is incorrect.
    error InvalidSecurityDeposit();

    /// @notice Error when the bid price per token is below the minimum threshold.
    error InvalidPricePerToken();

    /// @notice Error when the provided auction time parameters are invalid.
    /// @param startTime The provided start time.
    /// @param endTime The provided end time.
    error InvalidAuctionTimeParams(uint40 startTime, uint40 endTime);

    // ---------------- BIDDING ERRORS ----------------

    /// @notice Error when an invalid bid quantity is provided.
    error InvalidBidQuantity();

    /// @notice Error when an invalid bid price is provided.
    error InvalidBidPrice();

    /// @notice Error when trying to interact with a non-existent bid.
    error BidDoesNotExist();

    /// @notice Error when the owner attempts to place a bid.
    error OwnerCannotPlaceBids();

    // ---------------- MERKLE & HASH ERRORS ----------------

    /// @notice Error when an invalid Merkle root is provided.
    /// @param merkleRoot The invalid Merkle root.
    error InvalidMerkleRoot(bytes32 merkleRoot);

    /// @notice Error when the provided Merkle proof is invalid.
    /// @param proof The invalid proof.
    error InvalidMerkleProof(bytes32[] proof);

    /// @notice Error when an invalid multi-hash is provided.
    /// @param digest The digest hash.
    /// @param hashFunction The hash function used.
    /// @param size The size of the hash output.
    error InvalidMultiHash(bytes32 digest, uint8 hashFunction, uint8 size);

    // ---------------- VERIFICATION & SLASHING ----------------

    /// @notice Error when trying to finalize the auction before the verification period is over.
    error VerificationPeriodNotOver();

    /// @notice Error when the verification window has expired.
    error VerificationWindowExpired();

    /// @notice Error when someone other than the verifier tries to resolve a dispute.
    error OnlyVerifierCanResolveDispute();

    // ---------------- ETH & TOKEN TRANSFERS ----------------

    /// @notice Error when ETH transfer fails.
    error EthTransferFailed();
}
