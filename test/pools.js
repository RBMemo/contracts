const { expect } = require('./chai-setup');
const { setupUsers, signPermit } = require('./utils');
const { ethers, deployments, getNamedAccounts, getUnnamedAccounts } = require('hardhat');
const bn = ethers.BigNumber;

let deployer;
let poolContract;
let controller;
let users;

['RedMemoPool', 'BlackMemoPool'].forEach(poolName => {
  describe(poolName, () => {
    beforeEach(async () => {
      await deployments.fixture(['main']);
      deployer = (await getNamedAccounts()).deployer;
      poolContract = await ethers.getContract(poolName);
      controller = await ethers.getContract('RBPoolController');
      users = await setupUsers((await getUnnamedAccounts()), { poolContract });
    });

    it('deploys', async () => {
      const testAmount = `${10 * 10**18}`;
      await poolContract.mint(users[0].address, testAmount);
      expect(await poolContract.balanceOf(users[0].address)).to.eq(testAmount);

      expect(users[0].poolContract.mint(users[0].address, testAmount)).to.be.reverted;
    });

    it('has correct name and symbol', async () => {
      expect(await poolContract.name()).to.eq(poolName);

      const symbols = {
        RedMemoPool: 'RMPL',
        BlackMemoPool: 'BMPL'
      };
      expect(await poolContract.symbol()).to.eq(symbols[poolName]);
    });

    it('has 9 decimals', async () => {
      expect(await poolContract.decimals()).to.eq(9);
    });

    it('has controller set', async () => {
      const controllerRole = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CONTROLLER"));
      expect(await poolContract.hasRole(controllerRole, controller.address)).to.eq(true);
    });

    describe('rebase', () => {
      const amounts = [`${1 * 10**9}`, `${5 * 10**9}`, `${2.5 * 10**9}`, `${10 * 10**9}`, `${7.5 * 10**9}`];
      let rebaseAmount = `${1 * 10**9}`;
      let amountSum, expectedBalances;

      beforeEach(async () => {
        await Promise.all(amounts.map(async (n, i) => await poolContract.mint(users[i].address, n)));
        amountSum = amounts.reduce((prev, cur) => Number(prev) + Number(cur));
        expectedBalances = amounts.map(n => (Number(n) / amountSum) * Number(rebaseAmount) + Number(n));
      });
      
      it('changes totalSupply by rebased amount', async () => {
        let totalSupplyBefore = (await poolContract.totalSupply()).toNumber();
        await poolContract.rebase(rebaseAmount);
        let totalSupplyAfter = (await poolContract.totalSupply()).toNumber();
        expect(totalSupplyAfter).to.be.closeTo(totalSupplyBefore + Number(rebaseAmount), 1);
        
        for(var i = 0; i < 100; i++) {
          totalSupplyBefore = (await poolContract.totalSupply()).toNumber();
          await poolContract.rebase(`${10 * 10**9}`);
          totalSupplyAfter = (await poolContract.totalSupply()).toNumber();
          expect(totalSupplyAfter).to.be.closeTo(totalSupplyBefore + 10 * 10**9, 1);
        }
      });

      it('increases balances proportionally', async () => {
        await poolContract.rebase(rebaseAmount);

        expectedBalances.forEach(async (eb, i) => {
          expect((await poolContract.balanceOf(users[i].address)).toNumber()).to.be.closeTo(eb, 1);
        });
      });

      it('allows transfer with new balances', async () => {
        await poolContract.rebase(rebaseAmount);
        
        await Promise.all(expectedBalances.map(async (eb, i) => {
          expect(users[i].poolContract.transfer(deployer, `${Math.floor(eb)}`)).to.not.be.reverted;
        }));

        for(var i = 0; i < expectedBalances.length; i++) {
          expect((await poolContract.balanceOf(users[i].address)).toNumber()).to.eq(0);
        }
      });

      it('allows transferFrom with new balances', async () => {
        await poolContract.rebase(rebaseAmount);

        await Promise.all(expectedBalances.map(async (eb, i) => {
          let amount = `${Math.floor(eb)}`;
          let permistSignature = await signPermit(users[i].address, deployer, amount, poolContract.address);
          await poolContract.permit(...permistSignature);

          expect(poolContract.transferFrom(users[i].address, deployer, amount)).to.not.be.reverted;
        }));
      });

      it('allows burn of new balances', async () => {
        await poolContract.rebase(rebaseAmount);

        let amount = `${Math.floor(expectedBalances[0])}`;
        let totalBefore = (await poolContract.totalSupply()).toNumber();
        
        await expect(poolContract.burn(users[0].address, amount)).to.not.be.reverted;

        let totalAfter = (await poolContract.totalSupply()).toNumber();
        let balanceAfter = (await poolContract.balanceOf(users[0].address)).toNumber();

        expect(totalAfter).to.be.closeTo(totalBefore - Number(amount), 1);
        expect(balanceAfter).to.eq(0);

        amount = `${Math.floor(expectedBalances[1])}`;
        totalBefore = (await poolContract.totalSupply()).toNumber();
        
        await expect(poolContract.burn(users[1].address, amount)).to.not.be.reverted;

        totalAfter = (await poolContract.totalSupply()).toNumber();
        balanceAfter = (await poolContract.balanceOf(users[1].address)).toNumber();

        expect(totalAfter).to.be.closeTo(totalBefore - Number(amount), 1);
        expect(balanceAfter).to.eq(0);
      });

      it('allows mint into new balances', async () => {
        await poolContract.rebase(rebaseAmount);

        let amount = `${Math.floor(expectedBalances[0])}`;
        let totalBefore = (await poolContract.totalSupply()).toNumber();
        let balanceBefore = (await poolContract.balanceOf(users[0].address)).toNumber();
        
        await poolContract.mint(users[0].address, amount);

        let totalAfter = (await poolContract.totalSupply()).toNumber();
        let balanceAfter = (await poolContract.balanceOf(users[0].address)).toNumber();

        expect(totalAfter).to.be.closeTo(totalBefore + Number(amount), 1);
        expect(balanceAfter).to.be.closeTo(balanceBefore + Number(amount), 1);

        amount = `${Math.floor(expectedBalances[1])}`;
        totalBefore = (await poolContract.totalSupply()).toNumber();
        balanceBefore = (await poolContract.balanceOf(users[1].address)).toNumber();
        
        await poolContract.mint(users[1].address, amount);

        totalAfter = (await poolContract.totalSupply()).toNumber();
        balanceAfter = (await poolContract.balanceOf(users[1].address)).toNumber();

        expect(totalAfter).to.be.closeTo(totalBefore + Number(amount), 1);
        expect(balanceAfter).to.be.closeTo(balanceBefore + Number(amount), 1);
      });
    });
  });
});