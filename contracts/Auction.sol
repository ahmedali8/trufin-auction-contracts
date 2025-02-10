// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "hardhat/console.sol";

contract Auction is Ownable {
    struct AuctionState {
        address token;
        uint256 totalTokens;
        uint256 startTime;
        uint256 endTime;
        bytes32 merkleRoot;
        string ipfsHash;
        bool isFinalized;
    }

    struct BidState {
        address bidder;
        uint256 quantity;
        uint256 pricePerToken;
    }

    AuctionState public auction;
    mapping(uint256 bidId => BidState bid) public bids;
    uint256 public nextBidId = 1; // to save gas

    error AuctionAlreadyExists();
    error InvalidAuctionTime();
    error InvalidTokenAddress();
    error InvalidTotalTokens();
    error AuctionNotActive();
    error InvalidBidQuantity();
    error InvalidBidPrice();
    error OwnerCannotPlaceABid();
    error AuctionStillActive();
    error AuctionAlreadyFinalized();
    error InvalidIPFSHash();
    error InvalidMerkleRoot();
    error AuctionNotFinalized();
    error BidDoesNotExist();
    error TokensAlreadyClaimed();
    error InvalidProof();
    error EthTransferFailed();
    error ZeroAddress();

    event AuctionStarted(address token, uint256 totalTokens, uint256 startTime, uint256 endTime);
    event BidPlaced(uint256 indexed bidId, address bidder, uint256 quantity, uint256 pricePerToken);
    event MerkleRootSubmitted(bytes32 merkleRoot, string ipfsHash);
    event AuctionFinalized(address caller);
    event TokensClaimed(address bidder, uint256 quantity);
    event ETHClaimed(address bidder, uint256 amount);

    modifier onlyDuringAuction() {
        if (block.timestamp < auction.startTime || block.timestamp > auction.endTime) {
            revert AuctionNotActive();
        }
        _;
    }

    modifier onlyAfterAuction() {
        if (block.timestamp <= auction.endTime) {
            revert AuctionStillActive();
        }
        _;
    }

    modifier isNotFinalized() {
        if (auction.isFinalized) {
            revert AuctionAlreadyFinalized();
        }
        _;
    }

    error InvalidDisputeDeposit();

    // TODO: Functions to add:
    // startAuction -> only callable by the owner, starts the auction
    function startAuction(
        address token,
        uint256 totalTokens,
        uint256 startTime,
        uint256 endTime
    )
        external
        payable
        onlyOwner
    {
        // take the dispute deposit as a security deposit from the auctioneer
        if (msg.value != DISPUTE_DEPOSIT) revert InvalidDisputeDeposit();
        if (auction.token != address(0)) {
            revert AuctionAlreadyExists();
        }
        if (token == address(0)) {
            revert InvalidTokenAddress();
        }
        if (totalTokens == 0) {
            revert InvalidTotalTokens();
        }
        if (startTime < block.timestamp || endTime <= startTime) {
            revert InvalidAuctionTime();
        }

        auction = AuctionState({
            token: token,
            totalTokens: totalTokens,
            startTime: startTime,
            endTime: endTime,
            merkleRoot: bytes32(0),
            ipfsHash: "",
            isFinalized: false
        });

        // take tokens from the owner and transfer them to this contract
        IERC20(token).transferFrom(_msgSender(), address(this), totalTokens);

        emit AuctionStarted(token, totalTokens, startTime, endTime);
    }

    // placeBid -> only callable by non-owner, places a bid
    function placeBid(uint256 quantity, uint256 pricePerToken) external payable onlyDuringAuction {
        if (_msgSender() == owner()) {
            revert OwnerCannotPlaceABid();
        }
        if (quantity == 0) {
            revert InvalidBidQuantity();
        }
        if (pricePerToken == 0 || ((quantity * pricePerToken) / 1e18) != msg.value) {
            revert InvalidBidPrice();
        }

        bids[nextBidId] =
            BidState({ bidder: _msgSender(), quantity: quantity, pricePerToken: pricePerToken });

        emit BidPlaced(nextBidId, _msgSender(), quantity, pricePerToken);
        nextBidId++;
    }

    function submitMerkleRoot(
        bytes32 merkleRoot,
        string calldata ipfsHash
    )
        external
        onlyOwner
        onlyAfterAuction
        isNotFinalized
    {
        if (merkleRoot == bytes32(0)) {
            revert InvalidMerkleRoot();
        }

        if (bytes(ipfsHash).length == 0) {
            revert InvalidIPFSHash();
        }
        auction.merkleRoot = merkleRoot;
        auction.ipfsHash = ipfsHash;

        emit MerkleRootSubmitted(merkleRoot, ipfsHash);
    }

    // there would be a window between the call of submitMerkleRoot and endAuction that would act as
    // the dispute period for the auction set to 2 hours

    // endAuction -> callable by anyone, finalizes the auction
    function endAuction() external isNotFinalized {
        if (auction.merkleRoot == bytes32(0)) {
            revert InvalidMerkleRoot();
        }
        auction.isFinalized = true;
        emit AuctionFinalized(_msgSender());
    }

    // claim -> only callable by the winners to claim tokens and pay money in eth
    function claim(uint256 bidId, uint256 quantity, bytes32[] calldata proof) external {
        if (!auction.isFinalized) {
            revert AuctionNotFinalized();
        }

        BidState memory _bid = bids[bidId];

        if (_bid.bidder != _msgSender()) {
            revert BidDoesNotExist();
        }

        // Verify the Merkle proof
        // If user gives false quantity then merkle proof would fail
        bytes32 _leaf = keccak256(bytes.concat(keccak256(abi.encode(_msgSender(), quantity))));
        if (!MerkleProof.verify(proof, auction.merkleRoot, _leaf)) revert InvalidProof();

        // update state
        delete bids[bidId];

        if (quantity == 0) {
            // it means user is non-winner and would claim eth
            uint256 _ethAmount = (_bid.quantity * _bid.pricePerToken) / 1e18;

            (bool success,) = _bid.bidder.call{ value: _ethAmount }("");
            if (!success) {
                revert EthTransferFailed();
            }
            emit ETHClaimed(_msgSender(), _ethAmount);
        } else {
            IERC20(auction.token).transfer(_msgSender(), _bid.quantity);
            emit TokensClaimed(_msgSender(), _bid.quantity);
        }
    }

    constructor(address _initialOwner, address _initialVerifier) Ownable(_initialOwner) {
        if (_initialVerifier == address(0)) {
            revert ZeroAddress();
        }
        verifier = _initialVerifier;

        emit VerifierSet(_initialVerifier);
    }

    struct Dispute {
        bytes32 proposedRoot;
        address challenger;
        bool resolved;
    }

    uint256 public constant DISPUTE_DEPOSIT = 0.1 ether;
    Dispute public dispute;

    event AuctionChallenged(address indexed challenger, bytes32 proposedRoot);
    event AuctioneerPenalized(uint256 penaltyAmount);
    event ChallengerRewarded(address indexed challenger, uint256 rewardAmount);
    event ChallengeFailed(address indexed challenger, uint256 stakeAmount);

    error RootDoesNotMatchSubmittedValue();
    error AuctionAlreadyChallenged();
    error InsufficientChallengeStake();
    error InvalidVerifierAddress();
    error NoActiveDispute();
    error DisputeAlreadyResolved();

    function challengeAuction(bytes32 proposedRoot) external payable onlyAfterAuction {
        if (dispute.challenger != address(0)) {
            revert AuctionAlreadyChallenged();
        }
        if (msg.value != DISPUTE_DEPOSIT) {
            revert InsufficientChallengeStake();
        }

        dispute = Dispute({ proposedRoot: proposedRoot, challenger: _msgSender(), resolved: false });

        emit AuctionChallenged(_msgSender(), proposedRoot);
    }

    // Verifier could be a third-party (DAO, Chainlink Oracle) settles it.
    function resolveChallenge(bool isProposedRootValid) external onlyVerifier {
        if (dispute.challenger == address(0)) {
            revert NoActiveDispute();
        }
        if (dispute.resolved) {
            revert DisputeAlreadyResolved();
        }

        if (isProposedRootValid) {
            dispute.resolved = true;

            // refund the eth + send the security deposit of auctioneer to challenger
            payable(dispute.challenger).transfer(2 * DISPUTE_DEPOSIT);

            // reset the dispute state

            emit AuctioneerPenalized(DISPUTE_DEPOSIT);
            emit ChallengerRewarded(dispute.challenger, 2 * DISPUTE_DEPOSIT);
        } else {
            // Challenger was wrong, give dispute deposit to auctioneer
            payable(owner()).transfer(DISPUTE_DEPOSIT);
            dispute.resolved = true;
            emit ChallengeFailed(dispute.challenger, DISPUTE_DEPOSIT);
        }
    }

    address public verifier; // Trusted verifier (DAO, multisig, or Chainlink OCR)

    modifier onlyVerifier() {
        require(_msgSender() == verifier, "Only verifier can resolve disputes");
        _;
    }

    event VerifierSet(address verifier);
}
