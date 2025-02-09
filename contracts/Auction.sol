// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
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

    event AuctionStarted(address token, uint256 totalTokens, uint256 startTime, uint256 endTime);
    event BidPlaced(uint256 indexed bidId, address bidder, uint256 quantity, uint256 pricePerToken);
    event MerkleRootSubmitted(bytes32 merkleRoot, string ipfsHash);
    event AuctionFinalized(address caller);
    event TokensClaimed(address bidder, uint256 quantity);

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

    // TODO: Functions to add:
    // startAuction -> only callable by the owner, starts the auction
    function startAuction(
        address token,
        uint256 totalTokens,
        uint256 startTime,
        uint256 endTime
    )
        external
        onlyOwner
    {
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
        if (pricePerToken == 0 || (quantity * pricePerToken) != msg.value) {
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
        // TODO: validate merkleRoot

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

    // claimTokens -> only callable by the winners to claim tokens and pay money in eth
    function claimTokens(uint256 bidId /* pass proof here as well */ ) external {
        if (!auction.isFinalized) {
            revert AuctionNotFinalized();
        }
        if (bids[bidId].bidder != _msgSender()) {
            revert BidDoesNotExist();
        }

        // TODO: Implement Merkle proof verification

        uint256 quantity = bids[bidId].quantity;

        // update state
        delete bids[bidId];

        IERC20(auction.token).transfer(_msgSender(), quantity);

        emit TokensClaimed(_msgSender(), quantity);
    }

    constructor(address _initialOwner) Ownable(_initialOwner) { }
}
