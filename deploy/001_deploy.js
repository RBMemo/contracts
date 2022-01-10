const Web3 = require('web3');

const seedKey = 'initial$33d';

function rngSeedHash(address) {  
  const web3 = new Web3(ethers.provider);
  const { utils, eth } = web3;

  let seedHex = utils.padLeft(utils.toHex(seedKey), 64);
  let encoded = eth.abi.encodeParameters(['address', 'bytes32'], [address, seedHex]);
  return utils.sha3(encoded);
}

async function deployFunc({deployments, getNamedAccounts}) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const baseArgs = {
    from: deployer,
    log: true    
  }

  const RedMemoPool = await deploy('RedMemoPool', baseArgs);
  const BlackMemoPool = await deploy('BlackMemoPool', baseArgs);
  const Controller = await deploy('RBPoolController', {
    ...baseArgs,
    args: [
      `${RedMemoPool.address}`,
      `${BlackMemoPool.address}`,
      rngSeedHash(deployer),
      deployer,
      '330' // 3.3%
    ]
  });

  if(Controller.newlyDeployed || RedMemoPool.newlyDeployed) {
    await deployments.execute(
      'RedMemoPool',
      { from: deployer, log: true },
      'setController',
      Controller.address,
    );
  }
  
  if(Controller.newlyDeployed || BlackMemoPool.newlyDeployed) {
    await deployments.execute(
      'BlackMemoPool',
      { from: deployer, log: true },
      'setController',
      Controller.address,
    );
  }
}

deployFunc.tags = ['main'];
module.exports = deployFunc;
