// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract BlackMemoPool is Initializable, ERC20Upgradeable, PausableUpgradeable, OwnableUpgradeable, UUPSUpgradeable {
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() initializer {}

  function initialize() initializer public {
    __ERC20_init("BlackMemoPool", "BMPL");
    __Pausable_init();
    __Ownable_init();
    __UUPSUpgradeable_init();
  }

  function mint(address account, uint amount) public onlyOwner { _mint(account, amount); }
  function burn(address account, uint amount) public onlyOwner { _burn(account, amount); }

  function pause() public onlyOwner { _pause(); }
  function unpause() public onlyOwner { _unpause(); }

  function onUpgrade() public onlyOwner {}

  function _authorizeUpgrade(address newImplementation) internal onlyOwner override {}

  function _beforeTokenTransfer(address from, address to, uint amount) internal whenNotPaused override {
    super._beforeTokenTransfer(from, to, amount);
  }
}
