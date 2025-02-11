// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

interface IAuction {
    struct StartAuctionParams {
        uint128 totalTokens;
        uint40 startTime;
        uint40 endTime;
        address token;
    }

    struct SubmitMerkleDataParams {
        bytes32 merkleRoot;
        // MultiHash
        bytes32 digest;
        uint8 hashFunction;
        uint8 size;
    }

    struct ClaimParams {
        uint256 bidId;
        uint256 quantity;
        bytes32[] proof;
    }
}
