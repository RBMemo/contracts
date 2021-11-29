const { Contract } = require('ethers');
const { ethers } = require('hardhat');

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

module.exports = {
  setupUsers,
  setupUser
}
