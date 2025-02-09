import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ZeroAddress, parseEther, parseUnits, zeroPadBytes } from "ethers";
import { ethers } from "hardhat";

import type { Auction, MockToken } from "../types";
import { ZERO_BYTES32 } from "../utils/constants";
import { loadFixtures } from "./shared/fixtures";

describe("Auction Tests", function () {
  // signers
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  // contracts
  let auctionContract: Auction;
  let tokenContract: MockToken;

  before(async function () {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    owner = signers[0];
    alice = signers[1];
    bob = signers[2];
  });

  beforeEach(async function () {
    const fixtures = await loadFixture(loadFixtures);
    auctionContract = fixtures.auction;
    tokenContract = fixtures.token;

    // Mint some tokens to the wallets
    const tokenAmount = parseEther("1000000");
    await tokenContract.mint(owner.address, tokenAmount);
    await tokenContract.mint(alice.address, tokenAmount);
    await tokenContract.mint(bob.address, tokenAmount);
  });

  describe("#constructor", function () {
    it("should set the correct initial owner", async function () {
      const actualOwner = await auctionContract.owner();
      const expectedOwner = owner.address;
      expect(actualOwner).to.equal(expectedOwner);
    });
  });

  describe("#startAuction", function () {
    it("it should revert if not called by the owner", async function () {
      await expect(
        auctionContract
          .connect(alice)
          .startAuction(ZeroAddress, parseEther("1"), 1739058738, 1739058738)
      ).to.be.revertedWithCustomError(auctionContract, "OwnableUnauthorizedAccount");
    });

    it("it should revert if the token address is the zero address", async function () {
      await expect(
        auctionContract.startAuction(ZeroAddress, parseEther("1"), 1739058738, 1739058738)
      ).to.be.revertedWithCustomError(auctionContract, "InvalidTokenAddress");
    });

    it("it should revert if the total tokens is zero", async function () {
      const tokenAddress = await tokenContract.getAddress();

      await expect(
        auctionContract.startAuction(tokenAddress, 0, 1739058738, 1739058738)
      ).to.be.revertedWithCustomError(auctionContract, "InvalidTotalTokens");
    });

    it("it should revert if the start time is in the past", async function () {
      const tokenAddress = await tokenContract.getAddress();

      await expect(
        auctionContract.startAuction(tokenAddress, parseEther("1"), 0, 1739058738)
      ).to.be.revertedWithCustomError(auctionContract, "InvalidAuctionTime");
    });

    it("it should revert if the end time is before the start time", async function () {
      const tokenAddress = await tokenContract.getAddress();

      await expect(
        auctionContract.startAuction(tokenAddress, parseEther("1"), 1739058738, 1739058737)
      ).to.be.revertedWithCustomError(auctionContract, "InvalidAuctionTime");
    });

    it("should revert if tokens not approved", async function () {
      const timeBuffer = 5;

      const tokenAddress = await tokenContract.getAddress();
      const totalTokens = parseEther("1");
      const startTime = (await time.latest()) + timeBuffer;
      const endTime = startTime + time.duration.minutes(10);

      await expect(
        auctionContract.startAuction(tokenAddress, totalTokens, startTime, endTime)
      ).to.be.revertedWithCustomError(tokenContract, "ERC20InsufficientAllowance");
    });

    it("should create a new auction with event", async function () {
      const timeBuffer = 5;

      const tokenAddress = await tokenContract.getAddress();
      const totalTokens = parseEther("1");
      const startTime = (await time.latest()) + timeBuffer;
      const endTime = startTime + time.duration.minutes(10);

      // Approve the auction contract to spend the tokens
      await tokenContract.approve(auctionContract.getAddress(), totalTokens);

      await expect(auctionContract.startAuction(tokenAddress, totalTokens, startTime, endTime))
        .to.emit(auctionContract, "AuctionStarted")
        .withArgs(tokenAddress, totalTokens, startTime, endTime);

      const auctionState = await auctionContract.auction();

      // expect
      expect(auctionState.token).to.equal(tokenAddress);
      expect(auctionState.totalTokens).to.equal(totalTokens);
      expect(auctionState.startTime).to.equal(startTime);
      expect(auctionState.endTime).to.equal(endTime);
      expect(auctionState.merkleRoot).to.equal(ZERO_BYTES32);
      expect(auctionState.ipfsHash).to.equal("");
      expect(auctionState.isFinalized).to.equal(false);
    });
  });

  describe("#placeBid", function () {
    beforeEach(async function () {
      const timeBuffer = 5;

      const tokenAddress = await tokenContract.getAddress();
      const totalTokens = parseEther("10");
      const startTime = (await time.latest()) + timeBuffer;
      const endTime = startTime + time.duration.minutes(10);
      await tokenContract.approve(auctionContract.getAddress(), totalTokens);
      await auctionContract.startAuction(tokenAddress, totalTokens, startTime, endTime);

      // Move time forward to the start of the auction
      await time.increaseTo(startTime + time.duration.seconds(timeBuffer));
    });

    it("should revert if the owner tries to place a bid", async function () {
      await expect(
        auctionContract.connect(owner).placeBid(1, 0, { value: 0 })
      ).to.be.revertedWithCustomError(auctionContract, "OwnerCannotPlaceABid");
    });

    it("should revert if the bid quantity is zero", async function () {
      await expect(
        auctionContract.connect(alice).placeBid(0, parseEther("1"), { value: 0 })
      ).to.be.revertedWithCustomError(auctionContract, "InvalidBidQuantity");
    });

    it("should revert if the bid price per token is zero", async function () {
      await expect(
        auctionContract.connect(alice).placeBid(1, 0, { value: 0 })
      ).to.be.revertedWithCustomError(auctionContract, "InvalidBidPrice");
      await expect(
        auctionContract.connect(alice).placeBid(1, 0, { value: parseEther("1") })
      ).to.be.revertedWithCustomError(auctionContract, "InvalidBidPrice");
    });

    it("should place a bid successfully", async function () {
      const quantity = parseEther("100"); // 100 tokens
      const pricePerToken = parseUnits("1", 17); // 0.1 ETH per token
      const totalPrice = (pricePerToken * quantity) / parseUnits("1", 18); // 10 tokens

      const expectedBidId = 1n;
      const actualBidId = await auctionContract.nextBidId();
      expect(actualBidId).to.equal(expectedBidId);
      await expect(
        auctionContract.connect(alice).placeBid(quantity, pricePerToken, { value: totalPrice })
      )
        .to.emit(auctionContract, "BidPlaced")
        .withArgs(actualBidId, alice.address, quantity, pricePerToken);

      const bid = await auctionContract.bids(actualBidId);

      expect(bid.bidder).to.equal(alice.address);
      expect(bid.quantity).to.equal(quantity);
      expect(bid.pricePerToken).to.equal(pricePerToken);

      const actualNewBidId = await auctionContract.nextBidId();
      const expectedNewBidId = expectedBidId + 1n;
      expect(actualNewBidId).to.equal(expectedNewBidId);

      // assert the balance of the contract
      const auctionContractAddress = await auctionContract.getAddress();
      const contractBalance = await ethers.provider.getBalance(auctionContractAddress);
      expect(contractBalance).to.equal(totalPrice);
    });
  });

  describe("#submitMerkleRoot", function () {
    const timeBuffer = 5;
    let startTime = 0;
    let endTime = 0;

    beforeEach(async function () {
      const tokenAddress = await tokenContract.getAddress();
      const totalTokens = parseEther("10");
      startTime = (await time.latest()) + timeBuffer;
      endTime = startTime + time.duration.minutes(10);
      await tokenContract.approve(auctionContract.getAddress(), totalTokens);
      await auctionContract.startAuction(tokenAddress, totalTokens, startTime, endTime);
    });

    it("should revert if not called by the owner", async function () {
      const merkleRoot = ZERO_BYTES32;
      const ipfsHash = "QmTestHash";

      await expect(
        auctionContract.connect(alice).submitMerkleRoot(merkleRoot, ipfsHash)
      ).to.be.revertedWithCustomError(auctionContract, "OwnableUnauthorizedAccount");
    });

    it("should revert if its called before the auction has started", async function () {
      const merkleRoot = ZERO_BYTES32;
      const ipfsHash = "QmTestHash";

      await expect(
        auctionContract.connect(owner).submitMerkleRoot(merkleRoot, ipfsHash)
      ).to.be.revertedWithCustomError(auctionContract, "AuctionStillActive");
    });

    it("should revert if its called during the auction", async function () {
      // Move time forward to the start of the auction
      await time.increaseTo(startTime + time.duration.minutes(5));

      const merkleRoot = ZERO_BYTES32;
      const ipfsHash = "QmTestHash";

      await expect(
        auctionContract.connect(owner).submitMerkleRoot(merkleRoot, ipfsHash)
      ).to.be.revertedWithCustomError(auctionContract, "AuctionStillActive");
    });

    // TODO: should revert if the auction is already finalized

    it("should revert if merkle root is invalid", async function () {
      // Move time forward to the end of the auction
      await time.increaseTo(endTime + time.duration.seconds(timeBuffer));

      const merkleRoot = ZERO_BYTES32;
      const ipfsHash = "";

      await expect(
        auctionContract.connect(owner).submitMerkleRoot(merkleRoot, ipfsHash)
      ).to.be.revertedWithCustomError(auctionContract, "InvalidMerkleRoot");
    });

    it("should revert if ipfs hash is invalid", async function () {
      // Move time forward to the end of the auction
      await time.increaseTo(endTime + time.duration.seconds(timeBuffer));

      const merkleRoot = zeroPadBytes("0x01", 32);
      const ipfsHash = "";

      await expect(
        auctionContract.connect(owner).submitMerkleRoot(merkleRoot, ipfsHash)
      ).to.be.revertedWithCustomError(auctionContract, "InvalidIPFSHash");
    });

    it("should submit the merkle root and ipfs hash successfully", async function () {
      // Move time forward to the end of the auction
      await time.increaseTo(endTime + time.duration.seconds(timeBuffer));

      const merkleRoot = zeroPadBytes("0x01", 32);
      const ipfsHash = "QmTestHash";

      await expect(auctionContract.connect(owner).submitMerkleRoot(merkleRoot, ipfsHash))
        .to.emit(auctionContract, "MerkleRootSubmitted")
        .withArgs(merkleRoot, ipfsHash);

      const auctionState = await auctionContract.auction();
      expect(auctionState.merkleRoot).to.equal(merkleRoot);
      expect(auctionState.ipfsHash).to.equal(ipfsHash);
    });
  });

  describe("#endAuction", function () {
    const timeBuffer = 5;
    let startTime = 0;
    let endTime = 0;

    beforeEach(async function () {
      const tokenAddress = await tokenContract.getAddress();
      const totalTokens = parseEther("10");
      startTime = (await time.latest()) + timeBuffer;
      endTime = startTime + time.duration.minutes(10);
      await tokenContract.approve(auctionContract.getAddress(), totalTokens);
      await auctionContract.startAuction(tokenAddress, totalTokens, startTime, endTime);

      // Move time forward to the end of the auction
      await time.increaseTo(endTime + time.duration.seconds(timeBuffer));
    });

    it("should revert if merkle root has not been submitted", async function () {
      await expect(auctionContract.connect(owner).endAuction()).to.be.revertedWithCustomError(
        auctionContract,
        "InvalidMerkleRoot"
      );
    });

    it("should end the auction successfully", async function () {
      const merkleRoot = zeroPadBytes("0x01", 32);
      const ipfsHash = "QmTestHash";

      await auctionContract.connect(owner).submitMerkleRoot(merkleRoot, ipfsHash);

      await expect(auctionContract.connect(alice).endAuction())
        .to.emit(auctionContract, "AuctionFinalized")
        .withArgs(alice.address);

      const auctionState = await auctionContract.auction();
      expect(auctionState.isFinalized).to.equal(true);
    });
  });

  // describe("#claimTokens", function () {
  //   const timeBuffer = 5;
  //   let startTime = 0;
  //   let endTime = 0;

  //   beforeEach(async function () {
  //     const tokenAddress = await tokenContract.getAddress();
  //     const totalTokens = parseEther("10");
  //     startTime = (await time.latest()) + timeBuffer;
  //     endTime = startTime + time.duration.minutes(10);
  //     await tokenContract.approve(auctionContract.getAddress(), totalTokens);
  //     await auctionContract.startAuction(tokenAddress, totalTokens, startTime, endTime);

  //     // Move time forward to the start of the auction
  //     await time.increaseTo(startTime + time.duration.seconds(timeBuffer));

  //     // Place a bid
  //     const quantity = 10n;
  //     const pricePerToken = parseEther("1");
  //     const totalPrice = pricePerToken * quantity;
  //     await auctionContract.connect(alice).placeBid(quantity, pricePerToken, { value: totalPrice });

  //     // Move time forward to the end of the auction
  //     await time.increaseTo(endTime + time.duration.seconds(timeBuffer));

  //     const merkleRoot = zeroPadBytes("0x01", 32);
  //     const ipfsHash = "QmTestHash";
  //     await auctionContract.connect(owner).submitMerkleRoot(merkleRoot, ipfsHash);
  //   });

  //   it("should revert if the auction is not finalized", async function () {
  //     const bidId = 1;

  //     await expect(auctionContract.connect(alice).claimTokens(bidId)).to.be.revertedWithCustomError(
  //       auctionContract,
  //       "AuctionNotFinalized"
  //     );
  //   });

  //   it("should revert if the bid does not exist", async function () {
  //     await auctionContract.connect(bob).endAuction();

  //     const bidId = 999; // Non-existent bid ID

  //     await expect(auctionContract.connect(alice).claimTokens(bidId)).to.be.revertedWithCustomError(
  //       auctionContract,
  //       "BidDoesNotExist"
  //     );
  //   });

  //   it("should revert if tokens are already claimed", async function () {
  //     await auctionContract.connect(bob).endAuction();

  //     const bidId = 1;

  //     // Mint some tokens to the auction contract
  //     const auctionContractAddress = await auctionContract.getAddress();
  //     const tokenAmount = parseEther("100");
  //     await tokenContract.mint(auctionContractAddress, tokenAmount);

  //     // Claim tokens for the first time
  //     await auctionContract.connect(alice).claimTokens(bidId);

  //     // Try to claim tokens again
  //     await expect(auctionContract.connect(alice).claimTokens(bidId)).to.be.revertedWithCustomError(
  //       auctionContract,
  //       "BidDoesNotExist"
  //     );
  //   });

  //   it("should claim tokens successfully", async function () {
  //     await auctionContract.connect(bob).endAuction();
  //     const bidId = 1;

  //     const quantity = (await auctionContract.bids(bidId)).quantity;

  //     // Mint some tokens to the auction contract
  //     const auctionContractAddress = await auctionContract.getAddress();
  //     const tokenAmount = parseEther("100");
  //     await tokenContract.mint(auctionContractAddress, tokenAmount);

  //     const aliceBalanceBefore = await tokenContract.balanceOf(alice.address);

  //     await expect(auctionContract.connect(alice).claimTokens(bidId))
  //       .to.emit(auctionContract, "TokensClaimed")
  //       .withArgs(alice.address, quantity);

  //     const bid = await auctionContract.bids(bidId);
  //     expect(bid.quantity).to.equal(0);

  //     const aliceBalanceAfter = await tokenContract.balanceOf(alice.address);
  //     expect(aliceBalanceAfter).to.equal(aliceBalanceBefore + quantity);
  //   });
  // });
});
