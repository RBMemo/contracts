// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract MemoPool {
  function mint(address account, uint amount) public {}
  function burn(address account, uint amount) public {}
}

contract RBPoolController is Initializable, OwnableUpgradeable, UUPSUpgradeable {
  ERC20Permit public constant MEMO_CONTRACT = ERC20Permit(0x136Acd46C134E8269052c62A67042D6bDeDde3C9);

  MemoPool[2] private _pools;

  struct PermitSignature {
    address owner;
    address spender;
    uint256 amount;
    uint256 deadline;
    uint8 v;
    bytes32 r;
    bytes32 s;
  }

  enum Pool {
    red,
    black
  }
  
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() initializer {}

  function initialize(address redMemoPool, address blackMemoPool) initializer public {
    __Ownable_init();
    __UUPSUpgradeable_init();

    _pools[uint(Pool.red)] = MemoPool(redMemoPool);
    _pools[uint(Pool.black)] = MemoPool(blackMemoPool);
  }

  function deposit(address account, uint amount, Pool pool, PermitSignature memory permitSignature) external returns(bool) {
    memoPermit(permitSignature);
    SafeERC20.safeTransferFrom(MEMO_CONTRACT, account, address(this), amount);
    _pool(pool).mint(account, amount);
    return true;
  }

  function withdraw(address account, uint amount, Pool pool) external returns(bool) {
    _pool(pool).burn(account, amount);
    SafeERC20.safeTransfer(MEMO_CONTRACT, account, amount);
    return true;
  }

  function poolSwap(address account, uint amount, Pool fromPool, Pool toPool) external {
    _pool(fromPool).burn(account, amount);
    _pool(toPool).mint(account, amount);
  }

  function memoPermit(PermitSignature memory permitSignature) public {
    MEMO_CONTRACT.permit(
      permitSignature.owner,
      permitSignature.spender,
      permitSignature.amount,
      permitSignature.deadline,
      permitSignature.v,
      permitSignature.r,
      permitSignature.s
    );
  }

  function _pool(Pool pool) private view returns(MemoPool) { return _pools[uint(pool)]; }

  function onUpgrade() public onlyOwner {}
  function _authorizeUpgrade(address newImplementation) internal onlyOwner override {}
}