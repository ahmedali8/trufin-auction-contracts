// SPDX-License-Identifier: MIT

pragma solidity ^0.8.22;

library MultiHashLibrary {
    error InvalidMultiHash();

    function isMultiHashValid(
        bytes32 digest,
        uint8 hashFunction,
        uint8 size
    )
        internal
        pure
        returns (bool)
    {
        return digest != bytes32(0) && hashFunction > 0 && size > 0;
    }
}
