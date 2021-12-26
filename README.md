# Eth Pool
Rewards Projects for Eth Deposits

## Summary

ETHPool provides a service where people can deposit ETH and they will receive weekly rewards. Users must be able to take out their deposits along with their portion of rewards at any time. New rewards are deposited manually into the pool by the ETHPool team each week using a contract function.

## Requirements

- Only the team can deposit rewards.
- Deposited rewards go to the pool of users, not to individual users.
- Users should be able to withdraw their deposits along with their share of rewards considering the time when they deposited.

Example:

> Let say we have user **A** and **B** and team **T**.
>
> **A** deposits 100, and **B** deposits 300 for a total of 400 in the pool. Now **A** has 25% of the pool and **B** has 75%. When **T** deposits 200 rewards, **A** should be able to withdraw 150 and **B** 450.
>
> What if the following happens? **A** deposits then **T** deposits then **B** deposits then **A** withdraws and finally **B** withdraws.
> **A** should get their deposit + all the rewards.
> **B** should only get their deposit because rewards were sent to the pool before they participated.

# Implementation
## Deposits
Function: deposits(): O(1)
Deposits are received and affects the following state variables:
- mapping: deposits - stores an address' total deposits currently held in the contract
- mapping: depositsPerWeek - currentWeek -> address -> amount deposited this week
- mapping: uniqueWeeklyDeposits - address mapping to an OZ Enumerable Set which tracks a depositor unique weekly deposits. If a user updates their deposits in the same week, the update of the set is idempotent and is still O(1).
- mapping: totalDepositsPerWeek - current weeks maps to unique deposits for the week
- event: DepositReceived

## Rewards
Function: rewards(): O(1)
Allowlisted members can add rewards to a given week.
State updates:
- mapping: totalRewardsPerWeek - total Rewards for a given week
- uint: currentWeek - if an allowlisted address passes a true value to move week, the current week is incremented.

## Withdraw:
Function: withdraw(): O(n) with n representing the maxNoOfUniqueWeeks.
- mapping: deposits - update this value when an address withdraw their deposits.
- mapping: uniqueWeeklyDeposits - removes every unique week when rewards are calculated.
- mapping: depositsPerWeek - sets 0 for every week an address deposits funds.


## View on Etherscan
https://rinkeby.etherscan.io/address/0x467ef7aF232d2Ec73BdeA6EAC45751D4c3C7530a

## Setup

Try running some of the following tasks:

```shell
npx hardhat accounts
npx hardhat compile
npx hardhat clean
npx hardhat test
npx hardhat node
npx hardhat help
REPORT_GAS=true npx hardhat test
npx hardhat coverage
npx hardhat run scripts/deploy.ts
TS_NODE_FILES=true npx ts-node scripts/deploy.ts
```
