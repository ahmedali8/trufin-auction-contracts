import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ZeroAddress, parseEther, parseUnits, zeroPadBytes } from "ethers";
import { ethers } from "hardhat";

import type { Auction, MockToken } from "../types";
import { ZERO_BYTES32 } from "../utils/constants";
import {
  AUCTION_DURATION,
  AuctionStatus,
  PRICE_PER_TOKEN,
  TIME_BUFFER,
  TOKEN_AMOUNT,
  TOKEN_QUANTITY,
  TOTAL_TOKENS,
} from "./shared/constants";
import { AuctionErrors, ERC20TokenErrors, OwnableErrors } from "./shared/errors";
import { loadFixtures } from "./shared/fixtures";
import {
  advanceToAuctionEnd,
  advanceToAuctionStart,
  getBidPrice,
  getGasFee,
  getStartAndEndTime,
  getTimeData,
} from "./shared/helpers";

describe("Auction Tests", function () {
  // signers
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let verifier: SignerWithAddress;
  let accounts: SignerWithAddress[];

  // contracts
  let auctionContract: Auction;
  let tokenContract: MockToken;
  let auctionAddress: string;
  let tokenAddress: string;

  /// HELPER FUNCTIONS ///

  async function approveAndStartAuction() {
    const { currentTime, duration, endTime } = await getTimeData();

    await tokenContract.connect(owner).approve(auctionContract.getAddress(), TOTAL_TOKENS);
    await auctionContract.connect(owner).startAuction(TOTAL_TOKENS, duration);

    return { currentTime, duration, endTime };
  }

  before(async function () {
    [owner, verifier, alice, bob, ...accounts] = await ethers.getSigners();
  });

  beforeEach(async function () {
    const fixtures = await loadFixture(loadFixtures);
    auctionContract = fixtures.auction;
    auctionAddress = await auctionContract.getAddress();
    tokenContract = fixtures.token;
    tokenAddress = await tokenContract.getAddress();

    // Mint some tokens to the wallets
    const tokenAmount = parseEther("1000000");
    await Promise.all([
      tokenContract.mint(owner.address, tokenAmount),
      tokenContract.mint(alice.address, tokenAmount),
      tokenContract.mint(bob.address, tokenAmount),
    ]);
  });

  describe("#constructor", function () {
    it("should revert if the token address is zero address", async function () {
      const AuctionFactory = await ethers.getContractFactory("Auction");
      await expect(
        AuctionFactory.connect(owner).deploy(owner.address, ZeroAddress)
      ).to.be.revertedWithCustomError(auctionContract, AuctionErrors.InvalidAddress);
    });

    it("should set the correct initial owner", async function () {
      const actualOwner = await auctionContract.owner();
      const expectedOwner = owner.address;
      expect(actualOwner).to.equal(expectedOwner);
    });
  });

  describe("#startAuction", function () {
    context("when called by non-owner", function () {
      it("should revert", async function () {
        await expect(
          auctionContract.connect(alice).startAuction(parseEther("1"), AUCTION_DURATION)
        ).to.be.revertedWithCustomError(auctionContract, OwnableErrors.OwnableUnauthorizedAccount);
      });
    });

    context("when params are invalid", function () {
      it("should revert if the total tokens is zero", async function () {
        await expect(
          auctionContract.startAuction(0, AUCTION_DURATION)
        ).to.be.revertedWithCustomError(auctionContract, AuctionErrors.ZeroTotalTokens);
      });

      it("should revert if the duration is zero", async function () {
        await expect(
          auctionContract.startAuction(parseEther("1"), 0)
        ).to.be.revertedWithCustomError(auctionContract, AuctionErrors.ZeroDuration);
      });
    });

    context("when params are valid", function () {
      it("should revert if tokens not approved", async function () {
        await expect(
          auctionContract.startAuction(TOTAL_TOKENS, AUCTION_DURATION)
        ).to.be.revertedWithCustomError(tokenContract, ERC20TokenErrors.ERC20InsufficientAllowance);
      });

      context("when create a new auction", function () {
        let currentTime = 0;
        let duration = 0;
        let endTime = 0;

        beforeEach(async function () {
          // Approve the auction contract to spend the tokens
          await tokenContract.approve(auctionContract.getAddress(), TOTAL_TOKENS);

          ({ currentTime, duration, endTime } = await getTimeData());
          await expect(auctionContract.startAuction(TOTAL_TOKENS, duration))
            .to.emit(auctionContract, "AuctionStarted")
            .withArgs(TOTAL_TOKENS, currentTime, duration);
        });

        it("should revert if auction is started again", async function () {
          await expect(
            auctionContract.startAuction(TOTAL_TOKENS, duration)
          ).to.be.revertedWithCustomError(auctionContract, AuctionErrors.AuctionInProgress);
        });

        it("should emit event and update state", async function () {
          const auctionState = await auctionContract.state();

          // expect
          expect(auctionState.topBidder).to.equal(ZeroAddress);
          expect(auctionState.lastBidder).to.equal(ZeroAddress);
          expect(auctionState.totalBidCount).to.equal(0);
          expect(auctionState.totalTokensForSale).to.equal(TOTAL_TOKENS);
          expect(auctionState.token).to.equal(tokenAddress);
          expect(auctionState.endTime).to.equal(endTime);
          expect(auctionState.status).to.equal(AuctionStatus.STARTED);
        });
      });
    });
  });

  describe("#placeBid", function () {
    let auctionCurrentTime = 0;
    let duration = 0;
    let auctionEndTime = 0;

    beforeEach(async function () {
      ({
        currentTime: auctionCurrentTime,
        duration,
        endTime: auctionEndTime,
      } = await approveAndStartAuction());

      await advanceToAuctionStart(auctionCurrentTime);
    });

    context("when the bid or params are invalid", function () {
      it("should revert if the owner tries to place a bid", async function () {
        await expect(
          auctionContract.connect(owner).placeBid(1, 0, { value: 0 })
        ).to.be.revertedWithCustomError(auctionContract, AuctionErrors.OwnerCannotPlaceBids);
      });

      it("should revert if the bid quantity is zero", async function () {
        await expect(
          auctionContract.connect(alice).placeBid(0, parseEther("1"), { value: 0 })
        ).to.be.revertedWithCustomError(auctionContract, AuctionErrors.InvalidBidQuantity);
      });

      it("should revert if the bid price per token is zero", async function () {
        await expect(
          auctionContract.connect(alice).placeBid(1, 0, { value: parseEther("1") })
        ).to.be.revertedWithCustomError(auctionContract, AuctionErrors.InvalidPricePerToken);
        await expect(
          auctionContract.connect(alice).placeBid(1, parseUnits("1", 15), { value: 0 })
        ).to.be.revertedWithCustomError(auctionContract, AuctionErrors.InvalidBidPrice);
      });
    });

    context("when the bid is valid", function () {
      const totalPrice = getBidPrice(TOKEN_QUANTITY, PRICE_PER_TOKEN); // 10 tokens

      it("should revert if the bidder tries to place a bid again", async function () {
        await auctionContract
          .connect(alice)
          .placeBid(TOKEN_QUANTITY, PRICE_PER_TOKEN, { value: totalPrice });

        await expect(
          auctionContract
            .connect(alice)
            .placeBid(TOKEN_QUANTITY, PRICE_PER_TOKEN, { value: totalPrice })
        ).to.be.revertedWithCustomError(auctionContract, AuctionErrors.BidAlreadyPlaced);
      });

      it("should place a bid successfully", async function () {
        const contractBalBefore = await ethers.provider.getBalance(auctionAddress);

        const currentTime = (await time.latest()) + 1;
        await expect(
          auctionContract
            .connect(alice)
            .placeBid(TOKEN_QUANTITY, PRICE_PER_TOKEN, { value: totalPrice })
        )
          .to.emit(auctionContract, "BidPlaced")
          .withArgs(alice.address, TOKEN_QUANTITY, PRICE_PER_TOKEN);

        const bid = await auctionContract.bids(alice.address);

        expect(bid.quantity).to.equal(TOKEN_QUANTITY);
        expect(bid.pricePerToken).to.equal(PRICE_PER_TOKEN);
        expect(bid.bidder).to.equal(alice.address);
        expect(bid.timestamp).to.equal(currentTime);
        expect(bid.filled).to.equal(false);
        expect(bid.prev).to.equal(ZeroAddress);
        expect(bid.next).to.equal(ZeroAddress);

        expect((await auctionContract.state()).topBidder).to.equal(alice.address);
        expect((await auctionContract.state()).lastBidder).to.equal(alice.address);

        // assert the balance of the contract
        const contractBalAfter = await ethers.provider.getBalance(auctionAddress);
        expect(contractBalAfter).to.equal(totalPrice + contractBalBefore);
      });

      it("should revert if placing bid after auction ends", async function () {
        await advanceToAuctionEnd(auctionEndTime);

        await expect(
          auctionContract
            .connect(alice)
            .placeBid(TOKEN_QUANTITY, PRICE_PER_TOKEN, { value: totalPrice })
        ).to.be.revertedWithCustomError(auctionContract, AuctionErrors.AuctionEnded);
      });

      it("should measure gas cost for placing multiple bids", async function () {
        const bids = [];
        for (let i = 0; i < 100; i++) {
          bids.push(
            auctionContract
              .connect(accounts[i % accounts.length])
              .placeBid(parseEther("1"), parseEther("0.1"), {
                value: parseEther("0.1"),
              })
          );
        }
        const tx = await Promise.all(bids);
        // const gasUsed =
        await Promise.all(tx.map(async (t) => (await t.wait())?.gasUsed || 0n));
        // console.log(
        //   "Gas Used for 100 bids:",
        //   gasUsed.reduce((a, b) => a + b, 0n) / BigInt(gasUsed.length)
        // );
      });
    });
  });

  /*
  describe("#endAuction", function () {
    let endTime = 0;

    beforeEach(async function () {
      ({ endTime } = await approveAndStartAuction());
      await advanceToAuctionEnd(endTime);
    });

    context("when prerequisites are not met", function () {
      it("should revert if merkle root has not been submitted", async function () {
        await expect(auctionContract.connect(owner).endAuction())
          .to.be.revertedWithCustomError(auctionContract, AuctionErrors.InvalidAuctionStatus)
          .withArgs(AuctionStatus.MERKLE_SUBMITTED, AuctionStatus.ACTIVE);
      });

      it("should revert if the verification time is not over", async function () {
        await auctionContract.connect(owner).submitMerkleData(MOCK_SUBMIT_MERKLE_DATA_PARAMS);

        await expect(auctionContract.connect(alice).endAuction()).to.be.revertedWithCustomError(
          auctionContract,
          AuctionErrors.VerificationPeriodNotOver
        );
      });
    });

    context("when successfully ending the auction", function () {
      beforeEach(async function () {
        await auctionContract.connect(owner).submitMerkleData(MOCK_SUBMIT_MERKLE_DATA_PARAMS);
        await time.increase(VERIFICATION_WINDOW + TIME_BUFFER);
      });

      it("should emit an event and update state", async function () {
        await expect(auctionContract.connect(alice).endAuction())
          .to.emit(auctionContract, "AuctionEnded")
          .withArgs(alice.address);

        const auctionState = await auctionContract.state();
        expect(auctionState.status).to.equal(AuctionStatus.ENDED);
      });
    });
  });
   */
});
