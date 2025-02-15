import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ZeroAddress, parseEther, parseUnits } from "ethers";
import { ethers } from "hardhat";

import type { Auction, MockToken } from "../types";
import {
  AUCTION_DURATION,
  AuctionStatus,
  PRICE_PER_TOKEN,
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
  getTimeData,
} from "./shared/helpers";
import { logState } from "./shared/loggers";

describe("Auction Tests", function () {
  // signers
  let signerNames: Record<string, string>;
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

  async function placeBid(bidder: SignerWithAddress, quantity: string, price: string) {
    const gasFeeDelta = await getGasFee(
      auctionContract.connect(bidder).placeBid(parseEther(quantity), parseEther(price), {
        value: getBidPrice(parseEther(quantity), parseEther(price)),
      })
    );
    await logState(signerNames, auctionContract, bidder);
    return gasFeeDelta;
  }

  before(async function () {
    [owner, alice, bob, eve, ...accounts] = await ethers.getSigners();
    signerNames = {
      [owner.address]: "owner",
      [alice.address]: "alice",
      [bob.address]: "bob",
      [eve.address]: "eve",
      [accounts[0].address]: "accounts[0]",
      [accounts[1].address]: "accounts[1]",
    };
  });

  beforeEach(async function () {
    ({
      auction: auctionContract,
      token: tokenContract,
      auctionAddress,
      tokenAddress,
    } = await loadFixture(loadFixtures));

    // Mint some tokens to the wallets
    const tokenAmount = parseEther("1000000");
    await tokenContract.mint(owner.address, tokenAmount);
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
    let auctionEndTime = 0;

    beforeEach(async function () {
      ({ currentTime: auctionCurrentTime, endTime: auctionEndTime } =
        await approveAndStartAuction());

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
    let auctionEndTime = 0;

    beforeEach(async function () {
      ({ currentTime: auctionCurrentTime, endTime: auctionEndTime } =
        await approveAndStartAuction(totalTokens));

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
      const bidders: string[] = [];
      let nonWinnerEthBalancesBefore: bigint[] = [];
      let gasFeeDeltaAlice: bigint = 0n;
      let gasFeeDeltaAccount1: bigint = 0n;

      beforeEach(async function () {
        nonWinnerEthBalancesBefore = await Promise.all([
          await ethers.provider.getBalance(alice.address),
          await ethers.provider.getBalance(accounts[1].address),
        ]);

        // Place Bids //

        // alice places bid with 10 tokens and 1 eth (total 10 eth)
        gasFeeDeltaAlice = (await placeBid(alice, "10", "1")) as bigint;

        // bob places bid with 20 tokens and 2 eth (total 40 eth)
        await placeBid(bob, "20", "2");

        // eve places bid with 30 tokens and 3 eth (total 90 eth)
        await placeBid(eve, "30", "3");

        // accounts[0] places bid with 20 tokens and 3 eth (total 60 eth)
        await placeBid(accounts[0], "20", "3");

        // accounts[1] places bid with 10 tokens and 1 eth (total 10 eth)
        gasFeeDeltaAccount1 = (await placeBid(accounts[1], "10", "1")) as bigint;

        // Total eth in the contract should be 210 eth
        expect(await ethers.provider.getBalance(auctionAddress)).to.equal(parseEther("210"));

        await advanceToAuctionEnd(auctionEndTime);

        // Validate expected sorted linked list
        let currentBidder = (await auctionContract.state()).topBidder;
        while (currentBidder !== ZeroAddress) {
          bidders.push(currentBidder);
          currentBidder = (await auctionContract.bids(currentBidder)).next;
        }
      });

      it("should revert", async function () {
        await auctionContract.connect(owner).endAuction();

        await expect(auctionContract.endAuction()).to.be.revertedWithCustomError(
          auctionContract,
          AuctionErrors.AuctionEnded
        );
      });

      it("should update the state and bidders correctly", async function () {
        const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
        const tokenBalancesBefore = await Promise.all([
          await tokenContract.connect(alice).balanceOf(alice.address),
          await tokenContract.connect(bob).balanceOf(bob.address),
          await tokenContract.connect(eve).balanceOf(eve.address),
          await tokenContract.connect(accounts[0]).balanceOf(accounts[0].address),
          await tokenContract.connect(accounts[1]).balanceOf(accounts[1].address),
        ]);

        // The expected order of bidders should be:
        // winners: eve, accounts[0], bob
        // non-winners: alice, accounts[1]
        const gasFeeDelta = await getGasFee(auctionContract.connect(owner).endAuction());

        const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);

        const tokenBalancesAfter = await Promise.all([
          await tokenContract.connect(alice).balanceOf(alice.address),
          await tokenContract.connect(bob).balanceOf(bob.address),
          await tokenContract.connect(eve).balanceOf(eve.address),
          await tokenContract.connect(accounts[0]).balanceOf(accounts[0].address),
          await tokenContract.connect(accounts[1]).balanceOf(accounts[1].address),
        ]);

        const nonWinnerEthBalancesAfter = await Promise.all([
          await ethers.provider.getBalance(alice.address),
          await ethers.provider.getBalance(accounts[1].address),
        ]);

        // winners //

        // eve
        expect(bidders[0]).to.equal(eve.address);
        expect(tokenBalancesAfter[2]).to.equal(tokenBalancesBefore[2] + parseEther("30"));
        expect((await auctionContract.bids(bidders[0])).filled).to.equal(true);

        // accounts[0]
        expect(bidders[1]).to.equal(accounts[0].address);
        expect(tokenBalancesAfter[3]).to.equal(tokenBalancesBefore[3] + parseEther("20"));
        expect((await auctionContract.bids(bidders[1])).filled).to.equal(true);

        // bob
        expect(bidders[2]).to.equal(bob.address);
        expect(tokenBalancesAfter[1]).to.equal(tokenBalancesBefore[1] + parseEther("20"));
        expect((await auctionContract.bids(bidders[2])).filled).to.equal(true);

        // non-winners //

        // alice
        expect(bidders[3]).to.equal(alice.address);
        expect(tokenBalancesAfter[0]).to.equal(tokenBalancesBefore[0]);
        expect((await auctionContract.bids(bidders[3])).filled).to.equal(false);

        // accounts[1]
        expect(bidders[4]).to.equal(accounts[1].address);
        expect(tokenBalancesAfter[4]).to.equal(tokenBalancesBefore[4]);
        expect((await auctionContract.bids(bidders[4])).filled).to.equal(false);

        const auctionState = await auctionContract.state();

        expect(auctionState.status).to.equal(AuctionStatus.ENDED);
        expect(auctionState.topBidder).to.equal(eve.address);
        expect(auctionState.lastBidder).to.equal(accounts[1].address);

        // the contract should have no eth
        const contractBal = await ethers.provider.getBalance(auctionAddress);
        expect(contractBal).to.equal(0);

        // the owner should have received the winning bidders' eth (190 eth)
        expect(ownerBalanceAfter).to.approximately(
          ownerBalanceBefore + parseEther("190"),
          gasFeeDelta
        );

        // the non-winners should have received their eth back
        expect(nonWinnerEthBalancesAfter[0]).to.approximately(
          nonWinnerEthBalancesBefore[0],
          gasFeeDeltaAlice
        );
        expect(nonWinnerEthBalancesAfter[1]).to.approximately(
          nonWinnerEthBalancesBefore[1],
          gasFeeDeltaAccount1
        );
      });
    });
  });
});
