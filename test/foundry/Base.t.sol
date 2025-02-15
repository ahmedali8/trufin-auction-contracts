// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.23 <0.9.0;

import { Test } from "forge-std/src/Test.sol";

import { Auction } from "contracts/Auction.sol";
import { MockToken } from "contracts/mocks/MockToken.sol";

import { Users } from "./utils/Types.sol";

/// @notice Common contract members needed across test contracts.
abstract contract Base_Test is Test {
    /*//////////////////////////////////////////////////////////////
                               VARIABLES
    //////////////////////////////////////////////////////////////*/

    Users internal users;

    /*//////////////////////////////////////////////////////////////
                             TEST CONTRACTS
    //////////////////////////////////////////////////////////////*/

    Auction internal auction;
    MockToken internal mockToken;

    /*//////////////////////////////////////////////////////////////
                            SET-UP FUNCTION
    //////////////////////////////////////////////////////////////*/

    /// @dev A setup function invoked before each test case.
    function setUp() public virtual {
        // Create users for testing.
        users = Users({
            owner: createUser("Owner"),
            verifier: createUser("Verifier"),
            alice: createUser("Alice"),
            bob: createUser("Bob"),
            eve: createUser("Eve")
        });

        // Make the owner the default caller in all subsequent tests.
        vm.startPrank({ msgSender: users.owner });
    }

    /*//////////////////////////////////////////////////////////////
                                HELPERS
    //////////////////////////////////////////////////////////////*/

    /// @dev Helper function that multiplies the `amount` by `10^18` and returns a `uint256.`
    function toWei(uint256 value) internal pure returns (uint256 result) {
        result = bn(value, 18);
    }

    /// @dev Helper function that multiplies the `amount` by `10^decimals` and returns a `uint256.`
    function bn(uint256 amount, uint256 decimals) internal pure returns (uint256 result) {
        result = amount * 10 ** decimals;
    }

    /// @dev Generates a user, labels its address, and funds it with 100 test ether.
    function createUser(string memory name) internal returns (address payable) {
        return createUser(name, 100 ether);
    }

    /// @dev Generates a user, labels its address, and funds it with test balance.
    function createUser(string memory name, uint256 balance) internal returns (address payable) {
        address payable user = payable(makeAddr(name));
        vm.deal({ account: user, newBalance: balance });
        return user;
    }
}
