// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

enum Status {
    INACTIVE,
    ACTIVE,
    MERKLE_SUBMITTED,
    ENDED
}

struct State {
    // slot 0
    Status status; // 1 byte
    uint40 startTime; // 5 bytes
    uint40 endTime; // 5 bytes
    uint128 totalTokens; // 16 bytes
    uint40 verificationDeadline; // 5 bytes - Timestamp when verification period ends
    // slot 1
    address token; // 20 bytes
    bool isOwnerSlashed; // 1 bytes
    uint8 hashFunction; // 1 byte - The hash function used.
    uint8 size; // 1 byte - The size of the hash output.
    // slot 2
    bytes32 digest; // 32 bytes - The hash output.
    // slot 3
    bytes32 merkleRoot; // 32 bytes
}

struct Bid {
    // slot 0
    uint128 quantity; // 16 bytes
    uint128 pricePerToken; // 16 bytes
    // slot 1
    address bidder; // 20 bytes
}
