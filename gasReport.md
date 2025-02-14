## Methods
| **Symbol** | **Meaning**                                                                              |
| :--------: | :--------------------------------------------------------------------------------------- |
|    **◯**   | Execution gas for this method does not include intrinsic gas overhead                    |
|    **△**   | Cost was non-zero but below the precision setting for the currency display (see options) |

|                           |     Min |     Max |     Avg | Calls | usd avg |
| :------------------------ | ------: | ------: | ------: | ----: | ------: |
| **Auction**               |         |         |         |       |         |
|        *claim*            |  45,108 |  56,455 |  53,514 |     8 |    0.11 |
|        *endAuction*       |       - |       - |  41,543 |     9 |    0.09 |
|        *placeBid*         |  79,055 |  79,067 |  79,056 |   226 |    0.17 |
|        *slash*            |       - |       - |  51,017 |     2 |    0.11 |
|        *startAuction*     |       - |       - | 106,356 |    34 |    0.22 |
|        *submitMerkleData* |  82,694 |  83,054 |  82,854 |    18 |    0.18 |
| **DLLAuction**            |         |         |         |       |         |
|        *finalizeAuction*  |       - |       - | 108,343 |     2 |    0.23 |
|        *placeBid*         | 178,257 | 184,108 | 182,431 |     7 |    0.39 |
|        *startAuction*     |  61,330 | 112,517 | 106,119 |     8 |    0.22 |
| **MockToken**             |         |         |         |       |         |
|        *approve*          |  46,367 |  46,379 |  46,370 |    46 |    0.10 |
|        *mint*             |  34,228 |  68,428 |  57,025 |   144 |    0.12 |
| **PQAuction**             |         |         |         |       |         |
|        *finalizeAuction*  |       - |       - | 156,790 |     2 |    0.33 |
|        *placeBid*         | 139,151 | 148,337 | 142,217 |     6 |    0.30 |
|        *startAuction*     |  61,295 | 112,485 | 105,172 |     7 |    0.22 |

## Deployments
|                | Min | Max  |       Avg | Block % | usd avg |
| :------------- | --: | ---: | --------: | ------: | ------: |
| **Auction**    |   - |    - | 1,664,938 |   5.5 % |    3.52 |
| **DLLAuction** |   - |    - |   866,441 |   2.9 % |    1.83 |
| **MockToken**  |   - |    - |   518,747 |   1.7 % |    1.10 |
| **PQAuction**  |   - |    - | 1,334,284 |   4.4 % |    2.82 |

## Solidity and Network Config
| **Settings**        | **Value**       |
| ------------------- | --------------- |
| Solidity: version   | 0.8.26          |
| Solidity: optimized | true            |
| Solidity: runs      | 200             |
| Solidity: viaIR     | false           |
| Block Limit         | 30,000,000      |
| L1 Gas Price        | 0.76937 gwei    |
| Token Price         | 2746.79 usd/eth |
| Network             | ETHEREUM        |
| Toolchain           | hardhat         |

