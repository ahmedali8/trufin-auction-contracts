## Methods
| **Symbol** | **Meaning**                                                                              |
| :--------: | :--------------------------------------------------------------------------------------- |
|    **◯**   | Execution gas for this method does not include intrinsic gas overhead                    |
|    **△**   | Cost was non-zero but below the precision setting for the currency display (see options) |

|                       |     Min |     Max |     Avg | Calls | usd avg |
| :-------------------- | ------: | ------: | ------: | ----: | ------: |
| **Auction**           |         |         |         |       |         |
|        *endAuction*   |       - |       - | 183,122 |     3 |       - |
|        *placeBid*     | 127,362 | 834,178 | 446,961 |   223 |       - |
|        *startAuction* |  88,162 |  88,174 |  88,165 |    14 |       - |
| **MockToken**         |         |         |         |       |         |
|        *approve*      |  46,367 |  46,379 |  46,370 |    12 |       - |
|        *mint*         |       - |       - |  68,428 |    18 |       - |

## Deployments
|               | Min | Max  |       Avg | Block % | usd avg |
| :------------ | --: | ---: | --------: | ------: | ------: |
| **Auction**   |   - |    - | 1,055,483 |   3.5 % |       - |
| **MockToken** |   - |    - |   518,747 |   1.7 % |       - |

## Solidity and Network Config
| **Settings**        | **Value**  |
| ------------------- | ---------- |
| Solidity: version   | 0.8.26     |
| Solidity: optimized | true       |
| Solidity: runs      | 200        |
| Solidity: viaIR     | false      |
| Block Limit         | 30,000,000 |
| Gas Price           | -          |
| Token Price         | -          |
| Network             | ETHEREUM   |
| Toolchain           | hardhat    |

