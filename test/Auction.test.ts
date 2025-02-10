import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import {
  ContractTransactionResponse,
  ZeroAddress,
  parseEther,
  parseUnits,
  zeroPadBytes,
} from "ethers";
import { ethers } from "hardhat";

import { generateMerkleTree } from "../lib/merkle-tree/generate-merkle-tree";
import type { Auction, MockToken } from "../types";
import { ZERO_BYTES32 } from "../utils/constants";
import { loadFixtures } from "./shared/fixtures";

const SECURITY_DEPOSIT = parseUnits("5", 17); // 0.5 ETH
const VERIFICATION_WINDOW = time.duration.hours(2);
const TIME_BUFFER = 5; // Buffer for timing adjustments
const AUCTION_DURATION = time.duration.minutes(10); // Auction lasts 10 minutes (just for example)
const TOKEN_AMOUNT = parseEther("1000000"); // Large token amount for tests
const TOTAL_TOKENS = parseEther("10");
const TOKEN_QUANTITY = parseEther("100");
const PRICE_PER_TOKEN = parseUnits("1", 17); // 0.1 ETH per token
const INVALID_MERKLE_ROOT = ZERO_BYTES32;
const INVALID_IPFS_HASH = "";
const DUMMY_MERKLE_ROOT = zeroPadBytes("0x01", 32);
const DUMMY_IPFS_HASH = "Test IPFS Hash";
const INVALID_PROOF = ["0xa7a72291e3c368d9052a4baa918856f83eca42f8862b56ad9b17bf3cb8038885"];

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
    await auctionContract
      .connect(owner)
      .startAuction(tokenAddress, TOTAL_TOKENS, startTime, endTime, {
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
        await expect(
          auctionContract
            .connect(alice)
            .startAuction(ZeroAddress, parseEther("1"), 1739058738, 1739058738, {
              value: SECURITY_DEPOSIT,
            })
        ).to.be.revertedWithCustomError(auctionContract, "OwnableUnauthorizedAccount");
      });
    });

    context("when deposit is incorrect", function () {
      it("should revert if deposit not paid", async function () {
        await expect(
          auctionContract
            .connect(alice)
            .startAuction(ZeroAddress, parseEther("1"), 1739058738, 1739058738, {
              value: 0n,
            })
        ).to.be.revertedWithCustomError(auctionContract, "OwnableUnauthorizedAccount");
      });
    });

    context("when params are invalid", function () {
      it("should revert if the token address is the zero address", async function () {
        await expect(
          auctionContract.startAuction(ZeroAddress, parseEther("1"), 1739058738, 1739058738, {
            value: SECURITY_DEPOSIT,
          })
        ).to.be.revertedWithCustomError(auctionContract, "InvalidTokenAddress");
      });

      it("should revert if the total tokens is zero", async function () {
        await expect(
          auctionContract.startAuction(tokenAddress, 0, 1739058738, 1739058738, {
            value: SECURITY_DEPOSIT,
          })
        ).to.be.revertedWithCustomError(auctionContract, "InvalidTotalTokens");
      });

      it("should revert if the start time is in the past", async function () {
        await expect(
          auctionContract.startAuction(tokenAddress, parseEther("1"), 0, 1739058738, {
            value: SECURITY_DEPOSIT,
          })
        ).to.be.revertedWithCustomError(auctionContract, "InvalidAuctionTime");
      });

      it("should revert if the end time is before the start time", async function () {
        await expect(
          auctionContract.startAuction(tokenAddress, parseEther("1"), 1739058738, 1739058737, {
            value: SECURITY_DEPOSIT,
          })
        ).to.be.revertedWithCustomError(auctionContract, "InvalidAuctionTime");
      });
    });

    context("when params are valid", function () {
      it("should revert if tokens not approved", async function () {
        const { startTime, endTime } = await getStartAndEndTime();

        await expect(
          auctionContract.startAuction(tokenAddress, TOTAL_TOKENS, startTime, endTime, {
            value: SECURITY_DEPOSIT,
          })
        ).to.be.revertedWithCustomError(tokenContract, "ERC20InsufficientAllowance");
      });

      context("when create a new auction", function () {
        let startTime = 0,
          endTime = 0;

        beforeEach(async function () {
          ({ startTime, endTime } = await getStartAndEndTime());

          // Approve the auction contract to spend the tokens
          await tokenContract.approve(auctionContract.getAddress(), TOTAL_TOKENS);

          await expect(
            auctionContract.startAuction(tokenAddress, TOTAL_TOKENS, startTime, endTime, {
              value: SECURITY_DEPOSIT,
            })
          )
            .to.emit(auctionContract, "AuctionStarted")
            .withArgs(tokenAddress, TOTAL_TOKENS, startTime, endTime);
        });

        it("should revert if auction is started again", async function () {
          await expect(
            auctionContract.startAuction(tokenAddress, TOTAL_TOKENS, startTime, endTime, {
              value: SECURITY_DEPOSIT,
            })
          ).to.be.revertedWithCustomError(auctionContract, "AuctionAlreadyExists");
        });

        it("should emit event and update state", async function () {
          const auctionState = await auctionContract.auction();

          // expect
          expect(auctionState.token).to.equal(tokenAddress);
          expect(auctionState.totalTokens).to.equal(TOTAL_TOKENS);
          expect(auctionState.startTime).to.equal(startTime);
          expect(auctionState.endTime).to.equal(endTime);
          expect(auctionState.merkleRoot).to.equal(ZERO_BYTES32);
          expect(auctionState.ipfsHash).to.equal("");
          expect(auctionState.isFinalized).to.equal(false);
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
          auctionContract.connect(alice).placeBid(1, 0, { value: 0 })
        ).to.be.revertedWithCustomError(auctionContract, "InvalidBidPrice");
        await expect(
          auctionContract.connect(alice).placeBid(1, 0, { value: parseEther("1") })
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

  describe("#submitMerkleRoot", function () {
    let startTime = 0,
      endTime = 0;

    beforeEach(async function () {
      ({ startTime, endTime } = await approveAndStartAuction());
    });

    context("when called by non-owner", function () {
      it("should revert", async function () {
        await expect(
          auctionContract.connect(alice).submitMerkleRoot(INVALID_MERKLE_ROOT, DUMMY_IPFS_HASH)
        ).to.be.revertedWithCustomError(auctionContract, "OwnableUnauthorizedAccount");
      });
    });

    context("when auction is not finalized", function () {
      it("should revert if its called before the auction has started", async function () {
        await expect(
          auctionContract.connect(owner).submitMerkleRoot(INVALID_MERKLE_ROOT, DUMMY_IPFS_HASH)
        ).to.be.revertedWithCustomError(auctionContract, "AuctionStillActive");
      });

      it("should revert if its called during the auction", async function () {
        // Move time forward to the start of the auction
        await advanceToAuctionStart(startTime);

        await expect(
          auctionContract.connect(owner).submitMerkleRoot(INVALID_MERKLE_ROOT, DUMMY_IPFS_HASH)
        ).to.be.revertedWithCustomError(auctionContract, "AuctionStillActive");
      });
    });

    context("when auction has ended", function () {
      beforeEach(async function () {
        await advanceToAuctionEnd(endTime);
      });

      context("when submitting invalid data", function () {
        it("should revert if merkle root is invalid", async function () {
          await expect(
            auctionContract.connect(owner).submitMerkleRoot(INVALID_MERKLE_ROOT, INVALID_IPFS_HASH)
          ).to.be.revertedWithCustomError(auctionContract, "InvalidMerkleRoot");
        });

        it("should revert if ipfs hash is invalid", async function () {
          await expect(
            auctionContract.connect(owner).submitMerkleRoot(DUMMY_MERKLE_ROOT, INVALID_IPFS_HASH)
          ).to.be.revertedWithCustomError(auctionContract, "InvalidIPFSHash");
        });
      });

      context("when submitting invalid data", function () {
        beforeEach(async function () {
          await expect(
            auctionContract.connect(owner).submitMerkleRoot(DUMMY_MERKLE_ROOT, DUMMY_IPFS_HASH)
          )
            .to.emit(auctionContract, "MerkleRootSubmitted")
            .withArgs(DUMMY_MERKLE_ROOT, DUMMY_IPFS_HASH);
        });

        it("should revert if merkle root is submitted twice", async function () {
          await expect(
            auctionContract.submitMerkleRoot(DUMMY_MERKLE_ROOT, DUMMY_IPFS_HASH)
          ).to.be.revertedWithCustomError(auctionContract, "InvalidMerkleRoot");
        });

        it("should submit the merkle root and ipfs hash successfully", async function () {
          const auctionState = await auctionContract.auction();
          expect(auctionState.merkleRoot).to.equal(DUMMY_MERKLE_ROOT);
          expect(auctionState.ipfsHash).to.equal(DUMMY_IPFS_HASH);
        });
      });
    });
  });

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
        await auctionContract.connect(owner).submitMerkleRoot(DUMMY_MERKLE_ROOT, DUMMY_IPFS_HASH);

        await expect(auctionContract.connect(alice).endAuction()).to.be.revertedWithCustomError(
          auctionContract,
          "VerificationPeriodNotOver"
        );
      });
    });

    context("when successfully ending the auction", function () {
      beforeEach(async function () {
        await auctionContract.connect(owner).submitMerkleRoot(DUMMY_MERKLE_ROOT, DUMMY_IPFS_HASH);
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

        await auctionContract.connect(owner).submitMerkleRoot(oldMerkleRoot, oldIpfsHash);
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
    const timeBuffer = 5;
    let quantity = 0n;
    let totalPrice = 0n;
    let startTime = 0;
    let endTime = 0;
    let root = "";
    let proofs: Record<string, string[]> = {}; // bidder => proof

    const invalidProof = ["0xa7a72291e3c368d9052a4baa918856f83eca42f8862b56ad9b17bf3cb8038885"];

    beforeEach(async function () {
      const tokenAddress = await tokenContract.getAddress();
      const totalTokens = parseEther("10");
      startTime = (await time.latest()) + timeBuffer;
      endTime = startTime + time.duration.minutes(10);
      await tokenContract.approve(auctionContract.getAddress(), totalTokens);
      await auctionContract.startAuction(tokenAddress, totalTokens, startTime, endTime, {
        value: SECURITY_DEPOSIT,
      });

      // Move time forward to the start of the auction
      await time.increaseTo(startTime + time.duration.seconds(timeBuffer));

      // Place a bid
      quantity = parseEther("100"); // 100 tokens
      const pricePerToken = parseUnits("1", 17); // 0.1 ETH per token
      totalPrice = (pricePerToken * quantity) / parseUnits("1", 18); // 10 tokens
      await auctionContract.connect(alice).placeBid(quantity, pricePerToken, { value: totalPrice });
      await auctionContract.connect(bob).placeBid(quantity, pricePerToken, { value: totalPrice });
      await auctionContract
        .connect(accounts[0])
        .placeBid(quantity, pricePerToken, { value: totalPrice });

      // Move time forward to the end of the auction
      await time.increaseTo(endTime + time.duration.seconds(timeBuffer));

      // create a merkle root
      const data = [
        { bidder: alice.address, quantity },
        { bidder: bob.address, quantity },
        { bidder: accounts[0].address, quantity: 0n },
      ];
      const tree = generateMerkleTree(data);
      root = tree.root;
      proofs = tree.proofs;
      const ipfsHash = "QmTestHash";
      await auctionContract.connect(owner).submitMerkleRoot(root, ipfsHash);
    });

    it("should revert if the auction is not finalized", async function () {
      const bidId = 1;

      await expect(
        auctionContract.connect(alice).claim(bidId, quantity, invalidProof)
      ).to.be.revertedWithCustomError(auctionContract, "AuctionNotFinalized");
    });

    it("should revert if the bid does not exist", async function () {
      await time.increase(VERIFICATION_WINDOW + timeBuffer);
      await auctionContract.connect(bob).endAuction();

      const bidId = 999; // Non-existent bid ID

      await expect(
        auctionContract.connect(alice).claim(bidId, quantity, invalidProof)
      ).to.be.revertedWithCustomError(auctionContract, "BidDoesNotExist");
    });

    it("should revert if tokens are already claimed", async function () {
      await time.increase(VERIFICATION_WINDOW + timeBuffer);
      await auctionContract.connect(bob).endAuction();

      const bidId = 1;

      // Mint some tokens to the auction contract
      const auctionContractAddress = await auctionContract.getAddress();
      const tokenAmount = parseEther("100");
      await tokenContract.mint(auctionContractAddress, tokenAmount);

      // Claim tokens for the first time
      await auctionContract.connect(alice).claim(bidId, quantity, proofs[alice.address]);

      // Try to claim tokens again
      await expect(
        auctionContract.connect(alice).claim(bidId, quantity, proofs[alice.address])
      ).to.be.revertedWithCustomError(auctionContract, "BidDoesNotExist");
    });

    it("should revert when winner tries to claim eth", async function () {
      await time.increase(VERIFICATION_WINDOW + timeBuffer);
      await auctionContract.connect(bob).endAuction();
      const bidId = 1;

      // Alice is the winner and she should give correct quantity but she gave 0 to claim the eth
      const _quantity = 0n;

      // This would fail with `InvalidProof()` as the given quantity is not correct and won't be verified
      await expect(
        auctionContract.connect(alice).claim(bidId, _quantity, proofs[alice.address])
      ).to.be.revertedWithCustomError(auctionContract, "InvalidProof");
    });

    it("should revert when non-winner tries to claim tokens", async function () {
      await time.increase(VERIFICATION_WINDOW + timeBuffer);
      await auctionContract.connect(bob).endAuction();

      const caller = accounts[0];
      const bidId = 3;

      // caller is not the winner and he should give correct quantity (0) but he gave 100 to claim the tokens
      const _quantity = parseEther("100");

      // This would fail with `InvalidProof()` as the given quantity is not correct and won't be verified
      await expect(
        auctionContract.connect(caller).claim(bidId, _quantity, proofs[caller.address])
      ).to.be.revertedWithCustomError(auctionContract, "InvalidProof");
    });

    it("should allow winner to claim tokens successfully", async function () {
      await time.increase(VERIFICATION_WINDOW + timeBuffer);
      await auctionContract.connect(bob).endAuction();
      const bidId = 1;

      const _quantity = (await auctionContract.bids(bidId)).quantity;

      // Mint some tokens to the auction contract
      const auctionContractAddress = await auctionContract.getAddress();
      const tokenAmount = parseEther("100");
      await tokenContract.mint(auctionContractAddress, tokenAmount);

      const aliceBalanceBefore = await tokenContract.balanceOf(alice.address);

      await expect(auctionContract.connect(alice).claim(bidId, _quantity, proofs[alice.address]))
        .to.emit(auctionContract, "TokensClaimed")
        .withArgs(alice.address, _quantity);

      const bid = await auctionContract.bids(bidId);
      expect(bid.quantity).to.equal(0);

      const aliceBalanceAfter = await tokenContract.balanceOf(alice.address);
      expect(aliceBalanceAfter).to.equal(aliceBalanceBefore + _quantity);
    });

    it("should allow non-winner to claim eth successfully", async function () {
      await time.increase(VERIFICATION_WINDOW + timeBuffer);
      await auctionContract.connect(bob).endAuction();
      const bidId = 3;
      const _quantity = 0; // non-winner

      // Mint some tokens to the auction contract
      const auctionContractAddress = await auctionContract.getAddress();
      const tokenAmount = parseEther("100");
      await tokenContract.mint(auctionContractAddress, tokenAmount);

      const caller = accounts[0];
      const beforeBal = await ethers.provider.getBalance(caller.address);

      const gasFeeDelta = await getGasFee(
        auctionContract.connect(caller).claim(bidId, _quantity, proofs[caller.address])
      );
      const bid = await auctionContract.bids(bidId);
      expect(bid.bidder).to.equal(ZeroAddress);
      expect(bid.quantity).to.equal(0);

      const afterBal = await ethers.provider.getBalance(caller.address);

      // 0.000049256451344628 eth fee delta
      expect(afterBal).to.approximately(beforeBal + totalPrice, gasFeeDelta);
    });
  });
});

const getGasFee = async (tx: Promise<ContractTransactionResponse>) => {
  const txResponse = await tx;
  const receipt = await txResponse.wait();
  if (!receipt) return Error("No receipt found for transaction");
  const gasUsed = receipt.gasUsed;
  const gasPrice = receipt.gasPrice;

  return gasUsed * gasPrice;
};

async function getStartTime() {
  return (await time.latest()) + TIME_BUFFER;
}

function getEndTime(startTime: number) {
  return startTime + AUCTION_DURATION;
}

async function getStartAndEndTime() {
  const startTime = await getStartTime();
  const endTime = getEndTime(startTime);

  return { startTime, endTime };
}

// gets the price
function getBidPrice(quantity: bigint, pricePerToken: bigint) {
  return (pricePerToken * quantity) / parseUnits("1", 18);
}

// Move time forward to the start of the auction
async function advanceToAuctionStart(startTime: number) {
  await time.increaseTo(startTime + time.duration.seconds(TIME_BUFFER));
}

// Move time forward to the start of the auction
// Move time forward to the end of the auction
async function advanceToAuctionEnd(endTime: number) {
  await time.increaseTo(endTime + time.duration.seconds(TIME_BUFFER));
}
