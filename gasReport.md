## Methods
| **Symbol** | **Meaning**                                                                              |
| :--------: | :--------------------------------------------------------------------------------------- |
|    **◯**   | Execution gas for this method does not include intrinsic gas overhead                    |
|    **△**   | Cost was non-zero but below the precision setting for the currency display (see options) |

|                       |     Min |     Max |     Avg | Calls | usd avg |
| :-------------------- | ------: | ------: | ------: | ----: | ------: |
| **Auction**           |         |         |         |       |         |
|        *endAuction*   |       - |       - | 187,703 |     3 |    0.43 |
|        *placeBid*     | 131,924 | 868,307 | 464,749 |   223 |    1.06 |
|        *startAuction* |  88,171 |  88,183 |  88,174 |    14 |    0.20 |
| **MockToken**         |         |         |         |       |         |
|        *approve*      |  46,367 |  46,379 |  46,370 |    12 |    0.11 |
|        *mint*         |       - |       - |  68,428 |    18 |    0.16 |

## Deployments
|                | Min | Max  |       Avg | Block % | usd avg |
| :------------- | --: | ---: | --------: | ------: | ------: |
| **Auction**    |   - |    - | 1,254,311 |   4.2 % |    2.86 |
| **BidLibrary** |   - |    - |   137,520 |   0.5 % |    0.31 |
| **MockToken**  |   - |    - |   518,747 |   1.7 % |    1.18 |

## Solidity and Network Config
| **Settings**        | **Value**       |
| ------------------- | --------------- |
| Solidity: version   | 0.8.26          |
| Solidity: optimized | true            |
| Solidity: runs      | 200             |
| Solidity: viaIR     | false           |
| Block Limit         | 30,000,000      |
| L1 Gas Price        | 0.84981 gwei    |
| Token Price         | 2687.21 usd/eth |
| Network             | ETHEREUM        |
| Toolchain           | hardhat         |

