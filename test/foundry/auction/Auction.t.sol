// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.23 <0.9.0;

import { Auction } from "contracts/Auction.sol";

import { Base_Test } from "../Base.t.sol";

/// @notice Common logic needed by all {Auction} tests.
abstract contract Auction_Test is Base_Test {
    /*//////////////////////////////////////////////////////////////
                            SET-UP FUNCTION
    //////////////////////////////////////////////////////////////*/

    function setUp() public virtual override {
        Base_Test.setUp();
        deployAuction();
    }

    /// @dev Deploys {Auction} contract
    function deployAuction() internal {
        auction = new Auction({ initialOwner: users.owner, initialVerifier: users.verifier });
        vm.label({ account: address(auction), newLabel: "Auction" });
    }
}
