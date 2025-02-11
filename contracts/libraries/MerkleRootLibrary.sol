// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/// @title MerkleRootLibrary
/// @notice Utility library for handling Merkle root validation.
/// @dev Ensures the correctness of Merkle roots before they are stored in the auction state.
library MerkleRootLibrary {
    /// @notice Checks if a Merkle root is valid.
    /// @param merkleRoot The Merkle root to validate.
    /// @return True if the Merkle root is valid, otherwise false.
    function isMerkleRootValid(bytes32 merkleRoot) internal pure returns (bool) {
        return merkleRoot != bytes32(0);
    }
}
