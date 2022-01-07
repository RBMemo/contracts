#!/bin/bash

npx hardhat flatten contracts/UUPSProxy.sol > flat/UUPSProxy.sol
npx hardhat flatten contracts/rb-pool-controller.sol > flat/rb-pool-controller.sol
npx hardhat flatten contracts/pools.sol > flat/pools.sol
