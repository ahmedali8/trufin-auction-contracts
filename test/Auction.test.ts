import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ZeroAddress, parseEther, parseUnits, zeroPadBytes } from "ethers";
import { ethers } from "hardhat";

import { generateMerkleTree } from "../lib/merkle-tree/generate-merkle-tree";
import type { Auction, MockToken } from "../types";
import { IAuction } from "../types/contracts/Auction";
import { ZERO_BYTES32 } from "../utils/constants";
import {
  DUMMY_IPFS_HASH,
  DUMMY_MERKLE_ROOT,
  INVALID_IPFS_HASH,
  INVALID_MERKLE_ROOT,
  INVALID_MULTI_HASH_IPFS,
  INVALID_PROOF,
  MOCK_MULTI_HASH_IPFS,
  PRICE_PER_TOKEN,
  SECURITY_DEPOSIT,
  TIME_BUFFER,
  TOKEN_AMOUNT,
  TOKEN_QUANTITY,
  TOTAL_TOKENS,
  VERIFICATION_WINDOW,
} from "./shared/constants";
import { loadFixtures } from "./shared/fixtures";
import {
  advanceToAuctionEnd,
  advanceToAuctionStart,
  getBidPrice,
  getGasFee,
  getStartAndEndTime,
} from "./shared/helpers";

