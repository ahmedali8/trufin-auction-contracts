// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

struct AuctionState {
    address token;
    uint128 totalTokens;
    uint40 startTime;
    uint40 endTime;
    bytes32 merkleRoot;
    string ipfsHash;
    bool isFinalized;
}
