const { ethers, deployments: { getArtifact } } = require('hardhat');
const { signERC2612Permit } = require('eth-permit');
const Web3 = require('web3');

const MEMO_ADDRESS = '0x136Acd46C134E8269052c62A67042D6bDeDde3C9';
const MEMO_HOLDER = '0x087e9c8ef2d97740340a471ff8bb49f5490f6cf6';

async function setupUsers(addresses, contracts) {
  const users = [];
  for (const address of addresses) {
    users.push(await setupUser(address, contracts));
  }
  return users;
}

async function setupUser(address, contracts) {
  const user = { address };
  for (const key of Object.keys(contracts)) {
    user.signer = await ethers.getSigner(address);
    user[key] = contracts[key].connect(user.signer);
  }
  return user;
}

async function signPermit(owner, spender, amount) {
  const { r, s, v, value, deadline } = await signERC2612Permit(
    ethers.provider,
    MEMO_ADDRESS,
    owner,
    spender,
    amount
  );

  return [owner, spender, value, deadline, v, r, s];
}

async function getMemoContract(signer) {
  const mockMemo = await getArtifact('MEMOries');
  return new ethers.Contract(MEMO_ADDRESS, mockMemo.abi, signer);
}

async function setupSendMemo(address, amount) {
  const addrSigner = await ethers.getSigner(address);
  await addrSigner.sendTransaction({
    to: MEMO_HOLDER,
    value: amount
  });
}

async function sendMemo(address, amount) {  
  if((await ethers.provider.getBalance(MEMO_HOLDER)).lt(.001 * 10**18)) {
    await setupSendMemo(address, `${1 * 10**18}`);
  }
  
  await ethers.provider.send(
    'hardhat_impersonateAccount',
    [MEMO_HOLDER]
  );

  const timeStakeSigner = await ethers.getSigner(MEMO_HOLDER);
  const memoContract = await getMemoContract(timeStakeSigner);
  await memoContract.transfer(address, amount);

  await ethers.provider.send(
    'hardhat_stopImpersonatingAccount',
    [MEMO_HOLDER]
  );
}

function rngSeedHash(seedKey, address) {  
  const web3 = new Web3(ethers.provider);
  const { utils, eth } = web3;

  let seedHex = utils.padLeft(utils.toHex(seedKey), 64);
  let encoded = eth.abi.encodeParameters(['address', 'bytes32'], [address, seedHex]);
  return utils.sha3(encoded);
}

function rngSeedHex(seedKey) {
  const web3 = new Web3(ethers.provider);
  const { utils } = web3;

  return utils.padLeft(utils.toHex(seedKey), 64);
}

module.exports = {
  setupUsers,
  setupUser,
  signPermit,
  sendMemo,
  getMemoContract,
  rngSeedHash,
  rngSeedHex
}
