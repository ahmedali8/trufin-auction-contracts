// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

interface IAuction {
    struct StartAuctionParams {
        uint128 totalTokens;
        uint40 startTime;
        uint40 endTime;
        address token;
    }
}
