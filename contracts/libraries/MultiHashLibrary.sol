// SPDX-License-Identifier: MIT

pragma solidity ^0.8.22;

import { AuctionState } from "../types/DataTypes.sol";

library MultiHashLibrary {
    error InvalidMultiHash();

    /// @notice Checks if a MultiHash is valid (i.e., digest is not zero).
    /// @param auctionState The MultiHash struct to check.
    /// @return isValid Boolean indicating whether the MultiHash is valid.
    function isMultiHashValid(AuctionState memory auctionState) internal pure returns (bool) {
        return auctionState.digest != bytes32(0);
    }

    /// @notice Ensures a MultiHash is valid, otherwise reverts.
    /// @param auctionState The MultiHash struct to check.
    function checkMultiHash(AuctionState memory auctionState) internal pure {
        if (auctionState.digest == bytes32(0)) {
            revert InvalidMultiHash();
        }
    }
}
