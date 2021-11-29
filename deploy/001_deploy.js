async function deployFunc({deployments, getNamedAccounts}) {
  const { deploy, getArtifact } = deployments;
  const { deployer } = await getNamedAccounts();

  const proxy = {
    owner: deployer,
    proxyContract: 'UUPSProxy',
    execute: {
      init: {
        methodName: 'initialize',
        args: []
      },
      onUpgrade: {
        methodName: 'onUpgrade',
        args: []
      }
    }
  };

  const poolProxyConfig = {
    from: deployer,
    proxy,
    log: true    
  };

  await deploy('RedMemoPool', poolProxyConfig);
  await deploy('BlackMemoPool', poolProxyConfig);
}

deployFunc.tags = ['main'];
module.exports = deployFunc;
