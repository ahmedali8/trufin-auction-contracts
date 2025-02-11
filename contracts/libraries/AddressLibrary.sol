// SPDX-License-Identifier: MIT

pragma solidity ^0.8.22;

import { Errors } from "./Errors.sol";

/// @title AddressLibrary
/// @notice Library to manage address operations.
/// @dev Provides utilities to validate and check address operations.
library AddressLibrary {
    /// @notice Checks if the address is zero.
    /// @param addr The address to check.
    /// @return True if the address is zero, false otherwise.
    function isAddressZero(address addr) internal pure returns (bool) {
        return addr == address(0);
    }

    /// @notice Checks the address is not zero address and reverts if it is.
    /// @param addr The address to check.
    function checkAddressZero(address addr) internal pure {
        if (isAddressZero(addr)) {
            revert Errors.AddressZero();
        }
    }

    function sendValue(address recipient, uint256 amount) internal {
        (bool _success,) = payable(recipient).call{ value: amount }("");
        if (!_success) {
            revert Errors.EthTransferFailed();
        }
    }
}
