## Methods
| **Symbol** | **Meaning**                                                                              |
| :--------: | :--------------------------------------------------------------------------------------- |
|    **◯**   | Execution gas for this method does not include intrinsic gas overhead                    |
|    **△**   | Cost was non-zero but below the precision setting for the currency display (see options) |

|                           |    Min |    Max |     Avg | Calls | usd avg |
| :------------------------ | -----: | -----: | ------: | ----: | ------: |
| **Auction**               |        |        |         |       |         |
|        *claim*            | 39,324 | 49,840 |  45,634 |     5 |    0.10 |
|        *endAuction*       |      - |      - |  41,543 |     8 |    0.09 |
|        *placeBid*         | 79,055 | 79,067 |  79,056 |   223 |    0.17 |
|        *slash*            |      - |      - |  50,927 |     2 |    0.11 |
|        *startAuction*     |      - |      - | 106,334 |    33 |    0.23 |
|        *submitMerkleData* | 82,626 | 82,986 |  82,774 |    17 |    0.18 |
| **MockToken**             |        |        |         |       |         |
|        *approve*          |      - |      - |  46,367 |    31 |    0.10 |
|        *mint*             | 34,228 | 68,428 |  55,938 |   126 |    0.12 |

## Deployments
|               | Min | Max  |       Avg | Block % | usd avg |
| :------------ | --: | ---: | --------: | ------: | ------: |
| **Auction**   |   - |    - | 1,587,417 |   5.3 % |    3.41 |
| **MockToken** |   - |    - |   518,747 |   1.7 % |    1.11 |

## Solidity and Network Config
| **Settings**        | **Value**       |
| ------------------- | --------------- |
| Solidity: version   | 0.8.26          |
| Solidity: optimized | true            |
| Solidity: runs      | 200             |
| Solidity: viaIR     | false           |
| Block Limit         | 30,000,000      |
| L1 Gas Price        | 0.82411 gwei    |
| Token Price         | 2605.56 usd/eth |
| Network             | ETHEREUM        |
| Toolchain           | hardhat         |

