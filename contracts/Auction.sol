// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.26;

// LIBRARIES
import { AddressLibrary } from "./libraries/AddressLibrary.sol";
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
/// @notice Implements a secure on-chain auction mechanism using a priority-based bidding system.
/// @dev This contract follows the `IAuction` interface and uses external libraries for security and
/// efficiency.
contract Auction is IAuction, Ownable {
    using SafeERC20 for IERC20;
    using AddressLibrary for address;

    /// @notice The minimum price per token that can be bid.
    uint256 public constant MIN_BID_PRICE_PER_TOKEN = 1e15;

    /// @notice The state of the auction, including status, token, and timing information.
    State public state;

    /// @notice Mapping of bid IDs to Bid structs, storing details of each bid.
    mapping(address bidder => Bid bid) public bids;

    /// @notice Deploys the auction contract and sets the initial owner and token.
    /// @dev Ensures the provided token address is valid.
    /// @param initialOwner The address of the auction owner.
    /// @param token The ERC20 token being auctioned.
    constructor(address initialOwner, address token) Ownable(initialOwner) {
        token.checkAddressZero();
        state.token = IERC20(token);
    }

    /// @inheritdoc IAuction
    function startAuction(uint128 totalTokens, uint40 duration) external override onlyOwner {
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
        address _sender = _msgSender();

        if (_sender == owner()) {
            revert Errors.OwnerCannotPlaceBids();
        }

        if (quantity == 0) {
            revert Errors.InvalidBidQuantity();
        }

        if (pricePerToken < MIN_BID_PRICE_PER_TOKEN) {
            revert Errors.InvalidPricePerToken();
        }

        if (getBidPrice(quantity, pricePerToken) != msg.value) {
            revert Errors.InvalidBidPrice();
        }

        if (state.status != Status.STARTED || uint40(block.timestamp) >= state.endTime) {
            revert Errors.AuctionEnded();
        }

        if (bids[_sender].quantity != 0) {
            revert Errors.BidAlreadyPlaced();
        }

        Bid memory _newBid = Bid({
            quantity: quantity,
            pricePerToken: pricePerToken,
            bidder: _sender,
            timestamp: uint40(block.timestamp),
            filled: false,
            prev: address(0),
            next: address(0)
        });
        bids[_sender] = _newBid;
        _insertBid(_sender);

        unchecked {
            state.totalBidCount++;
        }

        emit BidPlaced(_sender, quantity, pricePerToken);
    }

    /// @inheritdoc IAuction
    function endAuction() external override {
        if (state.status == Status.ENDED) {
            revert Errors.AuctionEnded();
        }

        if (uint40(block.timestamp) < state.endTime) {
            revert Errors.AuctionInProgress();
        }

        state.status = Status.ENDED;
        uint128 _remainingTokens = state.totalTokensForSale;
        address _currentBidder = state.topBidder;
        uint128 _allocatedAmount = 0;
        uint128 _refundAmount = 0;

        while (_currentBidder != address(0)) {
            Bid storage bid = bids[_currentBidder];

            if (_remainingTokens > 0) {
                // Allocate tokens to the highest bidder
                _allocatedAmount =
                    bid.quantity <= _remainingTokens ? bid.quantity : _remainingTokens;

                _remainingTokens -= _allocatedAmount;

                state.token.safeTransfer(_currentBidder, _allocatedAmount);

                bid.filled = true;
            } else {
                // Refund the non-winners
                _refundAmount = getBidPrice(bid.quantity, bid.pricePerToken);
                _currentBidder.sendValue(_refundAmount);
                emit RefundIssued(_currentBidder, _refundAmount);
            }

            _currentBidder = bid.next;
        }

        // Send remaining eth to the owner (i.e. the wining bidders' money)
        owner().sendValue(address(this).balance);

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
        unchecked {
            price = uint128((uint256(quantity) * uint256(pricePerToken) + 1e18 - 1) / 1e18);
        }
    }

    /// @notice Inserts a new bid into the priority-based doubly linked list.
    /// @dev The list is sorted based on bid price, quantity, and timestamp to determine priority.
    /// @param bidder The address of the bidder placing the bid.
    function _insertBid(address bidder) private {
        Bid storage newBid = bids[bidder];

        // If the auction has no bids yet, set this bidder as both the top and last bidder
        if (state.topBidder == address(0)) {
            state.topBidder = state.lastBidder = bidder;
            return;
        }

        address _current = state.topBidder; // Start at highest bid
        address _previous;

        // Fetch new bid details into memory to avoid multiple storage reads
        uint128 _newPrice = newBid.pricePerToken;
        uint128 _newQuantity = newBid.quantity;
        uint40 _newTimestamp = newBid.timestamp;

        // Traverse the list and find the correct insertion position
        while (_current != address(0)) {
            // Fetch the current bid only once into memory (reducing storage reads)
            Bid storage currentBid = bids[_current];

            // Compare bids to determine placement position //
            // The following control-flow is optimized for gas efficiency
            //
            // Higher price -> higher priority
            // if (_newPrice > currentBid.pricePerToken) break;
            // Same price, more quantity -> higher priority
            // if (_newPrice == currentBid.pricePerToken && _newQuantity > currentBid.quantity)
            // break;
            // FIFO (Tie) logic
            // if (
            //     _newPrice == currentBid.pricePerToken && _newQuantity == currentBid.quantity
            //         && _newTimestamp < currentBid.timestamp
            // ) break;
            //
            if (
                // priority
                _newPrice > currentBid.pricePerToken // Higher price -> higher priority
                    || (
                        _newPrice == currentBid.pricePerToken // Same price, more quantity -> higher
                            && (
                                _newQuantity > currentBid.quantity
                                    || (
                                        _newQuantity == currentBid.quantity
                                            && _newTimestamp < currentBid.timestamp
                                    )
                            )
                    ) // FIFO (Tie) logic
            ) {
                break;
            }

            // Move to the next bid
            _previous = _current;
            _current = currentBid.next; // Fetch next bid in list
        }

        if (_previous == address(0)) {
            // CASE 1: Insert at the top (highest priority)

            newBid.next = state.topBidder; // Point new bid to the old top bid
            bids[state.topBidder].prev = bidder; // Update previous top bid’s `prev`
            state.topBidder = bidder; // Update the new top bidder

            return;
        }

        // CASE 2 & 3: Insert in the middle or at the end

        // Update new bid's pointers
        newBid.prev = _previous;
        newBid.next = _current; // Point new bid to the current bid

        bids[_previous].next = bidder; // Update previous bid's `next`

        if (_current != address(0)) {
            // CASE 2: Insert in the middle
            bids[_current].prev = bidder; // Update next bid's `prev`
        } else {
            // CASE 3: Insert at the end (lowest priority)
            state.lastBidder = bidder; // Update last bidder
        }
    }
}
