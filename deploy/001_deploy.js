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

  function proxyConfig(initArgs, upradeArgs){
    return {
      from: deployer,
      proxy: {
        proxyContract: 'UUPSProxy',
        execute: {
          init: {
            methodName: 'initialize',
            args: initArgs
          },
          onUpgrade: {
            methodName: 'onUpgrade',
            args: upradeArgs
          }
        }
      },
      log: true    
    }
  }

  const RedMemoPool = await deploy('RedMemoPool', proxyConfig([], []));
  const BlackMemoPool = await deploy('BlackMemoPool', proxyConfig([], []));
  const Controller = await deploy('RBPoolController', proxyConfig(
    [
      `${RedMemoPool.address}`,
      `${BlackMemoPool.address}`,
      rngSeedHash(deployer),
      deployer,
      '500' // 5%
    ],
    []
  ));

  await deployments.execute(
    'RedMemoPool',
    { from: deployer, log: true },
    'setController',
    Controller.address,
  );

  await deployments.execute(
    'BlackMemoPool',
    { from: deployer, log: true },
    'setController',
    Controller.address,
  );
}

deployFunc.tags = ['main'];
module.exports = deployFunc;
