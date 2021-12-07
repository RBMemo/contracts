// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract BlackMemoPool is Initializable, ERC20Upgradeable, AccessControlUpgradeable, UUPSUpgradeable {
  bytes32 public constant ADMIN = keccak256("ADMIN");
  bytes32 public constant CONTROLLER = keccak256("CONTROLLER");
  
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() initializer {}

  function initialize() initializer public {
    __ERC20_init("BlackMemoPool", "BMPL");
    __AccessControl_init();
    __UUPSUpgradeable_init();

    _grantRole(ADMIN, _msgSender());
    _grantRole(CONTROLLER, _msgSender());
    _setRoleAdmin(CONTROLLER, ADMIN);
  }

  function mint(address account, uint amount) public onlyRole(CONTROLLER) { _mint(account, amount); }
  function burn(address account, uint amount) public onlyRole(CONTROLLER) { _burn(account, amount); }

  function setController(address controller) public onlyRole(ADMIN) { _grantRole(CONTROLLER, controller); }

  function onUpgrade() public onlyRole(ADMIN) {}
  function _authorizeUpgrade(address newImplementation) internal onlyRole(ADMIN) override {}
  function decimals() public view virtual override(ERC20Upgradeable) returns (uint8) { return 9; }
}