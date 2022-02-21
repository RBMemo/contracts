// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

abstract contract TokenPool is ERC20Permit, AccessControl {
  event LogRebase(uint indexed timestamp, uint amount);
  
  bytes32 public constant ADMIN = keccak256("ADMIN");
  bytes32 public constant CONTROLLER = keccak256("CONTROLLER");
  uint8 private constant _decimals = 9;
  uint private constant _precision = 10 ** 18; // number of decimals to use in mathematical calculations before rounding

  uint private _scalar; // amount to scale user tokens by for rebases
  uint private _baseTotalSupply; // total supply before scaling
  mapping(address => uint) private _baseBalances; // user balances before scaling
  
  constructor(string memory name, string memory symbol) ERC20(name, symbol) ERC20Permit(name) {
    _grantRole(ADMIN, _msgSender());
    _grantRole(CONTROLLER, _msgSender());
    _setRoleAdmin(CONTROLLER, ADMIN);

    _scalar = _precision;
  }

  /*** USER CALLED FUNCTIONS ***/

  function balanceOf(address account) public view override returns(uint) {
    return _scaled(_baseBalances[account]);
  }

  function totalSupply() public view override returns (uint) {
    return _scaled(_baseTotalSupply);
  }

  /*** CONTOLLER CALLED FUNCTIONS ***/

  function mint(address account, uint amount) public onlyRole(CONTROLLER) { _mint(account, amount); }
  function burn(address account, uint amount) public onlyRole(CONTROLLER) { _burn(account, amount); }
  function rebase(uint amount) public onlyRole(CONTROLLER) {
    require(amount >= 0, "Invalid rebase amount");

    uint totalSupply_ = totalSupply();
    if(amount == 0) { return; }
    if(totalSupply_ > 0) {
      _scalar = (_scalar * ((amount * _precision / totalSupply_) + _precision)) / _precision;
    }

    emit LogRebase(block.timestamp, amount);
  }

  /*** OWNER CALLED FUNCTIONS ***/

  function setController(address controller) public onlyRole(ADMIN) { _grantRole(CONTROLLER, controller); }

  /*** OVERRIDE FUNCTIONS ***/

  function _transfer(
    address sender,
    address recipient,
    uint amount
  ) internal override {
    require(sender != address(0), "ERC20: transfer from the zero address");
    require(recipient != address(0), "ERC20: transfer to the zero address");

    _beforeTokenTransfer(sender, recipient, amount);

    uint256 senderBalance = balanceOf(sender);
    require(senderBalance >= amount, "ERC20: transfer amount exceeds balance");
    unchecked {
      _baseBalances[sender] = _descaled(senderBalance - amount);
    }
    _baseBalances[recipient] += _descaled(amount);

    emit Transfer(sender, recipient, amount);

    _afterTokenTransfer(sender, recipient, amount);
  }

  function _mint(address account, uint amount) internal override {
    require(account != address(0), "ERC20: mint to the zero address");

    _beforeTokenTransfer(address(0), account, amount);

    _baseTotalSupply += _descaled(amount);
    _baseBalances[account] += _descaled(amount);
    emit Transfer(address(0), account, amount);

    _afterTokenTransfer(address(0), account, amount);
  }

  function _burn(address account, uint amount) internal override {
    require(account != address(0), "ERC20: burn from the zero address");

    _beforeTokenTransfer(account, address(0), amount);

    uint256 accountBalance = balanceOf(account);
    require(accountBalance >= amount, "ERC20: burn amount exceeds balance");
    unchecked {
      _baseBalances[account] = _descaled(accountBalance - amount);
    }
    _baseTotalSupply -= _descaled(amount);

    emit Transfer(account, address(0), amount);

    _afterTokenTransfer(account, address(0), amount);
  }

  function decimals() public pure override returns (uint8) { return _decimals; }

  /*** UTILITY FUNCTIONS ***/

  function _scaled(uint amount) private view returns(uint) {
    return (amount * _scalar) / _precision;
  }

  function _descaled(uint amount) private view returns(uint) {
    return (amount * _precision) / _scalar;
  }
}

contract RedMemoPool is TokenPool {
  constructor() TokenPool("RedMemoPool", "RMPL") {}
}

contract BlackMemoPool is TokenPool {
  constructor() TokenPool("BlackMemoPool", "BMPL") {}
}
