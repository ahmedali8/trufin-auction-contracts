import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ZeroAddress, parseEther, parseUnits, zeroPadBytes } from "ethers";
import { ethers } from "hardhat";

import type { MockToken, PQAuction } from "../types";
import { mockTokenFixture } from "./shared/fixtures";

describe("PriorityQueueAuction Tests", function () {
  // signers
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let accounts: SignerWithAddress[];

  // contracts
  let auctionContract: PQAuction;
  let tokenContract: MockToken;
  let auctionAddress: string;
  let tokenAddress: string;

  /// HELPER FUNCTIONS ///

  before(async function () {
    [owner, alice, bob, ...accounts] = await ethers.getSigners();
  });

  beforeEach(async function () {
    const loadFix = async () => {
      const token = await mockTokenFixture();
      const tokenAddress = await token.getAddress();
      const Factory = await ethers.getContractFactory("PQAuction");
      const auction = await Factory.connect(owner).deploy(tokenAddress);
      await auction.waitForDeployment();

      return { auction, token };
    };

    const fixtures = await loadFixture(loadFix);
    auctionContract = fixtures.auction;
    auctionAddress = await auctionContract.getAddress();
    tokenContract = fixtures.token;
    tokenAddress = await tokenContract.getAddress();

    // Mint some tokens to the wallets
    const tokenAmount = parseEther("1000000");
    await tokenContract.mint(owner.address, tokenAmount);
    await tokenContract.approve(auctionAddress, parseEther("500"));
  });

  describe("Auction Initialization", function () {
    it("Should start the auction correctly", async function () {
      await auctionContract.startAuction(parseEther("100"), 3600);
      expect(await auctionContract.totalTokensForSale()).to.equal(parseEther("100"));
    });

    it("Should not start an auction if another is in progress", async function () {
      await auctionContract.startAuction(parseEther("100"), 3600);
      await expect(auctionContract.startAuction(parseEther("50"), 3600)).to.be.revertedWith(
        "Auction already in progress"
      );
    });
  });

  describe("Bidding Mechanism", function () {
    beforeEach(async function () {
      await auctionContract.startAuction(parseEther("100"), 3600);
    });

    it("Should allow a valid bid placement", async function () {
      await expect(
        auctionContract
          .connect(alice)
          .placeBid(parseEther("10"), parseEther("1"), { value: parseEther("10") })
      ).to.emit(auctionContract, "BidPlaced");
    });

    it("Should reject bids with incorrect ETH amount", async function () {
      await expect(
        auctionContract
          .connect(alice)
          .placeBid(parseEther("10"), parseEther("1"), { value: parseEther("5") })
      ).to.be.revertedWith("Incorrect ETH sent");
    });
  });

  describe("Auction Finalization", function () {
    beforeEach(async function () {
      await auctionContract.startAuction(parseEther("30"), 3600);
      await auctionContract
        .connect(alice)
        .placeBid(parseEther("20"), parseEther("2"), { value: parseEther("40") });
      await auctionContract
        .connect(bob)
        .placeBid(parseEther("30"), parseEther("3"), { value: parseEther("90") });

      await time.increase(4000); // Simulate time passing
    });

    it("Should allow the owner to finalize the auction and distribute tokens", async function () {
      await expect(auctionContract.finalizeAuction()).to.emit(auctionContract, "AuctionCompleted");

      expect(await tokenContract.balanceOf(bob.address)).to.equal(parseEther("30"));
      expect(await tokenContract.balanceOf(alice.address)).to.equal(0);
    });

    it("Should reject finalization before auction ends", async function () {
      await auctionContract.startAuction(parseEther("100"), 3600);
      await expect(auctionContract.finalizeAuction()).to.be.revertedWith(
        "Auction is still ongoing"
      );
    });
  });
});
