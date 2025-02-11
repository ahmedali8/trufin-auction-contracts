// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/// @title Constants
/// @notice Defines important constants used throughout the auction contract.
/// @dev Constants are stored in a separate library to optimize gas usage and readability.
library Constants {
    /// @notice The verification window duration in seconds (2 hours).
    uint256 internal constant VERIFICATION_WINDOW = 2 hours;

    /// @notice The security deposit required to start an auction (0.5 ETH).
    uint256 internal constant SECURITY_DEPOSIT = 0.5 ether;

    /// @notice The minimum bid price per token (0.001 ETH).
    uint256 internal constant MIN_BID_PRICE_PER_TOKEN = 1e15;
}
