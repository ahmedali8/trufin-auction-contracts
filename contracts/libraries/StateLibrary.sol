// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

// LIBRARIES
import { Errors } from "./Errors.sol";
import { AddressLibrary } from "./AddressLibrary.sol";
import { Constants } from "./Constants.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// INTERFACES
import { IAuction } from "../interfaces/IAuction.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// DATA TYPES
import { State, Status, Bid } from "../types/DataTypes.sol";

/// @title StateLibrary
/// @notice Manages state-related operations for an auction contract, ensuring security and
/// correctness.
/// @dev Implements various functions for handling auction state transitions, bid placements, and
/// verification.
library StateLibrary {
    using StateLibrary for State;
    using AddressLibrary for address;
    using SafeERC20 for IERC20;

    function startAuction(State storage self, uint128 totalTokens, uint40 duration) internal {
        if (self.status == Status.STARTED) {
            revert Errors.AuctionInProgress();
        }

        if (totalTokens == 0) {
            revert Errors.ZeroTotalTokens();
        }

        self.endTime = uint40(block.timestamp) + duration;
        self.totalTokensForSale = totalTokens;
    }

    function endAuction(State storage self) internal {
        if (uint40(block.timestamp) < self.endTime) {
            revert Errors.AuctionEnded();
        }

        if (self.status == Status.ENDED) {
            revert Errors.AuctionInProgress();
        }

        self.status = Status.ENDED;
    }
}
