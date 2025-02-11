// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

library Constants {
    uint256 internal constant VERIFICATION_WINDOW = 2 hours; // 2-hour window
    uint256 internal constant SECURITY_DEPOSIT = 0.5 ether; // Penalty to prevent fraud
    uint256 internal constant MIN_BID_PRICE_PER_TOKEN = 1e15; // 0.001 ETH
}
