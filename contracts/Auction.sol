// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import { Status, State, Bid } from "./types/DataTypes.sol";
import { AddressLibrary } from "./libraries/AddressLibrary.sol";
import { MultiHashLibrary } from "./libraries/MultiHashLibrary.sol";
import { MerkleRootLibrary } from "./libraries/MerkleRootLibrary.sol";
import { StateLibrary } from "./libraries/StateLibrary.sol";
import { IAuction } from "./interfaces/IAuction.sol";
import { Constants } from "./libraries/Constants.sol";
import { Errors } from "./libraries/Errors.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";

contract Auction is Ownable {
    using SafeERC20 for IERC20;
    using AddressLibrary for address;
    using MultiHashLibrary for bytes32;
    using MerkleRootLibrary for bytes32;
    using StateLibrary for State;

    uint256 public constant VERIFICATION_WINDOW = Constants.VERIFICATION_WINDOW;
    uint256 public constant SECURITY_DEPOSIT = Constants.SECURITY_DEPOSIT;
    uint256 public constant MIN_BID_PRICE_PER_TOKEN = Constants.MIN_BID_PRICE_PER_TOKEN;

    address public verifier; // Trusted verifier (DAO, multisig, or Chainlink OCR)

    State public state;

    mapping(uint256 bidId => Bid bid) public bids;
    uint256 public nextBidId = 1; // to save gas

    event AuctionStarted(address token, uint128 totalTokens, uint40 startTime, uint40 endTime);
    event BidPlaced(uint256 indexed bidId, address bidder, uint128 quantity, uint128 pricePerToken);
    event MerkleRootSubmitted(bytes32 merkleRoot, bytes32 digest, uint8 hashFunction, uint8 size);
    event AuctionEnded(address caller);
    event TokensClaimed(address bidder, uint256 quantity);
    event ETHClaimed(address bidder, uint256 amount);
    event MerkleRootUpdated(bytes32 merkleRoot, bytes32 digest, uint8 hashFunction, uint8 size);
    event AuctioneerPenalized(uint256 penaltyAmount);
    event VerifierSet(address verifier);

    modifier onlyVerifier() {
        if (_msgSender() != verifier) {
            revert Errors.OnlyVerifierCanResolveDispute();
        }
        _;
    }

    constructor(address _initialOwner, address _initialVerifier) Ownable(_initialOwner) {
        if (_initialVerifier == address(0)) {
            revert Errors.InvalidAddress(_initialVerifier);
        }
        verifier = _initialVerifier;

        emit VerifierSet(_initialVerifier);
    }

    function startAuction(IAuction.StartAuctionParams memory params) external payable onlyOwner {
        // take the security deposit from the auctioneer to prevent fraud
        if (msg.value != SECURITY_DEPOSIT) revert Errors.InvalidSecurityDeposit();

        state.startAuction(params);

        // take tokens from the owner and transfer them to this contract
        IERC20(params.token).transferFrom(_msgSender(), address(this), params.totalTokens);

        emit AuctionStarted(params.token, params.totalTokens, params.startTime, params.endTime);
    }

    // placeBid -> only callable by non-owner, places a bid
    function placeBid(uint128 quantity, uint128 pricePerToken) external payable {
        state._checkAuctionTime();

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

    function getBidPrice(
        uint128 quantity,
        uint128 pricePerToken
    )
        public
        pure
        returns (uint128 price)
    {
        // use uint256 to avoid overflow
        price = uint128((uint256(quantity) * uint256(pricePerToken) + 1e18 - 1) / 1e18);
    }

    function submitMerkleData(IAuction.MerkleDataParams calldata params) external onlyOwner {
        // state._checkAuctionIsInActive();
        state._checkAuctionTime();

        // state._checkAuctionStatusNotEnded();
        state._checkStatus({ expected: Status.ACTIVE });
        state.submitMerkleData(params);

        emit MerkleRootSubmitted(params.merkleRoot, params.digest, params.hashFunction, params.size);
    }

    // there would be a window between the call of submitMerkleRoot and endAuction that would act as
    // the dispute period for the auction set to 2 hours

    // endAuction -> callable by anyone, finalizes the auction
    function endAuction() external {
        // state._checkAuctionStatusNotEnded();
        state._checkStatus({ expected: Status.MERKLE_SUBMITTED });
        state.endAuction();

        // Return security deposit if owner is not slashed
        if (!state.isOwnerSlashed) owner().sendValue(Constants.SECURITY_DEPOSIT);

        emit AuctionEnded(_msgSender());
    }

    // claim -> only callable by the winners to claim tokens and pay money in eth
    function claim(IAuction.ClaimParams calldata params) external {
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

    function slash(IAuction.MerkleDataParams calldata params) external onlyVerifier {
        state.slash(params);

        // Reward verifier for catching fraud
        verifier.sendValue(SECURITY_DEPOSIT);

        emit MerkleRootUpdated(params.merkleRoot, params.digest, params.hashFunction, params.size);
        emit AuctioneerPenalized(SECURITY_DEPOSIT);
    }
}
