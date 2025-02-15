## Methods
| **Symbol** | **Meaning**                                                                              |
| :--------: | :--------------------------------------------------------------------------------------- |
|    **◯**   | Execution gas for this method does not include intrinsic gas overhead                    |
|    **△**   | Cost was non-zero but below the precision setting for the currency display (see options) |

|                       |     Min |     Max |     Avg | Calls | usd avg |
| :-------------------- | ------: | ------: | ------: | ----: | ------: |
| **Auction**           |         |         |         |       |         |
|        *endAuction*   |       - |       - | 183,420 |     3 |    0.40 |
|        *placeBid*     | 128,006 | 864,094 | 460,700 |   223 |    1.00 |
|        *startAuction* |  88,154 |  88,166 |  88,157 |    14 |    0.19 |
| **MockToken**         |         |         |         |       |         |
|        *approve*      |  46,367 |  46,379 |  46,370 |    12 |    0.10 |
|        *mint*         |       - |       - |  68,428 |    18 |    0.15 |

## Deployments
|               | Min | Max  |       Avg | Block % | usd avg |
| :------------ | --: | ---: | --------: | ------: | ------: |
| **Auction**   |   - |    - | 1,102,358 |   3.7 % |    2.39 |
| **MockToken** |   - |    - |   518,747 |   1.7 % |    1.12 |

## Solidity and Network Config
| **Settings**        | **Value**       |
| ------------------- | --------------- |
| Solidity: version   | 0.8.26          |
| Solidity: optimized | true            |
| Solidity: runs      | 200             |
| Solidity: viaIR     | false           |
| Block Limit         | 30,000,000      |
| L1 Gas Price        | 0.79998 gwei    |
| Token Price         | 2710.25 usd/eth |
| Network             | ETHEREUM        |
| Toolchain           | hardhat         |

