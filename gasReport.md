## Methods
| **Symbol** | **Meaning**                                                                              |
| :--------: | :--------------------------------------------------------------------------------------- |
|    **◯**   | Execution gas for this method does not include intrinsic gas overhead                    |
|    **△**   | Cost was non-zero but below the precision setting for the currency display (see options) |

|                       |     Min |     Max |     Avg | Calls | usd avg |
| :-------------------- | ------: | ------: | ------: | ----: | ------: |
| **Auction**           |         |         |         |       |         |
|        *endAuction*   |       - |       - | 183,684 |     3 |    0.43 |
|        *placeBid*     | 127,984 | 864,072 | 460,678 |   223 |    1.08 |
|        *startAuction* |  88,154 |  88,166 |  88,157 |    14 |    0.21 |
| **MockToken**         |         |         |         |       |         |
|        *approve*      |  46,367 |  46,379 |  46,370 |    12 |    0.11 |
|        *mint*         |       - |       - |  68,428 |    18 |    0.16 |

## Deployments
|               | Min | Max  |       Avg | Block % | usd avg |
| :------------ | --: | ---: | --------: | ------: | ------: |
| **Auction**   |   - |    - | 1,103,567 |   3.7 % |    2.58 |
| **MockToken** |   - |    - |   518,747 |   1.7 % |    1.21 |

## Solidity and Network Config
| **Settings**        | **Value**       |
| ------------------- | --------------- |
| Solidity: version   | 0.8.26          |
| Solidity: optimized | true            |
| Solidity: runs      | 200             |
| Solidity: viaIR     | false           |
| Block Limit         | 30,000,000      |
| L1 Gas Price        | 0.86853 gwei    |
| Token Price         | 2687.40 usd/eth |
| Network             | ETHEREUM        |
| Toolchain           | hardhat         |

