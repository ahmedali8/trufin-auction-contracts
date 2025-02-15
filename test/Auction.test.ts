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
  let signers: Record<string, string>;
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let eve: SignerWithAddress;
  let accounts: SignerWithAddress[];

  // contracts
  let auctionContract: Auction;
  let tokenContract: MockToken;
  let auctionAddress: string;
  let tokenAddress: string;

  /// HELPER FUNCTIONS ///

  async function approveAndStartAuction(totalTokens: bigint = TOTAL_TOKENS) {
    const { currentTime, duration, endTime } = await getTimeData();

    await tokenContract.connect(owner).approve(auctionContract.getAddress(), totalTokens);
    await auctionContract.connect(owner).startAuction(totalTokens, duration);

    return { currentTime, duration, endTime };
  }

  before(async function () {
    [owner, alice, bob, eve, ...accounts] = await ethers.getSigners();
    signers = {
      [owner.address]: "owner",
      [alice.address]: "alice",
      [bob.address]: "bob",
      [eve.address]: "eve",
      [accounts[0].address]: "accounts[0]",
      [accounts[1].address]: "accounts[1]",
    };
  });

  beforeEach(async function () {
    const fixtures = await loadFixture(loadFixtures);
    auctionContract = fixtures.auction;
    auctionAddress = await auctionContract.getAddress();
    tokenContract = fixtures.token;
    tokenAddress = await tokenContract.getAddress();

    // Mint some tokens to the wallets
    const tokenAmount = parseEther("1000000");
    await Promise.all([tokenContract.mint(owner.address, tokenAmount)]);
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

  describe("#endAuction", function () {
    const totalTokens = parseEther("70");
    let auctionCurrentTime = 0;
    let duration = 0;
    let auctionEndTime = 0;

    beforeEach(async function () {
      ({
        currentTime: auctionCurrentTime,
        duration,
        endTime: auctionEndTime,
      } = await approveAndStartAuction(totalTokens));

      await advanceToAuctionStart(auctionCurrentTime);
    });

    context("when the auction is not ended", function () {
      it("should revert", async function () {
        await expect(auctionContract.endAuction()).to.be.revertedWithCustomError(
          auctionContract,
          AuctionErrors.AuctionInProgress
        );
      });
    });

    context("when the auction is ended", function () {
      beforeEach(async function () {
        // Place Bids //

        // alice places bid with 10 tokens and 1 eth
        console.log("alice", alice.address);
        await auctionContract.connect(alice).placeBid(parseEther("10"), parseEther("1"), {
          value: getBidPrice(parseEther("10"), parseEther("1")),
        });
        await logState(auctionContract, alice, "alice");

        // bob places bid with 20 tokens and 2 eth
        console.log("bob", bob.address);
        await auctionContract.connect(bob).placeBid(parseEther("20"), parseEther("2"), {
          value: getBidPrice(parseEther("20"), parseEther("2")),
        });
        await logState(auctionContract, bob, "bob");

        // eve places bid with 30 tokens and 3 eth
        console.log("eve", eve.address);
        await auctionContract.connect(eve).placeBid(parseEther("30"), parseEther("3"), {
          value: getBidPrice(parseEther("30"), parseEther("3")),
        });
        await logState(auctionContract, eve, "eve");

        // accounts[0] places bid with 20 tokens and 3 eth
        console.log("accounts[0]", accounts[0].address);
        await auctionContract.connect(accounts[0]).placeBid(parseEther("20"), parseEther("3"), {
          value: getBidPrice(parseEther("20"), parseEther("3")),
        });
        await logState(auctionContract, accounts[0], "accounts[0]");

        // accounts[1] places bid with 10 tokens and 1 eth
        console.log("accounts[1]", accounts[1].address);
        await auctionContract.connect(accounts[1]).placeBid(parseEther("10"), parseEther("1"), {
          value: getBidPrice(parseEther("10"), parseEther("1")),
        });
        await logState(auctionContract, accounts[1], "accounts[1]");

        await advanceToAuctionEnd(auctionEndTime);

        await auctionContract.connect(owner).endAuction();

        // lets log the whole path
        const one = (await auctionContract.state()).topBidder;
        const two = (await auctionContract.bids(one)).next;
        const three = (await auctionContract.bids(two)).next;
        const four = (await auctionContract.bids(three)).next;
        const five = (await auctionContract.bids(four)).next;

        console.log({
          one: signers[one],
          two: signers[two],
          three: signers[three],
          four: signers[four],
          five: signers[five],
        });

        // The expected order of bidders should be:
        // winners:
        // accounts[0]
        // eve
        // bob
        // non-winners:
        // alice
        // accounts[1]
      });

      it("should revert if the auction is already ended", async function () {
        await expect(auctionContract.endAuction()).to.be.revertedWithCustomError(
          auctionContract,
          AuctionErrors.AuctionEnded
        );
      });

      it("should update the auction state status to be ended", async function () {
        const auctionState = await auctionContract.state();
        expect(auctionState.status).to.equal(AuctionStatus.ENDED);
      });

      it("should set the correct bidder as the top and last bidder", async function () {
        const auctionState = await auctionContract.state();
        expect(auctionState.topBidder).to.equal(eve.address);
        expect(auctionState.lastBidder).to.equal(accounts[1].address);
      });
    });
  });
});

async function logState(auctionContract: Auction, caller: SignerWithAddress, name: string) {
  const state = await auctionContract.state();
  const bid = await auctionContract.bids(caller);
  console.log(`-----------------------------${name}-----------------------------`);
  console.log("State:");
  console.log("topBidder:", state.topBidder);
  console.log("lastBidder:", state.lastBidder);
  console.log("totalBidCount:", state.totalBidCount.toString());
  console.log("totalTokensForSale:", state.totalTokensForSale.toString());
  console.log("token:", state.token);
  console.log("endTime:", state.endTime.toString());
  console.log("status:", state.status);
  console.log("Bid:");
  console.log("quantity:", bid.quantity.toString());
  console.log("pricePerToken:", bid.pricePerToken.toString());
  console.log("bidder:", bid.bidder);
  console.log("timestamp:", bid.timestamp.toString());
  console.log("filled:", bid.filled);
  console.log("prev:", bid.prev);
  console.log("next:", bid.next);
  console.log("---------------------------------------------------------------");
}
