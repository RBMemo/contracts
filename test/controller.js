const { ethers, deployments, getNamedAccounts, getUnnamedAccounts } = require('hardhat');
const { expect } = require('./chai-setup');
const { setupUsers, signPermit, sendMemo, getMemoContract } = require('./utils');
const bn = ethers.BigNumber;

let deployer;
let redPool;
let blackPool;
let controller;
let users;

describe('RBPoolController', () => {
  beforeEach(async () => {
    await deployments.fixture(['main']);
    deployer = (await getNamedAccounts()).deployer;
    redPool = await ethers.getContract('RedMemoPool');
    blackPool = await ethers.getContract('BlackMemoPool');
    controller = await ethers.getContract('RBPoolController');
    users = await setupUsers((await getUnnamedAccounts()), { controller });
  });
  
  ['red', 'black'].forEach(color => {
    describe(`${color}`, () => {
      const pool = color === 'red' ? 0 : 1;
      let poolContract;

      beforeEach(async () => {
        await sendMemo(users[0].address, `${1 * 10**9}`);
        poolContract = eval(`${color}Pool`);
      });

      describe('deposits', () => {
        it('requires approval', async () => {
          let permitSignature = await signPermit(users[1].address, controller.address, `${1 * 10**9}`);
          expect(controller.deposit(users[0].address, `${1 * 10**9}`, pool, permitSignature)).to.be.revertedWith(/subtraction overflow/);

          permitSignature = await signPermit(users[0].address, controller.address, `${1 * 10**9}`);
          expect(controller.deposit(users[0].address, `${1 * 10**9}`, pool, permitSignature)).to.not.be.reverted;
        });

        it('exchanges correct tokens', async () => {
          const memoContract = await getMemoContract(ethers.provider);
          const amount = `${1 * 10**9}`;

          permitSignature = await signPermit(users[0].address, controller.address, amount);
          await controller.deposit(users[0].address, amount, pool, permitSignature);

          expect((await memoContract.balanceOf(controller.address)).eq(bn.from(amount))).to.eq(true);
          expect((await poolContract.balanceOf(users[0].address)).eq(bn.from(amount))).to.eq(true);
        });

        it('only accepts 0 or 1 for pool', async () => {
          let permitSignature = await signPermit(users[1].address, controller.address, `${1 * 10**9}`);
          expect(controller.deposit(users[0].address, `${1 * 10**9}`, -1, permitSignature)).to.be.reverted;

          permitSignature = await signPermit(users[1].address, controller.address, `${1 * 10**9}`);
          expect(controller.deposit(users[0].address, `${1 * 10**9}`, 3, permitSignature)).to.be.reverted;
        });
      });

      describe('withdraws', () => {
        it('exchanges correct tokens', async () => {
          const memoContract = await getMemoContract(ethers.provider);
          const depoAmount = `${1 * 10**9}`;
          const withAmount = `${.75 * 10**9}`;
          const diff = bn.from(depoAmount).sub(withAmount);

          permitSignature = await signPermit(users[0].address, controller.address, depoAmount);
          await controller.deposit(users[0].address, `${1 * 10**9}`, pool, permitSignature);

          await controller.withdraw(users[0].address, withAmount, pool);

          expect((await memoContract.balanceOf(controller.address)).eq(bn.from(diff))).to.eq(true);
          expect((await memoContract.balanceOf(users[0].address)).eq(bn.from(withAmount))).to.eq(true);
          expect((await poolContract.balanceOf(users[0].address)).eq(bn.from(diff))).to.eq(true);
        });
      });
    });
  });

  describe('poolSwap', () => {
    beforeEach(async () => {
      await sendMemo(users[0].address, `${1 * 10**9}`);
      permitSignature = await signPermit(users[0].address, controller.address, `${1 * 10**9}`);
      await controller.deposit(users[0].address, `${1 * 10**9}`, 0, permitSignature);
    });

    it('swaps pool tokens', async () => {
      await controller.poolSwap(users[0].address, `${.75 * 10**9}`, 0, 1);

      expect((await redPool.balanceOf(users[0].address)).eq(bn.from(`${.25 * 10**9}`))).to.eq(true);
      expect((await blackPool.balanceOf(users[0].address)).eq(bn.from(`${.75 * 10**9}`))).to.eq(true);
    });

    it('only allows balance amount', async () => {
      expect(controller.poolSwap(users[0].address, `${2 * 10**9}`, 0, 1)).to.be.reverted;
    });
  });
});