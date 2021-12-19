// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./pools.sol";

contract RBPoolController is Initializable, OwnableUpgradeable, UUPSUpgradeable {
  ERC20Permit public constant MEMO_CONTRACT = ERC20Permit(0x136Acd46C134E8269052c62A67042D6bDeDde3C9);

  TokenPool[2] private _pools;
  bytes32 private _lastActorHash;
  bytes32 private _seedHash;
  address payable public feeCollector;
  uint16 public feeBP;

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
  
  constructor() initializer {}

  function initialize(
    address redMemoPool,
    address blackMemoPool,
    bytes32 initialSeedHash,
    address payable feeCollector_,
    uint16 feeBP_
  ) initializer public {
    __Ownable_init();
    __UUPSUpgradeable_init();

    _pools[uint(Pool.red)] = TokenPool(redMemoPool);
    _pools[uint(Pool.black)] = TokenPool(blackMemoPool);
    _seedHash = initialSeedHash;
    feeCollector = feeCollector_;
    feeBP = feeBP_;
  }

  function deposit(address account, uint amount, Pool pool, PermitSignature memory permitSignature) external returns(bool) {
    memoPermit(permitSignature);
    SafeERC20.safeTransferFrom(MEMO_CONTRACT, account, address(this), amount);
    _pool(pool).mint(account, amount);
    _setLastActor();
    return true;
  }

  function withdraw(address account, uint amount, Pool pool) external returns(bool) {
    _pool(pool).burn(account, amount);
    SafeERC20.safeTransfer(MEMO_CONTRACT, account, amount);
    _setLastActor();
    return true;
  }

  function poolSwap(address account, uint amount, Pool fromPool, Pool toPool) external {
    _pool(fromPool).burn(account, amount);
    _pool(toPool).mint(account, amount);
    _setLastActor();
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

  function rebase(bytes32 seedKey, bytes32 newSeedHash) external onlyOwner {
    require(MEMO_CONTRACT.balanceOf(address(this)) > 0, "Controller has no MEMO");
    uint[2] memory depositedMemo = [_pool(Pool.red).totalSupply(), _pool(Pool.black).totalSupply()];
    require(depositedMemo[0] > 0 && depositedMemo[1] > 0, "No MEMO deposited in a pool");

    uint totalDeposited = depositedMemo[0] + depositedMemo[1];
    uint totalRebase = MEMO_CONTRACT.balanceOf(address(this)) - totalDeposited;

    uint fee = (feeBP * totalRebase) / 10000;
    MEMO_CONTRACT.transfer(feeCollector, fee);

    TokenPool selectedPool = _poolRNG(seedKey);
    selectedPool.rebase(totalRebase - fee);

    _seedHash = newSeedHash;
  }

  function _poolRNG(bytes32 seedKey) private view returns(TokenPool) {
    bytes32 foundSeedHash = keccak256(abi.encode(_msgSender(), seedKey));
    require(foundSeedHash == _seedHash, "Invalid RNG seed key");

    uint random_num = uint(keccak256(abi.encode(
      seedKey,
      blockhash(block.number - 1),
      _lastActorHash,
      _pool(Pool.red).totalSupply(),
      _pool(Pool.black).totalSupply()
    )));

    return _pool(Pool(random_num % 2));
  }

  function _setLastActor() private { _lastActorHash = keccak256(abi.encode(_msgSender())); }
  function _pool(Pool pool) private view returns(TokenPool) { return _pools[uint(pool)]; }

  function onUpgrade() public onlyOwner {}
  function _authorizeUpgrade(address newImplementation) internal onlyOwner override {}
}