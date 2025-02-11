// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// LIBRARIES
import { Errors } from "./Errors.sol";

/// @title AddressLibrary
/// @notice Library to manage address-related operations.
/// @dev Provides utilities for validating and handling addresses, including zero address checks and
/// ETH transfers.
library AddressLibrary {
    /// @notice Checks if an address is the zero address.
    /// @param addr The address to check.
    /// @return True if the address is the zero address, otherwise false.
    function isAddressZero(address addr) internal pure returns (bool) {
        return addr == address(0);
    }

    /// @notice Ensures that an address is not the zero address.
    /// @dev Reverts with an `InvalidAddress` error if the address is zero.
    /// @param addr The address to validate.
    function checkAddressZero(address addr) internal pure {
        if (isAddressZero(addr)) {
            revert Errors.InvalidAddress(addr);
        }
    }

    /// @notice Sends ETH to a recipient address.
    /// @dev Uses `call` instead of `transfer` to prevent gas limit issues. Reverts on failure.
    /// @param recipient The address receiving the ETH.
    /// @param amount The amount of ETH to send.
    function sendValue(address recipient, uint256 amount) internal {
        (bool _success,) = payable(recipient).call{ value: amount }("");
        if (!_success) {
            revert Errors.EthTransferFailed();
        }
    }
}
