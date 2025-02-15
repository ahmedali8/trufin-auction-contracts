// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

// LIBRARIES
import { Errors } from "./Errors.sol";
import { AddressLibrary } from "./AddressLibrary.sol";
import { BidLibrary } from "./BidLibrary.sol";
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
        if (totalTokens == 0) {
            revert Errors.ZeroTotalTokens();
        }

        if (duration == 0) {
            revert Errors.ZeroDuration();
        }

        if (self.status == Status.STARTED) {
            revert Errors.AuctionInProgress();
        }

        self.status = Status.STARTED;
        self.endTime = uint40(block.timestamp) + duration;
        self.totalTokensForSale = totalTokens;
    }

    function endAuction(
        State storage self,
        mapping(address => Bid) storage bids,
        address owner
    )
        internal
    {
        if (self.status == Status.ENDED) {
            revert Errors.AuctionEnded();
        }

        if (uint40(block.timestamp) < self.endTime) {
            revert Errors.AuctionInProgress();
        }

        self.status = Status.ENDED;
        uint256 _remainingTokens = self.totalTokensForSale;
        address _currentBidder = self.topBidder;

        while (_currentBidder != address(0)) {
            Bid storage bid = bids[_currentBidder];

            if (_remainingTokens > 0) {
                // Allocate tokens to highest bidder
                uint256 allocatedAmount =
                    bid.quantity <= _remainingTokens ? bid.quantity : _remainingTokens;
                _remainingTokens -= allocatedAmount;

                self.token.safeTransfer(_currentBidder, allocatedAmount);
                bid.filled = true;
            } else {
                // Refund unsuccessful bidders
                uint256 _refundAmount = BidLibrary.getBidPrice(bid.quantity, bid.pricePerToken);
                _currentBidder.sendValue(_refundAmount);

                emit IAuction.RefundIssued(_currentBidder, _refundAmount);
            }

            _currentBidder = bid.next;
        }

        // Send remaining balance (if any) to owner
        owner.sendValue(address(this).balance);
    }
}
