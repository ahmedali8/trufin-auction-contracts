// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.26;

// LIBRARIES
import { AddressLibrary } from "./libraries/AddressLibrary.sol";
// import { StateLibrary } from "./libraries/StateLibrary.sol";
import { Constants } from "./libraries/Constants.sol";
import { Errors } from "./libraries/Errors.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// INTERFACES
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IAuction } from "./interfaces/IAuction.sol";

// ABSTRACT CONTRACTS
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

// DATA TYPES
import { State, Status, Bid } from "./types/DataTypes.sol";

/// @title Auction
/// @notice Implements a secure on-chain auction mechanism using a Merkle-based verification system.
/// @dev This contract follows the `IAuction` interface and uses external libraries for security and
/// efficiency.
contract Auction is IAuction, Ownable {
    using SafeERC20 for IERC20;
    using AddressLibrary for address;
    // using StateLibrary for State;

    /// @notice The minimum bid price per token in ETH.
    uint256 public constant MIN_BID_PRICE_PER_TOKEN = Constants.MIN_BID_PRICE_PER_TOKEN;

    /// @notice The state of the auction, including status, token, and timing information.
    State public state;

    /// @notice Mapping of bid IDs to Bid structs, storing details of each bid.
    mapping(address bidder => Bid bid) public bids;

    /// @notice Deploys the auction contract and sets the initial verifier.
    /// @dev The verifier is a trusted address responsible for dispute resolution.
    /// @param initialOwner The address of the auction owner.
    constructor(address initialOwner, address token) Ownable(initialOwner) {
        token.checkAddressZero();
        state.token = IERC20(token);
    }

    /// @inheritdoc IAuction
    function startAuction(
        uint128 totalTokens,
        uint40 duration
    )
        external
        payable
        override
        onlyOwner
    {
        // state.startAuction(params);

        if (totalTokens == 0) {
            revert Errors.ZeroTotalTokens();
        }

        if (duration == 0) {
            revert Errors.ZeroDuration();
        }

        if (state.status == Status.STARTED) {
            revert Errors.AuctionInProgress();
        }

        state.status = Status.STARTED;
        state.endTime = uint40(block.timestamp) + duration;
        state.totalTokensForSale = totalTokens;

        // take tokens from the owner and transfer them to this contract
        state.token.safeTransferFrom(_msgSender(), address(this), totalTokens);

        emit AuctionStarted(totalTokens, uint40(block.timestamp), duration);
    }

    /// @inheritdoc IAuction
    function placeBid(uint128 quantity, uint128 pricePerToken) external payable override {
        if (_msgSender() == owner()) {
            revert Errors.OwnerCannotPlaceBids();
        }

        if (quantity == 0) {
            revert Errors.InvalidBidQuantity();
        }

        if (pricePerToken < MIN_BID_PRICE_PER_TOKEN) {
            revert Errors.InvalidPricePerToken();
        }

        // state.placeBid(bids, nextBidId, _msgSender(), quantity, pricePerToken);
        if (getBidPrice(quantity, pricePerToken) != msg.value) {
            revert Errors.InvalidBidPrice();
        }

        if (state.status != Status.STARTED || uint40(block.timestamp) >= state.endTime) {
            revert Errors.AuctionEnded();
        }

        if (bids[_msgSender()].quantity != 0) {
            revert Errors.BidAlreadyPlaced();
        }

        bids[_msgSender()] = Bid({
            quantity: quantity,
            pricePerToken: pricePerToken,
            bidder: _msgSender(),
            timestamp: uint40(block.timestamp),
            filled: false,
            prev: address(0),
            next: address(0)
        });

        _insertBid(_msgSender());

        state.totalBidCount++;

        emit BidPlaced(_msgSender(), quantity, pricePerToken);
    }

    function _insertBid(address bidder) internal {
        // SSTORE: Create a new bid in storage
        Bid storage newBid = bids[bidder];

        // If the auction has no bids yet, set this bidder as both the top and last bidder
        if (state.topBidder == address(0)) {
            state.topBidder = bidder; // SSTORE: Set top bidder
            state.lastBidder = bidder; // SSTORE: Set last bidder
            return; // Exit early to save gas
        }

        address _current = state.topBidder; // SLOAD: Start at highest bid
        address _previous = address(0); // In-memory variable (not stored)

        // Fetch new bid details into memory to avoid multiple storage reads
        uint128 _newPrice = newBid.pricePerToken;
        uint128 _newQuantity = newBid.quantity;

        // Traverse the list and find the correct insertion position
        while (_current != address(0)) {
            // Fetch the current bid **only once** into memory (reducing storage reads)
            Bid storage currentBid = bids[_current];

            // Compare bids to determine placement position //

            // Higher price -> higher priority
            if (_newPrice > currentBid.pricePerToken) break;

            // Same price, more quantity -> higher priority
            if (_newPrice == currentBid.pricePerToken && _newQuantity > currentBid.quantity) {
                break;
            }

            // FIFO (Tie) logic
            if (
                _newPrice == currentBid.pricePerToken && _newQuantity == currentBid.quantity
                    && newBid.timestamp < currentBid.timestamp
            ) break;

            // Move to the next bid
            _previous = _current;
            _current = currentBid.next; // SLOAD: Fetch next bid in list
        }

        // SSTORE: Update new bid's pointers
        newBid.next = _current;
        newBid.prev = _previous;

        if (_previous == address(0)) {
            // CASE 1: Insert **at the top** (highest priority)
            newBid.next = state.topBidder; // SSTORE: Point new bid to the old top bid
            bids[state.topBidder].prev = bidder; // SSTORE: Update previous top bid’s `prev`
            state.topBidder = bidder; // SSTORE: Update the new top bidder
        } else {
            // CASE 2 & 3: Insert **in the middle** or **at the end**
            bids[_previous].next = bidder; // SSTORE: Update previous bid's `next`

            if (_current != address(0)) {
                // CASE 2: Insert in **the middle**
                bids[_current].prev = bidder; // SSTORE: Update next bid's `prev`
            } else {
                // CASE 3: Insert **at the end** (lowest priority)
                state.lastBidder = bidder; // SSTORE: Update last bidder
            }
        }
    }

    /// @inheritdoc IAuction
    function endAuction() external override {
        // state.endAuction();

        if (uint40(block.timestamp) < state.endTime) {
            revert Errors.AuctionEnded();
        }

        if (state.status == Status.ENDED) {
            revert Errors.AuctionInProgress();
        }

        state.status = Status.ENDED;
        uint256 _remainingTokens = state.totalTokensForSale;
        address _currentBidder = state.topBidder;

        while (_currentBidder != address(0)) {
            Bid storage bid = bids[_currentBidder];

            if (_remainingTokens > 0) {
                // Allocate tokens to the highest bidder
                uint256 _allocatedAmount =
                    bid.quantity <= _remainingTokens ? bid.quantity : _remainingTokens;

                _remainingTokens -= _allocatedAmount;

                state.token.safeTransfer(_currentBidder, _allocatedAmount);

                bid.filled = true;
            } else {
                uint256 _refundAmount = getBidPrice(bid.quantity, bid.pricePerToken);
                _currentBidder.sendValue(_refundAmount);
                emit RefundIssued(_currentBidder, _refundAmount);
            }

            _currentBidder = bid.next;
        }

        emit AuctionEnded();
    }

    /// @inheritdoc IAuction
    function getBidPrice(
        uint128 quantity,
        uint128 pricePerToken
    )
        public
        pure
        override
        returns (uint128 price)
    {
        // use uint256 to avoid overflow
        price = uint128((uint256(quantity) * uint256(pricePerToken) + 1e18 - 1) / 1e18);
    }
}