export enum AuctionStatus {
  STARTED,
  MERKLE_SUBMITTED,
  ENDED,
}

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
        ).to.be.revertedWithCustomError(auctionContract, "OwnableUnauthorizedAccount");
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
          auctionContract.connect(alice).startAuction(startAuctionParams, {
            value: 0n,
          })
        ).to.be.revertedWithCustomError(auctionContract, "OwnableUnauthorizedAccount");
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
        ).to.be.revertedWithCustomError(auctionContract, "AddressZero");
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
        ).to.be.revertedWithCustomError(auctionContract, "InvalidTotalTokens");
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
        ).to.be.revertedWithCustomError(auctionContract, "InvalidAuctionTime");
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
        ).to.be.revertedWithCustomError(auctionContract, "InvalidAuctionTime");
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
        ).to.be.revertedWithCustomError(tokenContract, "ERC20InsufficientAllowance");
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
          ).to.be.revertedWithCustomError(auctionContract, "AuctionAlreadyExists");
        });

        it("should emit event and update state", async function () {
          const auctionState = await auctionContract.state();

          // expect
          expect(auctionState.token).to.equal(tokenAddress);
          expect(auctionState.totalTokens).to.equal(TOTAL_TOKENS);
          expect(auctionState.startTime).to.equal(startTime);
          expect(auctionState.endTime).to.equal(endTime);
          expect(auctionState.merkleRoot).to.equal(INVALID_MERKLE_ROOT);

          expect(auctionState.status).to.equal(AuctionStatus.STARTED);
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
    let startTime = 0,
      endTime = 0;

    beforeEach(async function () {
      ({ startTime, endTime } = await approveAndStartAuction());

      await advanceToAuctionStart(startTime);
    });

    context("when the bid or params are invalid", function () {
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
          auctionContract.connect(alice).placeBid(1, 0, { value: parseEther("1") })
        ).to.be.revertedWithCustomError(auctionContract, "InvalidPricePerToken");
        await expect(
          auctionContract.connect(alice).placeBid(1, parseUnits("1", 15), { value: 0 })
        ).to.be.revertedWithCustomError(auctionContract, "InvalidBidPrice");
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
        ).to.be.revertedWithCustomError(auctionContract, "AuctionNotActive");
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
        const gasUsed = await Promise.all(tx.map(async (t) => (await t.wait())?.gasUsed || 0n));
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
        const submitMerkleDataParams: IAuction.SubmitMerkleDataParamsStruct = {
          merkleRoot: INVALID_MERKLE_ROOT,
          digest: MOCK_MULTI_HASH_IPFS.digest,
          hashFunction: MOCK_MULTI_HASH_IPFS.hashFunction,
          size: MOCK_MULTI_HASH_IPFS.size,
        };
        await expect(
          auctionContract.connect(alice).submitMerkleData(submitMerkleDataParams)
        ).to.be.revertedWithCustomError(auctionContract, "OwnableUnauthorizedAccount");
      });
    });

    context("when auction is not finalized", function () {
      it("should revert if its called before the auction has started", async function () {
        const submitMerkleDataParams: IAuction.SubmitMerkleDataParamsStruct = {
          merkleRoot: INVALID_MERKLE_ROOT,
          digest: MOCK_MULTI_HASH_IPFS.digest,
          hashFunction: MOCK_MULTI_HASH_IPFS.hashFunction,
          size: MOCK_MULTI_HASH_IPFS.size,
        };
        await expect(
          auctionContract.connect(owner).submitMerkleData(submitMerkleDataParams)
        ).to.be.revertedWithCustomError(auctionContract, "AuctionStillActive");
      });

      it("should revert if its called during the auction", async function () {
        // Move time forward to the start of the auction
        await advanceToAuctionStart(startTime);

        const submitMerkleDataParams: IAuction.SubmitMerkleDataParamsStruct = {
          merkleRoot: INVALID_MERKLE_ROOT,
          digest: MOCK_MULTI_HASH_IPFS.digest,
          hashFunction: MOCK_MULTI_HASH_IPFS.hashFunction,
          size: MOCK_MULTI_HASH_IPFS.size,
        };
        await expect(
          auctionContract.connect(owner).submitMerkleData(submitMerkleDataParams)
        ).to.be.revertedWithCustomError(auctionContract, "AuctionStillActive");
      });
    });

    context("when auction has ended", function () {
      beforeEach(async function () {
        await advanceToAuctionEnd(endTime);
      });

      context("when submitting invalid data", function () {
        it("should revert if merkle root is invalid", async function () {
          const submitMerkleDataParams: IAuction.SubmitMerkleDataParamsStruct = {
            merkleRoot: INVALID_MERKLE_ROOT,
            digest: INVALID_MULTI_HASH_IPFS.digest,
            hashFunction: INVALID_MULTI_HASH_IPFS.hashFunction,
            size: INVALID_MULTI_HASH_IPFS.size,
          };
          await expect(
            auctionContract.connect(owner).submitMerkleData(submitMerkleDataParams)
          ).to.be.revertedWithCustomError(auctionContract, "InvalidMerkleRoot");
        });

        it("should revert if ipfs hash is invalid", async function () {
          const submitMerkleDataParams: IAuction.SubmitMerkleDataParamsStruct = {
            merkleRoot: DUMMY_MERKLE_ROOT,
            digest: INVALID_MULTI_HASH_IPFS.digest,
            hashFunction: INVALID_MULTI_HASH_IPFS.hashFunction,
            size: INVALID_MULTI_HASH_IPFS.size,
          };
          await expect(
            auctionContract.connect(owner).submitMerkleData(submitMerkleDataParams)
          ).to.be.revertedWithCustomError(auctionContract, "InvalidMultiHash");
        });
      });

      context("when submitting invalid data", function () {
        const submitMerkleDataParams: IAuction.SubmitMerkleDataParamsStruct = {
          merkleRoot: DUMMY_MERKLE_ROOT,
          digest: MOCK_MULTI_HASH_IPFS.digest,
          hashFunction: MOCK_MULTI_HASH_IPFS.hashFunction,
          size: MOCK_MULTI_HASH_IPFS.size,
        };

        beforeEach(async function () {
          await expect(auctionContract.connect(owner).submitMerkleData(submitMerkleDataParams))
            .to.emit(auctionContract, "MerkleRootSubmitted")
            .withArgs(
              DUMMY_MERKLE_ROOT,
              MOCK_MULTI_HASH_IPFS.digest,
              MOCK_MULTI_HASH_IPFS.hashFunction,
              MOCK_MULTI_HASH_IPFS.size
            );
        });

        it("should revert if merkle root is submitted twice", async function () {
          await expect(
            auctionContract.submitMerkleData(submitMerkleDataParams)
          ).to.be.revertedWithCustomError(auctionContract, "AuctionNotActive");
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

  /*

  describe("#endAuction", function () {
    let startTime = 0,
      endTime = 0;

    beforeEach(async function () {
      ({ startTime, endTime } = await approveAndStartAuction());
      await advanceToAuctionEnd(endTime);
    });

    context("when prerequisites are not met", function () {
      it("should revert if merkle root has not been submitted", async function () {
        await expect(auctionContract.connect(owner).endAuction()).to.be.revertedWithCustomError(
          auctionContract,
          "InvalidMerkleRoot"
        );
      });

      it("should revert if the verification time is not over", async function () {
        await auctionContract.connect(owner).submitMerkleData(DUMMY_MERKLE_ROOT, DUMMY_IPFS_HASH);

        await expect(auctionContract.connect(alice).endAuction()).to.be.revertedWithCustomError(
          auctionContract,
          "VerificationPeriodNotOver"
        );
      });
    });

    context("when successfully ending the auction", function () {
      beforeEach(async function () {
        await auctionContract.connect(owner).submitMerkleData(DUMMY_MERKLE_ROOT, DUMMY_IPFS_HASH);
        await time.increase(VERIFICATION_WINDOW + TIME_BUFFER);
      });

      it("should emit an event and update state", async function () {
        await expect(auctionContract.connect(alice).endAuction())
          .to.emit(auctionContract, "AuctionFinalized")
          .withArgs(alice.address);

        const auctionState = await auctionContract.auction();
        expect(auctionState.isFinalized).to.equal(true);
      });
    });
  });

  describe("#slash", function () {
    let startTime = 0,
      endTime = 0;

    beforeEach(async function () {
      ({ startTime, endTime } = await approveAndStartAuction());
    });

    context("when called by non-verifier", function () {
      it("should revert", async function () {
        await expect(
          auctionContract.connect(alice).slash(INVALID_MERKLE_ROOT, INVALID_IPFS_HASH)
        ).to.be.revertedWithCustomError(auctionContract, "OnlyVerifierCanResolveDispute");
      });
    });

    context("when submitting invalid data", function () {
      it("should revert if the merkle root is invalid", async function () {
        await expect(
          auctionContract.connect(verifier).slash(INVALID_MERKLE_ROOT, DUMMY_IPFS_HASH)
        ).to.be.revertedWithCustomError(auctionContract, "InvalidMerkleRoot");
      });

      it("should revert if the ipfs hash is invalid", async function () {
        await expect(
          auctionContract.connect(verifier).slash(DUMMY_MERKLE_ROOT, INVALID_IPFS_HASH)
        ).to.be.revertedWithCustomError(auctionContract, "InvalidIPFSHash");
      });

      it("should revert if the merkle root is not set yet", async function () {
        await expect(
          auctionContract.connect(verifier).slash(DUMMY_MERKLE_ROOT, DUMMY_IPFS_HASH)
        ).to.be.revertedWithCustomError(auctionContract, "AuctionMustHaveAnInitialMerkleRoot");
      });
    });

    context("when an incorrect merkle root is submitted", function () {
      const oldMerkleRoot = zeroPadBytes("0x01", 32);
      const oldIpfsHash = "Old TestHash";

      const newMerkleRoot = zeroPadBytes("0x02", 32);
      const newIpfsHash = "New TestHash";

      beforeEach(async function () {
        await advanceToAuctionEnd(endTime);

        await auctionContract.connect(owner).submitMerkleData(oldMerkleRoot, oldIpfsHash);
      });

      it("should revert if the merkle is set but verification time hash expired", async function () {
        // time is over
        await time.increase(VERIFICATION_WINDOW + TIME_BUFFER);

        await expect(
          auctionContract.connect(verifier).slash(newMerkleRoot, newIpfsHash)
        ).to.be.revertedWithCustomError(auctionContract, "VerificationWindowExpired");
      });

      it("should slash the owner and emit events", async function () {
        const balBefore = await ethers.provider.getBalance(verifier.address);
        const gasFee = await getGasFee(
          auctionContract.connect(verifier).slash(newMerkleRoot, newIpfsHash)
        );
        const balAfter = await ethers.provider.getBalance(verifier.address);
        expect(balAfter).to.approximately(balBefore + SECURITY_DEPOSIT, gasFee);
      });
    });
  });

  describe("#claim", function () {
    const totalPrice = getBidPrice(TOKEN_QUANTITY, PRICE_PER_TOKEN); // 10 tokens

    let startTime = 0;
    let endTime = 0;
    let root = "";
    let proofs: Record<string, string[]> = {}; // bidder => proof
    let bids: { bidder: SignerWithAddress; quantity: bigint; bidId: bigint }[] = [];

    beforeEach(async function () {
      ({ startTime, endTime } = await approveAndStartAuction());
      bids = [
        { bidder: alice, quantity: TOKEN_QUANTITY, bidId: 1n },
        { bidder: bob, quantity: TOKEN_QUANTITY, bidId: 2n },
        { bidder: accounts[0], quantity: TOKEN_QUANTITY, bidId: 3n },
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
        quantity: bid.bidder.address == accounts[0].address ? 0n : bid.quantity,
      }));

      ({ root, proofs } = generateMerkleTree(data));
      await auctionContract.connect(owner).submitMerkleData(root, DUMMY_IPFS_HASH);
    });

    it("should revert if the auction is not finalized", async function () {
      const bidId = bids[0].bidId;

      await expect(
        auctionContract.connect(alice).claim(bidId, TOKEN_QUANTITY, INVALID_PROOF)
      ).to.be.revertedWithCustomError(auctionContract, "AuctionNotFinalized");
    });

    context("when auction is finished", function () {
      beforeEach(async function () {
        await time.increase(VERIFICATION_WINDOW + TIME_BUFFER);
        await auctionContract.connect(bob).endAuction();

        // Mint some tokens to the auction contract
        await tokenContract.mint(auctionAddress, TOKEN_AMOUNT);
      });

      context("when claim conditions are invalid", function () {
        it("should revert if the bid does not exist", async function () {
          const nonExistentBidId = 999;

          await expect(
            auctionContract.connect(alice).claim(nonExistentBidId, TOKEN_QUANTITY, INVALID_PROOF)
          ).to.be.revertedWithCustomError(auctionContract, "BidDoesNotExist");
        });

        it("should revert if tokens are already claimed", async function () {
          const bidId = bids[0].bidId;

          // Claim tokens for the first time
          await auctionContract.connect(alice).claim(bidId, TOKEN_QUANTITY, proofs[alice.address]);

          // Try to claim tokens again
          await expect(
            auctionContract.connect(alice).claim(bidId, TOKEN_QUANTITY, proofs[alice.address])
          ).to.be.revertedWithCustomError(auctionContract, "BidDoesNotExist");
        });

        it("should revert when winner tries to claim eth", async function () {
          const bidId = bids[0].bidId;

          // Alice is the winner and she should give correct quantity but she gave 0 to claim the eth
          const _quantity = 0n;

          // This would fail with `InvalidProof()` as the given quantity is not correct and won't be verified
          await expect(
            auctionContract.connect(alice).claim(bidId, _quantity, proofs[alice.address])
          ).to.be.revertedWithCustomError(auctionContract, "InvalidProof");
        });

        it("should revert when non-winner tries to claim tokens", async function () {
          const caller = accounts[0];
          const bidId = bids[2].bidId;

          // caller is not the winner and he should give correct quantity (0) but he gave 100 to claim the tokens
          const _quantity = parseEther("100");

          // This would fail with `InvalidProof()` as the given quantity is not correct and won't be verified
          await expect(
            auctionContract.connect(caller).claim(bidId, _quantity, proofs[caller.address])
          ).to.be.revertedWithCustomError(auctionContract, "InvalidProof");
        });
      });

      context("when claims are valid", function () {
        it("should allow winner to claim tokens successfully", async function () {
          const bidId = bids[0].bidId;

          const quantity = (await auctionContract.bids(bidId)).quantity;

          const aliceBalanceBefore = await tokenContract.balanceOf(alice.address);

          await expect(auctionContract.connect(alice).claim(bidId, quantity, proofs[alice.address]))
            .to.emit(auctionContract, "TokensClaimed")
            .withArgs(alice.address, quantity);

          const bid = await auctionContract.bids(bidId);
          expect(bid.quantity).to.equal(0);

          const aliceBalanceAfter = await tokenContract.balanceOf(alice.address);
          expect(aliceBalanceAfter).to.equal(aliceBalanceBefore + quantity);
        });

        it("should allow non-winner to claim eth successfully", async function () {
          const bidder = bids[2].bidder;
          const bidId = bids[2].bidId;
          const quantity = 0; // non-winner

          const beforeBal = await ethers.provider.getBalance(bidder.address);

          const gasFeeDelta = await getGasFee(
            auctionContract.connect(bidder).claim(bidId, quantity, proofs[bidder.address])
          );
          const bid = await auctionContract.bids(bidId);
          expect(bid.bidder).to.equal(ZeroAddress);
          expect(bid.quantity).to.equal(0);

          const afterBal = await ethers.provider.getBalance(bidder.address);

          // 0.000049256451344628 eth fee delta
          expect(afterBal).to.approximately(beforeBal + totalPrice, gasFeeDelta);
        });
      });
    });
  });

  */
});
