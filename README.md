# Splitbase Smart Contracts


## Description

Smart contracts for a decentralized app formally named Splitbase (development name was RBMemo). The app's goal is to allow users to gamble their interest on a rebasing token (Splitbase docs can be found [here](https://docs.splitbase.fi/)). So far, the contracts in this repo are used on Avalanche with [MEMOries](https://docs.wonderland.money/basics/staking).


## Current Status

The project is currently not live as the owners have decided to discontinue it, however it was open to user interaction for a few weeks.


## Contracts


### TokenPool

This is a standard [ERC20Permit](https://docs.openzeppelin.com/contracts/4.x/api/token/erc20#ERC20Permit) contract, but with added functionality allowing for rebasing. Rebasing, creating user balance, and removing user balance is all managed through the PoolController contract.

A rebase for an amount is distributing that amount proportionally throughout all token holders. This is achieved by creating a single scalar value that increases all token amounts based on the rebase amount.


### PoolController

This contract contains functionality for withdrawing from pools, depositing into pools, selecting which pool wins in a rebase, and the rebase win amount. Random pool selection is achieved by gathering entropy from the seedKey (private to contract owner), the current blockhash, the last actor on the pools, and both pool’s totalSupply.


## Contract Interaction


### Deposit / Withdraw

These interactions were initiated by the end users from the [Splitbase web app](https://github.com/RBMemo/web-app).


### Rebasing

There is a [containerized service](https://github.com/RBMemo/rebase-beacon) that listens for a MEMOries rebase event, when it sees one it will post a message to an SQS queue, which is then consumed by a [Lambda](https://github.com/RBMemo/lambdas/blob/main/src/handlers/rebase-caller.js). This lambda will generate a new seedKey, then initiate the rebase with the old and new seedKeys.


## Project Interaction

Scripts have conveniently been made in the “scripts” section of the package.json, the main tool used for this project was hardhat and hardhat-deploy.

Tests are run using ethers and chai.


## Credits

All work in this repository, and all linked RBMemo repositories, was performed by Andrew English.
