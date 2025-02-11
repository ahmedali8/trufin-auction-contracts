// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

// LIBRARIES
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import { AddressLibrary } from "./libraries/AddressLibrary.sol";
import { MultiHashLibrary } from "./libraries/MultiHashLibrary.sol";
import { MerkleRootLibrary } from "./libraries/MerkleRootLibrary.sol";
import { StateLibrary } from "./libraries/StateLibrary.sol";
import { Constants } from "./libraries/Constants.sol";
import { Errors } from "./libraries/Errors.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// INTERFACES
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IAuction } from "./interfaces/IAuction.sol";

// ABSTRACT CONTRACTS
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

// DATA TYPES
import { Status, State, Bid } from "./types/DataTypes.sol";

/// @title Auction
/// @notice Implements a secure on-chain auction mechanism using a Merkle-based verification system.
/// @dev This contract follows the `IAuction` interface and uses external libraries for security and
/// efficiency.
contract Auction is IAuction, Ownable {
    using SafeERC20 for IERC20;
    using AddressLibrary for address;
    using MultiHashLibrary for bytes32;
    using MerkleRootLibrary for bytes32;
    using StateLibrary for State;

    /// @notice The window of time allowed for dispute resolution after the auction ends.
    uint256 public constant VERIFICATION_WINDOW = Constants.VERIFICATION_WINDOW;

    /// @notice The security deposit required from the auction owner to prevent fraud.
    uint256 public constant SECURITY_DEPOSIT = Constants.SECURITY_DEPOSIT;

    /// @notice The minimum bid price per token in ETH.
    uint256 public constant MIN_BID_PRICE_PER_TOKEN = Constants.MIN_BID_PRICE_PER_TOKEN;

    /// @notice The trusted verifier (DAO, multisig, or Chainlink OCR) responsible for dispute
    /// resolution.
    address public verifier;

    /// @notice The state of the auction, including status, token, and timing information.
    State public state;

    /// @notice Mapping of bid IDs to Bid structs, storing details of each bid.
    mapping(uint256 bidId => Bid bid) public bids;

    /// @notice The next available bid ID to ensure unique identifiers.
    uint256 public nextBidId = 1;

    /// @notice Restricts function access to the verifier only.
    modifier onlyVerifier() {
        if (_msgSender() != verifier) {
            revert Errors.OnlyVerifierCanResolveDispute();
        }
        _;
    }

    /// @notice Deploys the auction contract and sets the initial verifier.
    /// @dev The verifier is a trusted address responsible for dispute resolution.
    /// @param _initialOwner The address of the auction owner.
    /// @param _initialVerifier The address of the verifier entity.
    constructor(address _initialOwner, address _initialVerifier) Ownable(_initialOwner) {
        if (_initialVerifier == address(0)) {
            revert Errors.InvalidAddress(_initialVerifier);
        }
        verifier = _initialVerifier;

        emit VerifierSet(_initialVerifier);
    }

    /// @inheritdoc IAuction
    function startAuction(IAuction.StartAuctionParams memory params)
        external
        payable
        override
        onlyOwner
    {
        // take the security deposit from the auctioneer to prevent fraud
        if (msg.value != SECURITY_DEPOSIT) {
            revert Errors.InvalidSecurityDeposit();
        }

        state.startAuction(params);

        // take tokens from the owner and transfer them to this contract
        IERC20(params.token).transferFrom(_msgSender(), address(this), params.totalTokens);

        emit AuctionStarted(params.token, params.totalTokens, params.startTime, params.endTime);
    }

    /// @inheritdoc IAuction
    function placeBid(uint128 quantity, uint128 pricePerToken) external payable override {
        if (_msgSender() == owner()) {
            revert Errors.OwnerCannotPlaceBids();
        }

        state.placeBid(bids, nextBidId, _msgSender(), quantity, pricePerToken);

        if (getBidPrice(quantity, pricePerToken) != msg.value) {
            revert Errors.InvalidBidPrice();
        }

        emit BidPlaced(nextBidId, _msgSender(), quantity, pricePerToken);
        nextBidId++;
    }

    /// @inheritdoc IAuction
    function submitMerkleData(IAuction.MerkleDataParams calldata params)
        external
        override
        onlyOwner
    {
        state.submitMerkleData(params);

        emit MerkleRootSubmitted(params.merkleRoot, params.digest, params.hashFunction, params.size);
    }

    /// @inheritdoc IAuction
    function endAuction() external override {
        state.endAuction();

        // Return security deposit if owner is not slashed
        if (!state.isOwnerSlashed) {
            owner().sendValue(Constants.SECURITY_DEPOSIT);
        }

        emit AuctionEnded(_msgSender());
    }

    /// @inheritdoc IAuction
    function claim(IAuction.ClaimParams calldata params) external override {
        Bid memory _bid = bids[params.bidId];

        state.claim(bids, params, _bid, _msgSender());

        if (params.quantity == 0) {
            // Non-Winning bidder: Refund ETH
            uint128 _ethAmount = getBidPrice(_bid.quantity, _bid.pricePerToken);
            _bid.bidder.sendValue(_ethAmount);
            emit ETHClaimed(_msgSender(), _ethAmount);
        } else {
            // Winning bidder: Transfer tokens
            IERC20(state.token).transfer(_msgSender(), _bid.quantity);
            emit TokensClaimed(_msgSender(), _bid.quantity);
        }
    }

    /// @inheritdoc IAuction
    function slash(IAuction.MerkleDataParams calldata params) external override onlyVerifier {
        state.slash(params);

        // Reward verifier for catching fraud
        verifier.sendValue(SECURITY_DEPOSIT);

        emit MerkleRootUpdated(params.merkleRoot, params.digest, params.hashFunction, params.size);
        emit AuctioneerPenalized(SECURITY_DEPOSIT);
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
