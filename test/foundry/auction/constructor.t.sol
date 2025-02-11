// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.23 <0.9.0;

import { Auction_Test } from "./Auction.t.sol";

contract Auction_Constructor_Test is Auction_Test {
    function test_Constructor_SetInitialOwnerAndVerifier() public view {
        // Verify the owner and verifier are set correctly.
        assertEq(address(auction.owner()), address(users.owner));
        assertEq(auction.verifier(), users.verifier);
    }
}
