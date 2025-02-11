export enum OwnableErrors {
  OwnableUnauthorizedAccount = "OwnableUnauthorizedAccount",
}

export enum ERC20TokenErrors {
  ERC20InsufficientAllowance = "ERC20InsufficientAllowance",
}

export enum AuctionErrors {
  InvalidAddress = "InvalidAddress",
  ZeroTotalTokens = "ZeroTotalTokens",
  InvalidAuctionStatus = "InvalidAuctionStatus",
  AuctionExists = "AuctionExists",
  CanOnlySubmitOnce = "CanOnlySubmitOnce",
  InvalidSecurityDeposit = "InvalidSecurityDeposit",
  InvalidPricePerToken = "InvalidPricePerToken",
  InvalidAuctionTimeParams = "InvalidAuctionTimeParams",
  InvalidBidQuantity = "InvalidBidQuantity",
  InvalidBidPrice = "InvalidBidPrice",
  BidDoesNotExist = "BidDoesNotExist",
  OwnerCannotPlaceBids = "OwnerCannotPlaceBids",
  InvalidMerkleRoot = "InvalidMerkleRoot",
  InvalidMerkleProof = "InvalidMerkleProof",
  InvalidMultiHash = "InvalidMultiHash",
  VerificationPeriodNotOver = "VerificationPeriodNotOver",
  VerificationWindowExpired = "VerificationWindowExpired",
  OnlyVerifierCanResolveDispute = "OnlyVerifierCanResolveDispute",
  EthTransferFailed = "EthTransferFailed",
}
