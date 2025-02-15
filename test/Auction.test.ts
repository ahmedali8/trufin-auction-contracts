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
  DUMMY_MERKLE_ROOT,
  INVALID_MERKLE_ROOT,
  INVALID_MULTI_HASH_IPFS,
  INVALID_PROOF,
  MOCK_MULTI_HASH_IPFS,
  MOCK_SUBMIT_MERKLE_DATA_PARAMS,
  PRICE_PER_TOKEN,
  SECURITY_DEPOSIT,
  TIME_BUFFER,
  TOKEN_AMOUNT,
  TOKEN_QUANTITY,
  TOTAL_TOKENS,
  VERIFICATION_WINDOW,
} from "./shared/constants";
import { AuctionErrors, ERC20TokenErrors, OwnableErrors } from "./shared/errors";
import { loadFixtures } from "./shared/fixtures";
import {
  advanceToAuctionEnd,
  advanceToAuctionStart,
  getBidPrice,
  getDuration,
  getGasFee,
  getStartAndEndTime,
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
    const { startTime, endTime } = await getStartAndEndTime();
    await tokenContract.connect(owner).approve(auctionContract.getAddress(), TOTAL_TOKENS);
    await auctionContract.connect(owner).startAuction(TOTAL_TOKENS, AUCTION_DURATION, {
      value: SECURITY_DEPOSIT,
    });

    return { startTime, endTime };
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
    it("should revert if the initial verifier is zero address", async function () {
      const AuctionFactory = await ethers.getContractFactory("Auction");
      await expect(AuctionFactory.connect(owner).deploy(owner.address, ZeroAddress)).to.be.reverted;
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
        const startAuctionParams: IAuction.StartAuctionParamsStruct = {
          totalTokens: parseEther("1"),
          startTime: 1739058738,
          endTime: 1739058738,
          token: ZeroAddress,
        };

        await expect(
          auctionContract.connect(alice).startAuction(startAuctionParams, {
            value: SECURITY_DEPOSIT,
          })
        ).to.be.revertedWithCustomError(auctionContract, OwnableErrors.OwnableUnauthorizedAccount);
      });
    });

    context("when deposit is incorrect", function () {
      it("should revert if deposit not paid", async function () {
        const startAuctionParams: IAuction.StartAuctionParamsStruct = {
          totalTokens: parseEther("1"),
          startTime: 1739058738,
          endTime: 1739058738,
          token: ZeroAddress,
        };

        await expect(
          auctionContract.connect(owner).startAuction(startAuctionParams, {
            value: 0n,
          })
        ).to.be.revertedWithCustomError(auctionContract, AuctionErrors.InvalidSecurityDeposit);
      });
    });

    context("when params are invalid", function () {
      it("should revert if the token address is the zero address", async function () {
        const startAuctionParams: IAuction.StartAuctionParamsStruct = {
          totalTokens: parseEther("1"),
          startTime: 1739058738,
          endTime: 1739058738,
          token: ZeroAddress,
        };

        await expect(
          auctionContract.startAuction(startAuctionParams, {
            value: SECURITY_DEPOSIT,
          })
        ).to.be.revertedWithCustomError(auctionContract, AuctionErrors.InvalidAddress);
      });

      it("should revert if the total tokens is zero", async function () {
        const startAuctionParams: IAuction.StartAuctionParamsStruct = {
          totalTokens: 0,
          startTime: 1739058738,
          endTime: 1739058738,
          token: tokenAddress,
        };

        await expect(
          auctionContract.startAuction(startAuctionParams, {
            value: SECURITY_DEPOSIT,
          })
        ).to.be.revertedWithCustomError(auctionContract, AuctionErrors.ZeroTotalTokens);
      });

      it("should revert if the start time is in the past", async function () {
        const startAuctionParams: IAuction.StartAuctionParamsStruct = {
          totalTokens: parseEther("1"),
          startTime: 0,
          endTime: 1739058738,
          token: tokenAddress,
        };

        await expect(
          auctionContract.startAuction(startAuctionParams, {
            value: SECURITY_DEPOSIT,
          })
        )
          .to.be.revertedWithCustomError(auctionContract, AuctionErrors.InvalidAuctionTimeParams)
          .withArgs(startAuctionParams.startTime, startAuctionParams.endTime);
      });

      it("should revert if the end time is before the start time", async function () {
        const startAuctionParams: IAuction.StartAuctionParamsStruct = {
          totalTokens: parseEther("1"),
          startTime: 1739058738,
          endTime: 1739058737,
          token: tokenAddress,
        };

        await expect(
          auctionContract.startAuction(startAuctionParams, {
            value: SECURITY_DEPOSIT,
          })
        )
          .to.be.revertedWithCustomError(auctionContract, AuctionErrors.InvalidAuctionTimeParams)
          .withArgs(startAuctionParams.startTime, startAuctionParams.endTime);
      });
    });

    context("when params are valid", function () {
      it("should revert if tokens not approved", async function () {
        const { startTime, endTime } = await getStartAndEndTime();

        const startAuctionParams: IAuction.StartAuctionParamsStruct = {
          totalTokens: TOTAL_TOKENS,
          startTime: startTime,
          endTime: endTime,
          token: tokenAddress,
        };

        await expect(
          auctionContract.startAuction(startAuctionParams, {
            value: SECURITY_DEPOSIT,
          })
        ).to.be.revertedWithCustomError(tokenContract, ERC20TokenErrors.ERC20InsufficientAllowance);
      });

      context("when create a new auction", function () {
        let startTime = 0;
        let endTime = 0;
        let startAuctionParams: IAuction.StartAuctionParamsStruct =
          {} as IAuction.StartAuctionParamsStruct;

        beforeEach(async function () {
          ({ startTime, endTime } = await getStartAndEndTime());

          startAuctionParams = {
            totalTokens: TOTAL_TOKENS,
            startTime: startTime,
            endTime: endTime,
            token: tokenAddress,
          };

          // Approve the auction contract to spend the tokens
          await tokenContract.approve(auctionContract.getAddress(), TOTAL_TOKENS);

          await expect(
            auctionContract.startAuction(startAuctionParams, {
              value: SECURITY_DEPOSIT,
            })
          )
            .to.emit(auctionContract, "AuctionStarted")
            .withArgs(tokenAddress, TOTAL_TOKENS, startTime, endTime);
        });

        it("should revert if auction is started again", async function () {
          await expect(
            auctionContract.startAuction(startAuctionParams, {
              value: SECURITY_DEPOSIT,
            })
          ).to.be.revertedWithCustomError(auctionContract, AuctionErrors.AuctionExists);
        });

        it("should emit event and update state", async function () {
          const auctionState = await auctionContract.state();

          // expect
          expect(auctionState.token).to.equal(tokenAddress);
          expect(auctionState.totalTokens).to.equal(TOTAL_TOKENS);
          expect(auctionState.startTime).to.equal(startTime);
          expect(auctionState.endTime).to.equal(endTime);
          expect(auctionState.merkleRoot).to.equal(INVALID_MERKLE_ROOT);

          expect(auctionState.status).to.equal(AuctionStatus.ACTIVE);
          expect(auctionState.verificationDeadline).to.equal(0);
          expect(auctionState.isOwnerSlashed).to.equal(false);

          // MultiHash
          expect(auctionState.hashFunction).to.equal(0);
          expect(auctionState.size).to.equal(0);
          expect(auctionState.digest).to.equal(ZERO_BYTES32);
        });
      });
    });
  });

  describe("#placeBid", function () {
    let startTime = 0;
    let endTime = 0;

    beforeEach(async function () {
      ({ startTime, endTime } = await approveAndStartAuction());

      await advanceToAuctionStart(startTime);
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

      it("should place a bid successfully", async function () {
        const contractBalBefore = await ethers.provider.getBalance(auctionAddress);

        const expectedBidId = 1n;
        const actualBidId = await auctionContract.nextBidId();
        expect(actualBidId).to.equal(expectedBidId);
        await expect(
          auctionContract
            .connect(alice)
            .placeBid(TOKEN_QUANTITY, PRICE_PER_TOKEN, { value: totalPrice })
        )
          .to.emit(auctionContract, "BidPlaced")
          .withArgs(actualBidId, alice.address, TOKEN_QUANTITY, PRICE_PER_TOKEN);

        const bid = await auctionContract.bids(actualBidId);

        expect(bid.bidder).to.equal(alice.address);
        expect(bid.quantity).to.equal(TOKEN_QUANTITY);
        expect(bid.pricePerToken).to.equal(PRICE_PER_TOKEN);

        const actualNewBidId = await auctionContract.nextBidId();
        const expectedNewBidId = expectedBidId + 1n;
        expect(actualNewBidId).to.equal(expectedNewBidId);

        // assert the balance of the contract
        const contractBalAfter = await ethers.provider.getBalance(auctionAddress);
        expect(contractBalAfter).to.equal(totalPrice + contractBalBefore);
      });

      it("should revert if placing bid after auction ends", async function () {
        await advanceToAuctionEnd(endTime);

        await expect(
          auctionContract
            .connect(alice)
            .placeBid(TOKEN_QUANTITY, PRICE_PER_TOKEN, { value: totalPrice })
        )
          .to.be.revertedWithCustomError(auctionContract, AuctionErrors.InvalidAuctionStatus)
          .withArgs(AuctionStatus.ACTIVE, AuctionStatus.ENDED);
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
});
