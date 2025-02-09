import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ZeroAddress, parseEther } from "ethers";
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

    it("should create a new auction with event", async function () {
      const timeBuffer = 5;

      const tokenAddress = await tokenContract.getAddress();
      const totalTokens = parseEther("1");
      const startTime = (await time.latest()) + timeBuffer;
      const endTime = startTime + time.duration.minutes(10);

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
});
