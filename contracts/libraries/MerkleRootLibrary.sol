// SPDX-License-Identifier: MIT

pragma solidity ^0.8.22;

library MerkleRootLibrary {
    error InvalidMerkleRoot();

    function isMerkleRootValid(bytes32 merkleRoot) internal pure returns (bool) {
        return merkleRoot != bytes32(0);
    }

    function checkMerkleRoot(bytes32 merkleRoot) internal pure {
        if (merkleRoot == bytes32(0)) {
            revert InvalidMerkleRoot();
        }
    }
}
