const { setupUsers, signPermit, sendMemo, getMemoContract, rngSeedHash, rngSeedHex } = require('./utils');
const { ethers, deployments, getNamedAccounts, getUnnamedAccounts } = require('hardhat');
const { expect } = require('./chai-setup');
const { v4: uuidv4 } = require('uuid');
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
      let permitSignature = await signPermit(users[0].address, controller.address, `${1 * 10**9}`);
      await controller.deposit(users[0].address, `${1 * 10**9}`, 0, permitSignature);
    });

    it('swaps pool tokens', async () => {
      await users[0].controller.poolSwap(`${.75 * 10**9}`, 0, 1);

      expect((await redPool.balanceOf(users[0].address)).eq(bn.from(`${.25 * 10**9}`))).to.eq(true);
      expect((await blackPool.balanceOf(users[0].address)).eq(bn.from(`${.75 * 10**9}`))).to.eq(true);
    });

    it('only allows balance amount', async () => {
      expect(users[0].controller.poolSwap(`${2 * 10**9}`, 0, 1)).to.be.reverted;
    });

    it('only allows sending user to swap', async () => {
      await expect(users[1].controller.poolSwap(`${.75 * 10**9}`, 0, 1)).to.be.reverted;
      await expect(controller.poolSwap(`${.75 * 10**9}`, 0, 1)).to.be.reverted;
      await expect(users[0].controller.poolSwap(`${.75 * 10**9}`, 0, 1)).to.not.be.reverted;
    });
  });

  describe('rebase', () => {
    const seedKey = rngSeedHex('initial$33d');
    let newSeedHash;

    beforeEach(async () => {
        await sendMemo(users[0].address, `${1 * 10**9}`);
        newSeedHash = rngSeedHash(`${uuidv4().slice(0,23)}`, deployer);
    });
    
    context('when both pools have supply', () => {
      beforeEach(async () => {
        let permitSignature = await signPermit(users[0].address, controller.address, `${.5 * 10**9}`);
        await controller.deposit(users[0].address, `${.5 * 10**9}`, 0, permitSignature);
        
        permitSignature = await signPermit(users[0].address, controller.address, `${.5 * 10**9}`);
        await controller.deposit(users[0].address, `${.5 * 10**9}`, 1, permitSignature);  
      });
  
      it('reverts with invalid seedKey', async () => {
        const badKey = rngSeedHex('badkey');
        expect(controller.rebase(badKey, newSeedHash)).to.be.revertedWith('Invalid RNG seed key');
      });
  
      it('sends fee to collector', async () => {
        const memoContract = await getMemoContract(ethers.provider);
        const feeCollector = await controller.feeCollector();
        const feeBP = await controller.feeBP();
        
        await sendMemo(controller.address, `${1 * 10**9}`);
        await controller.rebase(seedKey, newSeedHash);
        const collectorBalance = await memoContract.balanceOf(feeCollector);
  
        expect(bn.from(`${1 * 10**9}`).mul(feeBP).div(10000).eq(collectorBalance)).to.eq(true);
      });
    });

    context('when only 1 pool has supply', () => {
      beforeEach(async () => {
        let permitSignature = await signPermit(users[0].address, controller.address, `${.5 * 10**9}`);
        await controller.deposit(users[0].address, `${.5 * 10**9}`, 1, permitSignature);
      });

      it('always rebases to pool having supply', async () => {
        const key1 = 'key1';
        const key2 = 'key2';
        const key3 = 'key3';
        const key4 = 'key4';
        const key5 = 'key5';
        
        let prevBalance = (await blackPool.balanceOf(users[0].address)).toNumber();
        await sendMemo(controller.address, `${1 * 10**9}`);
        await controller.rebase(seedKey, rngSeedHash(key1, deployer));
        let newBalance = (await blackPool.balanceOf(users[0].address)).toNumber();
        expect(prevBalance < newBalance).to.eq(true);

        prevBalance = (await blackPool.balanceOf(users[0].address)).toNumber();
        await sendMemo(controller.address, `${1 * 10**9}`);
        await controller.rebase(rngSeedHex(key1), rngSeedHash(key2, deployer));
        newBalance = (await blackPool.balanceOf(users[0].address)).toNumber();
        expect(prevBalance < newBalance).to.eq(true);

        prevBalance = (await blackPool.balanceOf(users[0].address)).toNumber();
        await sendMemo(controller.address, `${1 * 10**9}`);
        await controller.rebase(rngSeedHex(key2), rngSeedHash(key3, deployer));
        newBalance = (await blackPool.balanceOf(users[0].address)).toNumber();
        expect(prevBalance < newBalance).to.eq(true);

        prevBalance = (await blackPool.balanceOf(users[0].address)).toNumber();
        await sendMemo(controller.address, `${1 * 10**9}`);
        await controller.rebase(rngSeedHex(key3), rngSeedHash(key4, deployer));
        newBalance = (await blackPool.balanceOf(users[0].address)).toNumber();
        expect(prevBalance < newBalance).to.eq(true);

        prevBalance = (await blackPool.balanceOf(users[0].address)).toNumber();
        await sendMemo(controller.address, `${1 * 10**9}`);
        await controller.rebase(rngSeedHex(key4), rngSeedHash(key5, deployer));
        newBalance = (await blackPool.balanceOf(users[0].address)).toNumber();
        expect(prevBalance < newBalance).to.eq(true);
      });
    });
  });
});