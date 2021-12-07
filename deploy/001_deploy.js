async function deployFunc({deployments, getNamedAccounts}) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  function proxyConfig(initArgs, upradeArgs){
    return {
      from: deployer,
      proxy: {
        owner: deployer,
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
  const Controller = await deploy('RBPoolController', proxyConfig([`${RedMemoPool.address}`, `${BlackMemoPool.address}`], []));

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
