import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ZeroAddress, parseEther, parseUnits, zeroPadBytes } from "ethers";
import { ethers } from "hardhat";

import { generateMerkleTree } from "../lib/merkle-tree/generate-merkle-tree";
import type { Auction, MockToken } from "../types";
import type { IAuction } from "../types/contracts/Auction";
import { ZERO_BYTES32 } from "../utils/constants";
import {
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
    const startAuctionParams: IAuction.StartAuctionParamsStruct = {
      totalTokens: TOTAL_TOKENS,
      startTime: startTime,
      endTime: endTime,
      token: tokenAddress,
    };
    await auctionContract.connect(owner).startAuction(startAuctionParams, {
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

  describe("#submitMerkleData", function () {
    let startTime = 0;
    let endTime = 0;

    beforeEach(async function () {
      ({ startTime, endTime } = await approveAndStartAuction());
    });

    context("when called by non-owner", function () {
      it("should revert", async function () {
        const merkleDataParams: IAuction.MerkleDataParamsStruct = {
          merkleRoot: INVALID_MERKLE_ROOT,
          digest: MOCK_MULTI_HASH_IPFS.digest,
          hashFunction: MOCK_MULTI_HASH_IPFS.hashFunction,
          size: MOCK_MULTI_HASH_IPFS.size,
        };
        await expect(
          auctionContract.connect(alice).submitMerkleData(merkleDataParams)
        ).to.be.revertedWithCustomError(auctionContract, OwnableErrors.OwnableUnauthorizedAccount);
      });
    });

    context("when auction is not finalized", function () {
      it("should revert if its called before the auction has started", async function () {
        const merkleDataParams: IAuction.MerkleDataParamsStruct = {
          merkleRoot: INVALID_MERKLE_ROOT,
          digest: MOCK_MULTI_HASH_IPFS.digest,
          hashFunction: MOCK_MULTI_HASH_IPFS.hashFunction,
          size: MOCK_MULTI_HASH_IPFS.size,
        };
        await expect(auctionContract.connect(owner).submitMerkleData(merkleDataParams))
          .to.be.revertedWithCustomError(auctionContract, AuctionErrors.InvalidAuctionStatus)
          .withArgs(AuctionStatus.INACTIVE, AuctionStatus.ACTIVE);
      });

      it("should revert if its called during the auction", async function () {
        // Move time forward to the start of the auction
        await advanceToAuctionStart(startTime);

        const merkleDataParams: IAuction.MerkleDataParamsStruct = {
          merkleRoot: DUMMY_MERKLE_ROOT,
          digest: MOCK_MULTI_HASH_IPFS.digest,
          hashFunction: MOCK_MULTI_HASH_IPFS.hashFunction,
          size: MOCK_MULTI_HASH_IPFS.size,
        };
        await expect(
          auctionContract.connect(owner).submitMerkleData(merkleDataParams)
        ).to.be.revertedWithCustomError(auctionContract, "InvalidAuctionStatus");
      });
    });

    context("when auction has ended", function () {
      beforeEach(async function () {
        await advanceToAuctionEnd(endTime);
      });

      context("when submitting invalid data", function () {
        it("should revert if merkle root is invalid", async function () {
          const merkleDataParams: IAuction.MerkleDataParamsStruct = {
            merkleRoot: INVALID_MERKLE_ROOT,
            digest: INVALID_MULTI_HASH_IPFS.digest,
            hashFunction: INVALID_MULTI_HASH_IPFS.hashFunction,
            size: INVALID_MULTI_HASH_IPFS.size,
          };
          await expect(
            auctionContract.connect(owner).submitMerkleData(merkleDataParams)
          ).to.be.revertedWithCustomError(auctionContract, "InvalidMerkleRoot");
        });

        it("should revert if ipfs hash is invalid", async function () {
          const merkleDataParams: IAuction.MerkleDataParamsStruct = {
            merkleRoot: DUMMY_MERKLE_ROOT,
            digest: INVALID_MULTI_HASH_IPFS.digest,
            hashFunction: INVALID_MULTI_HASH_IPFS.hashFunction,
            size: INVALID_MULTI_HASH_IPFS.size,
          };
          await expect(
            auctionContract.connect(owner).submitMerkleData(merkleDataParams)
          ).to.be.revertedWithCustomError(auctionContract, "InvalidMultiHash");
        });
      });

      context("when submitting invalid data", function () {
        const merkleDataParams: IAuction.MerkleDataParamsStruct = {
          merkleRoot: DUMMY_MERKLE_ROOT,
          digest: MOCK_MULTI_HASH_IPFS.digest,
          hashFunction: MOCK_MULTI_HASH_IPFS.hashFunction,
          size: MOCK_MULTI_HASH_IPFS.size,
        };

        beforeEach(async function () {
          await expect(auctionContract.connect(owner).submitMerkleData(merkleDataParams))
            .to.emit(auctionContract, "MerkleRootSubmitted")
            .withArgs(
              DUMMY_MERKLE_ROOT,
              MOCK_MULTI_HASH_IPFS.digest,
              MOCK_MULTI_HASH_IPFS.hashFunction,
              MOCK_MULTI_HASH_IPFS.size
            );
        });

        it("should revert if merkle root is submitted twice", async function () {
          await expect(auctionContract.submitMerkleData(merkleDataParams))
            .to.be.revertedWithCustomError(auctionContract, AuctionErrors.InvalidAuctionStatus)
            .withArgs(AuctionStatus.ACTIVE, AuctionStatus.MERKLE_SUBMITTED);
        });

        it("should submit the merkle root and ipfs hash successfully", async function () {
          const auctionState = await auctionContract.state();
          expect(auctionState.merkleRoot).to.equal(DUMMY_MERKLE_ROOT);
          expect(auctionState.digest).to.equal(MOCK_MULTI_HASH_IPFS.digest);
          expect(auctionState.hashFunction).to.equal(MOCK_MULTI_HASH_IPFS.hashFunction);
          expect(auctionState.size).to.equal(MOCK_MULTI_HASH_IPFS.size);
        });
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

  describe("#claim", function () {
    const totalPrice = getBidPrice(TOKEN_QUANTITY, PRICE_PER_TOKEN); // 10 tokens

    let startTime = 0;
    let endTime = 0;
    let root = "";
    let proofs: Record<string, string[]> = {}; // bidder => proof
    let bids: { bidder: SignerWithAddress; quantity: bigint; bidId: bigint; serial: bigint }[] = [];

    beforeEach(async function () {
      ({ startTime, endTime } = await approveAndStartAuction());
      bids = [
        { bidder: alice, quantity: TOKEN_QUANTITY, bidId: 1n, serial: 0n },
        { bidder: bob, quantity: TOKEN_QUANTITY, bidId: 2n, serial: 1n },
        { bidder: accounts[0], quantity: TOKEN_QUANTITY, bidId: 3n, serial: 2n },
      ];

      await advanceToAuctionStart(startTime);

      for (const { bidder, quantity } of bids) {
        await auctionContract.connect(bidder).placeBid(quantity, PRICE_PER_TOKEN, {
          value: totalPrice,
        });
      }

      await advanceToAuctionEnd(endTime);

      // create a merkle root
      // We set the quantity to 0 for the accounts[0] bidder so he can't claim the tokens
      const data = bids.map((bid) => ({
        bidder: bid.bidder.address,
        serial: bid.serial,
        quantity: bid.bidder.address == accounts[0].address ? 0n : bid.quantity,
      }));

      ({ root, proofs } = generateMerkleTree(data));
      const merkleDataParams: IAuction.MerkleDataParamsStruct = {
        merkleRoot: root,
        digest: MOCK_MULTI_HASH_IPFS.digest,
        hashFunction: MOCK_MULTI_HASH_IPFS.hashFunction,
        size: MOCK_MULTI_HASH_IPFS.size,
      };
      await auctionContract.connect(owner).submitMerkleData(merkleDataParams);
    });

    it("should revert if the auction is not finalized", async function () {
      const bid = bids[0];

      const claimParams: IAuction.ClaimParamsStruct = {
        bidId: bid.bidId,
        quantity: TOKEN_QUANTITY,
        bidderSerial: bid.serial,
        proof: INVALID_PROOF,
      };

      await expect(auctionContract.connect(alice).claim(claimParams))
        .to.be.revertedWithCustomError(auctionContract, AuctionErrors.InvalidAuctionStatus)
        .withArgs(AuctionStatus.ENDED, AuctionStatus.MERKLE_SUBMITTED);
    });

    context("when auction is finished", function () {
      beforeEach(async function () {
        await time.increase(VERIFICATION_WINDOW + TIME_BUFFER);
        await auctionContract.connect(bob).endAuction();

        // Mint some tokens to the auction contract
        await tokenContract.mint(auctionAddress, TOKEN_AMOUNT * 2n);
      });

      context("when claim conditions are invalid", function () {
        it("should revert if the bid does not exist", async function () {
          const nonExistentBidId = 999;

          const claimParams: IAuction.ClaimParamsStruct = {
            bidId: nonExistentBidId,
            quantity: TOKEN_QUANTITY,
            bidderSerial: 0n,
            proof: INVALID_PROOF,
          };

          await expect(
            auctionContract.connect(alice).claim(claimParams)
          ).to.be.revertedWithCustomError(auctionContract, AuctionErrors.BidDoesNotExist);
        });

        it("should revert if tokens are already claimed", async function () {
          const bid = bids[0];

          const claimParams: IAuction.ClaimParamsStruct = {
            bidId: bid.bidId,
            quantity: TOKEN_QUANTITY,
            bidderSerial: bid.serial,
            proof: proofs[alice.address],
          };

          // Claim tokens for the first time
          await auctionContract.connect(alice).claim(claimParams);

          // Try to claim tokens again
          await expect(
            auctionContract.connect(alice).claim(claimParams)
          ).to.be.revertedWithCustomError(auctionContract, AuctionErrors.BidDoesNotExist);
        });

        it("should revert when winner tries to claim eth", async function () {
          const bid = bids[0];

          // Alice is the winner and she should give correct quantity but she gave 0 to claim the eth
          const claimParams: IAuction.ClaimParamsStruct = {
            bidId: bid.bidId,
            quantity: 0n,
            bidderSerial: bid.serial,
            proof: proofs[alice.address],
          };

          // This would fail with `InvalidMerkleProof()` as the given quantity is not correct and won't be verified
          await expect(auctionContract.connect(alice).claim(claimParams))
            .to.be.revertedWithCustomError(auctionContract, AuctionErrors.InvalidMerkleProof)
            .withArgs(proofs[alice.address]);
        });

        it("should revert when non-winner tries to claim tokens", async function () {
          const bid = bids[2];

          // caller is not the winner and he should give correct quantity (0) but he gave 100 to claim the tokens
          const claimParams: IAuction.ClaimParamsStruct = {
            bidId: bid.bidId,
            quantity: parseEther("100"),
            bidderSerial: bid.serial,
            proof: proofs[bid.bidder.address],
          };

          // This would fail with `InvalidMerkleProof()` as the given quantity is not correct and won't be verified
          await expect(auctionContract.connect(bid.bidder).claim(claimParams))
            .to.be.revertedWithCustomError(auctionContract, AuctionErrors.InvalidMerkleProof)
            .withArgs(proofs[bid.bidder.address]);
        });
      });

      context("when claims are valid", function () {
        context("when non-winner tries to claim before winner", function () {
          it("should revert", async function () {
            const bid = bids[2];
            const quantity = 0; // non-winner

            const claimParams: IAuction.ClaimParamsStruct = {
              bidId: bid.bidId,
              quantity: quantity,
              bidderSerial: bid.serial,
              proof: proofs[bid.bidder.address],
            };

            await expect(
              auctionContract.connect(bid.bidder).claim(claimParams)
            ).to.be.revertedWithCustomError(auctionContract, AuctionErrors.InvalidBidderClaim);
          });
        });

        context("when bidders claim in serial order", function () {
          beforeEach(async function () {
            const bid = bids[0];

            const quantity = (await auctionContract.bids(bid.bidId)).quantity;

            const aliceBalanceBefore = await tokenContract.balanceOf(bid.bidder.address);

            const claimParams: IAuction.ClaimParamsStruct = {
              bidId: bid.bidId,
              quantity: quantity,
              bidderSerial: bid.serial,
              proof: proofs[alice.address],
            };

            await expect(auctionContract.connect(bid.bidder).claim(claimParams))
              .to.emit(auctionContract, "TokensClaimed")
              .withArgs(alice.address, quantity);

            const bidData = await auctionContract.bids(bid.bidId);
            expect(bidData.quantity).to.equal(0);

            const aliceBalanceAfter = await tokenContract.balanceOf(bid.bidder.address);
            expect(aliceBalanceAfter).to.equal(aliceBalanceBefore + quantity);
          });

          it("should allow 1st winner to claim tokens successfully", async function () {
            const nextBidderSerial = await auctionContract.nextBidderSerial();
            const expectedNextBidderSerial = 2n;
            expect(nextBidderSerial).to.equal(expectedNextBidderSerial);
          });

          it("should allow non-winner to claim eth successfully", async function () {
            // 2nd winner claims too
            const secondBid = bids[1];
            await auctionContract.connect(secondBid.bidder).claim({
              bidId: secondBid.bidId,
              quantity: secondBid.quantity,
              bidderSerial: secondBid.serial,
              proof: proofs[secondBid.bidder.address],
            });

            const bid = bids[2];
            const quantity = 0; // non-winner

            const beforeBal = await ethers.provider.getBalance(bid.bidder.address);

            const claimParams: IAuction.ClaimParamsStruct = {
              bidId: bid.bidId,
              quantity: quantity,
              bidderSerial: bid.serial,
              proof: proofs[bid.bidder.address],
            };

            const gasFeeDelta = await getGasFee(
              auctionContract.connect(bid.bidder).claim(claimParams)
            );
            const bidData = await auctionContract.bids(bid.bidId);
            expect(bidData.bidder).to.equal(ZeroAddress);
            expect(bidData.quantity).to.equal(0);

            const afterBal = await ethers.provider.getBalance(bid.bidder.address);

            // 0.000049256451344628 eth fee delta
            expect(afterBal).to.approximately(beforeBal + totalPrice, gasFeeDelta);
          });
        });
      });
    });
  });

  describe("#slash", function () {
    let endTime = 0;

    const oldMerkleDataParams: IAuction.MerkleDataParamsStruct = {
      merkleRoot: DUMMY_MERKLE_ROOT,
      digest: MOCK_MULTI_HASH_IPFS.digest,
      hashFunction: MOCK_MULTI_HASH_IPFS.hashFunction,
      size: MOCK_MULTI_HASH_IPFS.size,
    };

    const newMerkleDataParams: IAuction.MerkleDataParamsStruct = {
      merkleRoot: zeroPadBytes("0x02", 32),
      // cid: QmdmQXB2mzChmMeKY47C43LxUdg1NDJ5MWcKMKxDu7RgQm
      digest: "0xE536C7F88D731F374DCCB568AFF6F56E838A19382E488039B1CA8AD2599E82FE",
      hashFunction: 18, // 0x12
      size: 50, // 0x32
    };

    beforeEach(async function () {
      ({ endTime } = await approveAndStartAuction());
    });

    context("when called by non-verifier", function () {
      it("should revert", async function () {
        const slashParams: IAuction.MerkleDataParamsStruct = {
          merkleRoot: INVALID_MERKLE_ROOT,
          digest: INVALID_MULTI_HASH_IPFS.digest,
          hashFunction: INVALID_MULTI_HASH_IPFS.hashFunction,
          size: INVALID_MULTI_HASH_IPFS.size,
        };

        await expect(
          auctionContract.connect(alice).slash(slashParams)
        ).to.be.revertedWithCustomError(
          auctionContract,
          AuctionErrors.OnlyVerifierCanResolveDispute
        );
      });
    });

    context("when merkle is not submitted", function () {
      it("should revert", async function () {
        await expect(auctionContract.connect(verifier).slash(oldMerkleDataParams))
          .to.be.revertedWithCustomError(auctionContract, AuctionErrors.InvalidAuctionStatus)
          .withArgs(AuctionStatus.MERKLE_SUBMITTED, AuctionStatus.ACTIVE);
      });
    });

    context("when merkle is submitted", function () {
      beforeEach(async function () {
        await advanceToAuctionEnd(endTime);

        await auctionContract.connect(owner).submitMerkleData(oldMerkleDataParams);
      });

      it("should revert if the merkle root is invalid", async function () {
        const slashParams: IAuction.MerkleDataParamsStruct = {
          merkleRoot: INVALID_MERKLE_ROOT,
          digest: MOCK_MULTI_HASH_IPFS.digest,
          hashFunction: MOCK_MULTI_HASH_IPFS.hashFunction,
          size: MOCK_MULTI_HASH_IPFS.size,
        };

        await expect(
          auctionContract.connect(verifier).slash(slashParams)
        ).to.be.revertedWithCustomError(auctionContract, AuctionErrors.InvalidMerkleRoot);
      });

      it("should revert if the ipfs hash data is invalid", async function () {
        const slashParams: IAuction.MerkleDataParamsStruct = {
          merkleRoot: newMerkleDataParams.merkleRoot,
          digest: INVALID_MULTI_HASH_IPFS.digest,
          hashFunction: INVALID_MULTI_HASH_IPFS.hashFunction,
          size: INVALID_MULTI_HASH_IPFS.size,
        };

        await expect(
          auctionContract.connect(verifier).slash(slashParams)
        ).to.be.revertedWithCustomError(auctionContract, AuctionErrors.InvalidMultiHash);
      });

      it("should revert if the merkle is set but verification time hash expired", async function () {
        // time is over
        await time.increase(VERIFICATION_WINDOW + TIME_BUFFER);

        await expect(
          auctionContract.connect(verifier).slash(newMerkleDataParams)
        ).to.be.revertedWithCustomError(auctionContract, AuctionErrors.VerificationWindowExpired);
      });

      it("should slash the owner and emit events", async function () {
        const balBefore = await ethers.provider.getBalance(verifier.address);
        const gasFee = await getGasFee(
          auctionContract.connect(verifier).slash(newMerkleDataParams)
        );
        const balAfter = await ethers.provider.getBalance(verifier.address);
        expect(balAfter).to.approximately(balBefore + SECURITY_DEPOSIT, gasFee);
      });
    });
  });
});
