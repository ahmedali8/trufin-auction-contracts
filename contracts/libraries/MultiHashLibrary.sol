// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title MultiHashLibrary
/// @notice Library for handling multi-hash validation.
/// @dev Ensures the correctness of hash digests before they are stored or used.
library MultiHashLibrary {
    /// @notice Validates a multi-hash by checking its components.
    /// @param digest The hash digest.
    /// @param hashFunction The hash function used.
    /// @param size The size of the hash output.
    /// @return True if the multi-hash is valid, otherwise false.
    function isMultiHashValid(
        bytes32 digest,
        uint8 hashFunction,
        uint8 size
    )
        internal
        pure
        returns (bool)
    {
        return digest != bytes32(0) && hashFunction > 0 && size > 0;
    }
}
