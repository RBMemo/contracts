const { expect } = require('./chai-setup');
const { setupUsers } = require('./utils');
const { ethers, deployments, getNamedAccounts, getUnnamedAccounts } = require('hardhat');

let deployer;
let poolContract;
let users;

['RedMemoPool', 'BlackMemoPool'].forEach(poolName => {
  describe(poolName, () => {
    beforeEach(async () => {
      await deployments.fixture(['main']);
      deployer = (await getNamedAccounts()).deployer;
      poolContract = await ethers.getContract(poolName);
      users = await setupUsers((await getUnnamedAccounts()), { poolContract });
    });

    it('deploys', async () => {
      const testAmount = `${10 * 10**18}`;
      await poolContract.mint(users[0].address, testAmount);
      expect(await poolContract.balanceOf(users[0].address)).to.eq(testAmount);

      expect(users[0].poolContract.mint(users[0].address, testAmount)).to.be.reverted;
    });
  });
});