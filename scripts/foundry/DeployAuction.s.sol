// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.23;

import { Auction } from "contracts/Auction.sol";

import { BaseScript } from "./Base.s.sol";

/// @dev See the Solidity Scripting tutorial:
/// https://book.getfoundry.sh/tutorials/solidity-scripting
contract DeployAuction is BaseScript {
    function run(
        address initialOwner,
        address token
    )
        public
        virtual
        broadcast
        returns (Auction auction)
    {
        // deploy our contract
        auction = new Auction(initialOwner, token);
    }
}
