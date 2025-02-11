// SPDX-License-Identifier: MIT

pragma solidity ^0.8.22;

library MerkleRootLibrary {
    function isMerkleRootValid(bytes32 merkleRoot) internal pure returns (bool) {
        return merkleRoot != bytes32(0);
    }
}
