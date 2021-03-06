// NOT USED. Previously used for original proxy implementation, needed for hardhat-deploy plugin

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract UUPSProxy is ERC1967Proxy {
  constructor(
    address _logic,
    address _admin,
    bytes memory _data
  ) payable ERC1967Proxy(_logic, _data) {
    _changeAdmin(_admin);
  }
}