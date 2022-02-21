const Web3 = require('web3');

const seedKey = 'initial$33d'; // hard-coded initial rebase seedKey, first rebase not exposed to public

// provides hash of seedKey
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
      deployer, // fee collector
      '330' // fee of 3.3%
    ]
  });

  // set controller for RedMemoPool
  if(Controller.newlyDeployed || RedMemoPool.newlyDeployed) {
    await deployments.execute(
      'RedMemoPool',
      { from: deployer, log: true },
      'setController',
      Controller.address,
    );
  }
  
  // set controller for BlackMemoPool
  if(Controller.newlyDeployed || BlackMemoPool.newlyDeployed) {
    await deployments.execute(
      'BlackMemoPool',
      { from: deployer, log: true },
      'setController',
      Controller.address,
    );
  }
}

deployFunc.tags = ['main']; // tag for tests
module.exports = deployFunc;
