// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "./pools.sol";

contract RBPoolController is Ownable {
  ERC20Permit public constant MEMO_CONTRACT = ERC20Permit(0x136Acd46C134E8269052c62A67042D6bDeDde3C9);

  TokenPool[2] private _pools;
  bytes32 private _lastActorHash; // hash of last address to interact with pools
  bytes32 private _seedHash; // hash of RNG seed
  address payable public feeCollector;
  uint16 public feeBP; // fee % (out of 10000)
  bool public depositLock;
  bool public withdrawLock;

  event LogRebase(uint indexed timestamp, uint amount, uint redSupply, uint blackSupply, uint8 selectedPool);

  // Signature for EIP-2612 signed approvals
  struct PermitSignature {
    address owner;
    address spender;
    uint256 amount;
    uint256 deadline;
    uint8 v;
    bytes32 r;
    bytes32 s;
  }

  // Token Pool Enum
  enum Pool {
    red,
    black
  }
  
  constructor(
    address redMemoPool,
    address blackMemoPool,
    bytes32 initialSeedHash,
    address payable feeCollector_,
    uint16 feeBP_
  ) {
    _pools[uint(Pool.red)] = TokenPool(redMemoPool);
    _pools[uint(Pool.black)] = TokenPool(blackMemoPool);
    _seedHash = initialSeedHash;
    feeCollector = feeCollector_;
    feeBP = feeBP_;
    depositLock = false;
    withdrawLock = false;
  }

  /*** USER CALLED FUNCTIONS ***/

  function deposit(uint amount, Pool pool, PermitSignature memory permitSignature) external returns(bool) {
    require(!depositLock, "Deposit is locked");

    memoPermit(permitSignature);
    SafeERC20.safeTransferFrom(MEMO_CONTRACT, _msgSender(), address(this), amount);
    _pool(pool).mint(_msgSender(), amount);
    _setLastActor();
    return true;
  }

  function withdraw(uint amount, Pool pool) external returns(bool) {
    require(!withdrawLock, "Withdraw is locked");

    _pool(pool).burn(_msgSender(), amount);
    SafeERC20.safeTransfer(MEMO_CONTRACT, _msgSender(), amount);
    _setLastActor();
    return true;
  }

  function poolSwap(uint amount, Pool fromPool, Pool toPool) external {
    require(!withdrawLock, "Swap is locked from withdraw");
    
    _pool(fromPool).burn(_msgSender(), amount);
    _pool(toPool).mint(_msgSender(), amount);
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

  /*** OWNER CALLED FUNCTIONS ***/

  function rebase(bytes32 seedKey, bytes32 newSeedHash) external onlyOwner {
    require(MEMO_CONTRACT.balanceOf(address(this)) > 0, "Controller has no MEMO");
    uint[2] memory depositedMemo = [_pool(Pool.red).totalSupply(), _pool(Pool.black).totalSupply()];
    require((depositedMemo[0] + depositedMemo[1]) > 0, "No MEMO deposited in pools");

    uint totalDeposited = depositedMemo[0] + depositedMemo[1];
    uint totalRebase = MEMO_CONTRACT.balanceOf(address(this)) - totalDeposited;

    uint fee = (feeBP * totalRebase) / 10000;
    MEMO_CONTRACT.transfer(feeCollector, fee);

    Pool selected = _poolRNG(seedKey);
    if(depositedMemo[uint(selected)] == 0) {
      selected = selected == Pool.red ? Pool.black : Pool.red;
    }

    _pool(selected).rebase(totalRebase - fee);

    _seedHash = newSeedHash;
    depositLock = false;
    withdrawLock = false;

    emit LogRebase(block.timestamp, totalRebase - fee, depositedMemo[0], depositedMemo[1], uint8(selected));
  }

  function setFeeBP(uint16 newBP) external onlyOwner { feeBP = newBP; }
  function setFeeCollector(address payable newCollector) external onlyOwner { feeCollector = newCollector; }
  function setDepositLock(bool lockStatus) external onlyOwner { depositLock = lockStatus; }
  function setWithdrawLock(bool lockStatus) external onlyOwner { withdrawLock = lockStatus; }

  /*** UTILITY FUNCTIONS ***/

  function _poolRNG(bytes32 seedKey) private view returns(Pool) {
    bytes32 foundSeedHash = keccak256(abi.encode(_msgSender(), seedKey));
    require(foundSeedHash == _seedHash, "Invalid RNG seed key");

    uint random_num = uint(keccak256(abi.encode(
      seedKey,
      blockhash(block.number - 1),
      _lastActorHash,
      _pool(Pool.red).totalSupply(),
      _pool(Pool.black).totalSupply()
    )));

    return Pool(random_num % 2);
  }

  function _setLastActor() private { _lastActorHash = keccak256(abi.encode(_msgSender())); }
  function _pool(Pool pool) private view returns(TokenPool) { return _pools[uint(pool)]; }
}