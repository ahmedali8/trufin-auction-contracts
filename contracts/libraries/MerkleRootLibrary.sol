// SPDX-License-Identifier: MIT

pragma solidity ^0.8.22;

import { AuctionState } from "../types/DataTypes.sol";

library MerkleRootLibrary {
    error InvalidMerkleRoot();

    function isMerkleRootValid(AuctionState memory auctionState) internal pure returns (bool) {
        return auctionState.merkleRoot != bytes32(0);
    }

    function checkMerkleRoot(AuctionState memory auctionState) internal pure {
        if (auctionState.merkleRoot == bytes32(0)) {
            revert InvalidMerkleRoot();
        }
    }
}
