const hre = require("hardhat");
const ethers = hre.ethers;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ROOT_NODE = '0x00000000000000000000000000000000';
const Web3 = require('web3');
const interfaces = require('./interfaces');
const { DAYS, registerName, loadContract, deploy } = require("./utils");
const deployDNSSEC = require("./deployDNSSEC");
// ipfs://QmTeW79w7QQ6Npa3b1d5tANreCDxF2iDaAPsDvW6KtLmfB
// const contenthash = '0xe301017012204edd2984eeaf3ddf50bac238ec95c5713fb40b5e428b508fdbe55d3b9f155ffe';
// const content = '0x736f6d65436f6e74656e74000000000000000000000000000000000000000000';
const toBN = require('web3-utils').toBN
const {
  legacyRegistrar: legacyRegistrarInterfaceId,
  permanentRegistrar: permanentRegistrarInterfaceId,
  permanentRegistrarWithConfig: permanentRegistrarWithConfigInterfaceId,
  bulkRenewal: bulkRenewalInterfaceId,
  linearPremiumPriceOracle: linearPremiumPriceOracleInterfaceId
} = interfaces
const config = require("../config.json");
const { default: BigNumber } = require("bignumber.js");

const tld = config.tld;
const { sha3 } = web3.utils
const tldHash = sha3(tld)
const dnssec = config.dnssec;
const exponential = config.exponential;

function namehash(name) {
  let node =
    '0x0000000000000000000000000000000000000000000000000000000000000000'
  if (name !== '') {
    let labels = name.split('.')
    for (let i = labels.length - 1; i >= 0; i--) {
      node = sha3(node + sha3(labels[i]).slice(2), {
        encoding: 'hex',
      })
    }
  }
  return node.toString()
}

async function main() {
  console.log({ dnssec, exponential });

  hre.Web3 = Web3;
  hre.web3 = new Web3(hre.network.provider);
  const web3 = hre.web3;

  const now = (await web3.eth.getBlock('latest')).timestamp

  const signers = await ethers.getSigners();
  const accounts = signers.map(s => s.address);

  const registryJSON = loadContract('registry', 'ENSRegistry')
  const resolverJSON = loadContract('resolvers', 'PublicResolver')
  const oldResolverJSON = loadContract('ens-022', 'PublicResolver')
  const reverseRegistrarJSON = loadContract('registry', 'ReverseRegistrar')
  const priceOracleJSON = loadContract('ethregistrar-202', 'SimplePriceOracle')
  const linearPremiumPriceOracleJSON = loadContract('ethregistrar', 'LinearPremiumPriceOracle')
  const exponentialPremiumPriceOracleJSON = loadContract('ethregistrar', 'ExponentialPremiumPriceOracle')
  const controllerJSON = loadContract('ethregistrar', 'ETHRegistrarController')
  const bulkRenewalJSON = loadContract('ethregistrar', 'BulkRenewal')
  const legacyAuctionRegistrarSimplifiedJSON = loadContract('ens-022', 'HashRegistrar')
  const ENSWithFallbackJSON = loadContract('registry', 'ENSRegistryWithFallback')
  const oldBaseRegistrarJSON = loadContract('ethregistrar-202', 'OldBaseRegistrarImplementation')
  const newBaseRegistrarJSON = loadContract('ethregistrar', 'BaseRegistrarImplementation')
  const registrarMigrationJSON = loadContract('ethregistrar-202', 'RegistrarMigration')
  const EthRegistrarSubdomainRegistrarJSON = loadContract('subdomain-registrar', 'EthRegistrarSubdomainRegistrar')
  const ENSMigrationSubdomainRegistrarJSON = loadContract('subdomain-registrar', 'ENSMigrationSubdomainRegistrar')
  const WrappedPriceOracle = await ethers.getContractFactory("WrappedPriceOracle");

  console.log('Deploying from account ', accounts[0])
  /* Deploy the main contracts  */
  try {
    var ens = await deploy(web3, accounts[0], registryJSON)
    var resolver = await deploy(web3, accounts[0], resolverJSON, ens._address, ZERO_ADDRESS)
    var oldResolver = await deploy(web3, accounts[0], oldResolverJSON, ens._address)
    var oldReverseRegistrar = await deploy(web3, accounts[0], reverseRegistrarJSON, ens._address, resolver._address)
    var legacyAuctionRegistrar = await deploy(web3, accounts[0], legacyAuctionRegistrarSimplifiedJSON, ens._address, namehash(tld), now - 60 * 60 * 24 * 7 * 8)
  } catch (e) {
    console.log('deployment failed', e)
  }

  /* Setup the root TLD */
  await ens.methods.setSubnodeOwner(ROOT_NODE, tldHash, accounts[0]).send({ from: accounts[0] })
  await ens.methods.setResolver(namehash(''), resolver._address).send({ from: accounts[0] })
  await ens.methods.setResolver(namehash(tld), resolver._address).send({ from: accounts[0] })
  await ens.methods.setSubnodeOwner(ROOT_NODE, sha3(tld), legacyAuctionRegistrar._address).send({ from: accounts[0] })

  /* Setup the root reverse node */
  await ens.methods.setSubnodeOwner(ROOT_NODE, sha3('reverse'), accounts[0]).send({ from: accounts[0] })

  await ens.methods.setSubnodeOwner(namehash('reverse'), sha3('addr'), accounts[0]).send({ from: accounts[0] })
  console.log('setup root reverse with addr label')

  await ens.methods.setResolver(namehash('addr.reverse'), resolver._address).send({ from: accounts[0] })
  console.log('setup root reverse with public resolver')

  /* Setup the reverse subdomain: addr.reverse */
  await ens.methods.setSubnodeOwner(namehash('reverse'), sha3('addr'), oldReverseRegistrar._address).send({ from: accounts[0] })

  /* Set the old hash registrar contract as the owner of .tld */
  await ens.methods.setSubnodeOwner(ROOT_NODE, tldHash, legacyAuctionRegistrar._address).send({ from: accounts[0] })
  console.log('Successfully setup old hash registrar')

  const oldBaseRegistrar = await deploy(web3, accounts[0], oldBaseRegistrarJSON, ens._address, legacyAuctionRegistrar._address, namehash(tld), BigNumber(now).plus(BigNumber(365).multipliedBy(24 * 60 * 60)).toString())
  console.log('Base registrar deployed at: ', oldBaseRegistrar._address)
  console.log('Successfully setup base registrar')

  const priceOracle = await deploy(web3, accounts[0], priceOracleJSON, 1)
  console.log('Price oracle deployed at: ', priceOracle._address)

  const controller = await deploy(web3, accounts[0], controllerJSON, oldBaseRegistrar._address, priceOracle._address, 2, 86400)
  console.log('Controller deployed at: ', controller._address)
  console.log('Successfully setup permanent registrar controller')

  await ens.methods.setSubnodeOwner(ROOT_NODE, tldHash, accounts[0]).send({ from: accounts[0] })

  try {
    await resolver.methods.setInterface(namehash(tld), legacyRegistrarInterfaceId, legacyAuctionRegistrar._address).send({ from: accounts[0], })
    console.log(`Set .tld legacy registrar interface Id to ${legacyAuctionRegistrar._address}`)
  } catch (e) {
    console.log(e)
  }

  await resolver.methods.setInterface(namehash(tld), permanentRegistrarInterfaceId, controller._address).send({ from: accounts[0] })
  console.log(`Set .tld permanent registrar interface Id to ${controller._address}`)

  /* Set the permanent registrar contract as the owner of .eth */
  await ens.methods.setSubnodeOwner(ROOT_NODE, tldHash, oldBaseRegistrar._address).send({ from: accounts[0] })

  console.log('Add controller to base registrar')
  await oldBaseRegistrar.methods.addController(controller._address).send({ from: accounts[0] })

  // const newnames = [
  //   'testing',
  //   'newname',
  //   'resolver',
  //   'oldresolver',
  //   'awesome',
  //   'superawesome',
  //   'notsoawesome',
  //   'abittooawesome',
  //   'abittooawesome2',
  //   'abittooawesome3',
  //   'subdomaindummy',
  //   'contractdomain',
  //   'data',
  //   'ens',
  // ]
  const newnames = [
    'resolver',
    'oldresolver',
    'data',
    'ens'
  ]

  console.log('Register name')
  try {
    for (var i = 0; i < newnames.length; i++) {
      await registerName(web3, accounts[0], controller.methods, newnames[i])
    }
  } catch (e) {
    console.log('Failed to register a name', e)
  }

  /* Point the resolver.'+tlds resolver to the public resolver */
  console.log('Setting up resolvers')
  await ens.methods.setResolver(namehash('resolver.' + tld), resolver._address).send({ from: accounts[0] })

  console.log('Setting up oldresolvers')
  await ens.methods.setResolver(namehash('oldresolver.' + tld), oldResolver._address).send({ from: accounts[0] })

  console.log('Setting up addrs')
  /* Resolve the resolver.eth address to the address of the public resolver */
  await resolver.methods.setAddr(namehash('resolver.' + tld), resolver._address).send({ from: accounts[0] })

  /* Resolve the oldresolver.eth address to the address of the public resolver */
  await resolver.methods.setAddr(namehash('oldresolver.' + tld), oldResolver._address).send({ from: accounts[0] })

  // /* Resolve the resolver.eth content to a 32 byte content hash */
  // console.log('Setting up contenthash')
  // await resolver.methods.setContenthash(namehash('resolver.' + tld), contenthash).send({ from: accounts[0], gas: 5000000 })
  // await oldResolver.methods.setContent(namehash('oldresolver.' + tld), content).send({ from: accounts[0] })

  /* Setup a reverse for account[0] to eth tld  */
  await oldReverseRegistrar.methods.setName(tld).send({ from: accounts[0], gas: 1000000 })

  const oldSubdomainRegistrar = await deploy(web3, accounts[0], EthRegistrarSubdomainRegistrarJSON, ens._address)
  const subdomainRegistrar = await deploy(web3, accounts[0], ENSMigrationSubdomainRegistrarJSON, ens._address)

  // Create the new ENS registry and registrar
  const newEns = await deploy(web3, accounts[0], ENSWithFallbackJSON, ens._address)

  const newBaseRegistrar = await deploy(web3, accounts[0], newBaseRegistrarJSON, newEns._address, namehash(tld))
  await newBaseRegistrar.methods.addController(accounts[0]).send({ from: accounts[0] })
  // Create the new controller

  let priceOracleOfCurrentNetwork = null;
  let latestAnswer = null;
  let oracleDecimals = null;
  if (config.priceOracle != "") {
    // 正式部署时用，部署priceOracle时需指定当前链上的 AggregatorInterface 实现。
    priceOracleOfCurrentNetwork = await WrappedPriceOracle.deploy(config.priceOracle);　// 这里需要指定实现了AggregatorInterface接口的price oracle合约地址。
    await priceOracleOfCurrentNetwork.deployed();
    latestAnswer = await priceOracleOfCurrentNetwork.latestAnswer();
    oracleDecimals = await priceOracleOfCurrentNetwork.decimals();
    priceOracleOfCurrentNetwork._address = priceOracleOfCurrentNetwork.address;
  } else {
    // 测试部署用
    console.log('Going to set dummy oracle')
    const dummyOracleJSON = loadContract('ethregistrar', 'DummyOracle')
    const dummyOracleRate = toBN(100000000)
    priceOracleOfCurrentNetwork = await deploy(
      web3,
      accounts[0],
      dummyOracleJSON,
      dummyOracleRate
    )
    latestAnswer = await priceOracleOfCurrentNetwork.methods.latestAnswer().call()
    oracleDecimals = 8;
  }
  console.log('USD Rate', latestAnswer);

  const secondsOfYear = 365 * DAYS;
  const currencyDecimals = config.currencyDecimals; // 这里指定部署目标链本币的decimals。
  const usdPrice = config.priceInUSD; // 这里指定域名价格，单位为USD/年。
  const priceArray = [
    new BigNumber(usdPrice[0]).shiftedBy(currencyDecimals).dividedBy(secondsOfYear).toFixed(0),
    new BigNumber(usdPrice[1]).shiftedBy(currencyDecimals).dividedBy(secondsOfYear).toFixed(0),
    new BigNumber(usdPrice[2]).shiftedBy(currencyDecimals).dividedBy(secondsOfYear).toFixed(0),
    new BigNumber(usdPrice[3]).shiftedBy(currencyDecimals).dividedBy(secondsOfYear).toFixed(0),
    new BigNumber(usdPrice[4]).shiftedBy(currencyDecimals).dividedBy(secondsOfYear).toFixed(0)
  ];
  console.log('priceArray', priceArray);

  const premium = toBN(config.premium) // 这里指定premium的价格，关于premium可参考　https://docs.ens.domains/frequently-asked-questions#what-happens-if-i-forget-to-extend-the-registration-of-a-name
  const decreaseDuration = toBN(28 * DAYS)
  const decreaseRate = premium.div(decreaseDuration)
  const linearPremiumPriceOracle = await deploy(web3, accounts[0], linearPremiumPriceOracleJSON, priceOracleOfCurrentNetwork._address, priceArray, premium, decreaseRate)
  const exponentialPremiumPriceOracle = await deploy(web3, accounts[0], exponentialPremiumPriceOracleJSON, priceOracleOfCurrentNetwork._address, priceArray, 21)
  const newController = await deploy(web3, accounts[0], controllerJSON, newBaseRegistrar._address, exponential ? exponentialPremiumPriceOracle._address : linearPremiumPriceOracle._address, 2, 86400)

  // Create the new resolver
  const newResolver = await deploy(web3, accounts[0], resolverJSON, newEns._address, ZERO_ADDRESS)

  // Set resolver to the new ENS
  async function addNewResolverAndRecords(name) {
    console.log('setting up', name)

    const hash = namehash(name)

    console.log('setting up resolver for', name)
    await newEns.methods.setResolver(hash, newResolver._address).send({ from: accounts[0] })

    console.log('setting up addr for', name)
    await newResolver.methods.setAddr(hash, newResolver._address).send({ from: accounts[0] })

    // ipfs://QmTeW79w7QQ6Npa3b1d5tANreCDxF2iDaAPsDvW6KtLmfB
    // console.log('setting up contenthash for', name)
    // await newResolver.methods.setContenthash(hash, contenthash).send({ from: accounts[0] })

    console.log('finished setting up', name)
  }

  const bulkRenewal = await deploy(web3, accounts[0], bulkRenewalJSON, newEns._address)

  if (dnssec) {
    // Redeploy under new registry
    await deployDNSSEC(web3, accounts, newEns, newResolver)
  }

  await newEns.methods.setSubnodeOwner(ROOT_NODE, sha3(tld), accounts[0]).send({ from: accounts[0] })
  await newEns.methods.setResolver(namehash(tld), newResolver._address).send({ from: accounts[0], gas: 6000000 })
  await newResolver.methods.setApprovalForAll(newController._address, true).send({ from: accounts[0] })
  await newResolver.methods.setInterface(namehash(tld), permanentRegistrarInterfaceId, newController._address).send({ from: accounts[0] })
  await newResolver.methods.setInterface(namehash(tld), permanentRegistrarWithConfigInterfaceId, newController._address).send({ from: accounts[0] })

  // We still need to know what legacyAuctionRegistrar is to check who can release deed.
  if (!dnssec) {
    await newResolver.methods.setInterface(namehash(tld), legacyRegistrarInterfaceId, legacyAuctionRegistrar._address).send({ from: accounts[0] })
  }

  await newResolver.methods.setInterface(namehash(tld), bulkRenewalInterfaceId, bulkRenewal._address).send({ from: accounts[0] })
  await newResolver.methods.setInterface(namehash(tld), linearPremiumPriceOracleInterfaceId, exponential ? exponentialPremiumPriceOracle._address : linearPremiumPriceOracle._address).send({ from: accounts[0] })

  //set notsoawesome to new resolver
  await newEns.methods.setSubnodeOwner(ROOT_NODE, sha3(tld), newBaseRegistrar._address).send({ from: accounts[0] })

  const newReverseRegistrar = await deploy(web3, accounts[0], reverseRegistrarJSON, newEns._address, newResolver._address)
  // Create the migration contract. Make it the owner of tld on the old
  const registrarMigration = await deploy(web3, accounts[0], registrarMigrationJSON, oldBaseRegistrar._address, newBaseRegistrar._address, oldSubdomainRegistrar._address, subdomainRegistrar._address)
  await newBaseRegistrar.methods.addController(registrarMigration._address).send({ from: accounts[0] })
  await ens.methods.setSubnodeOwner(ROOT_NODE, sha3(tld), registrarMigration._address).send({ from: accounts[0] })

  console.log('Migrating permanent registrar names')
  try {
    for (var i = 0; i < newnames.length; i++) {
      let name = newnames[i]
      let domain = `${name}.${tld}`
      let labelhash = sha3(name)
      let owner = await ens.methods.owner(namehash(domain))
      if (owner === accounts[0]) {
        await ens.methods.setTTL(namehash(domain), 123).send({ from: accounts[0] })
        await ens.methods.setResolver(namehash(domain), newResolver._address).send({ from: accounts[0] })
      } else {
        console.log(`${domain} is not owned by ${accounts[0]} hence not setting ttl nor resolver`)
      }

      await registrarMigration.methods.migrate(labelhash).send({ from: accounts[0], gas: 6000000 })
    }
  } catch (e) {
    console.log('Failed to migrate a name', e)
  }

  await newEns.methods.setResolver(namehash('resolver.' + tld), newResolver._address).send({ from: accounts[0] })
  await newResolver.methods.setAddr(namehash('resolver.' + tld), newResolver._address).send({ from: accounts[0] })
  await newBaseRegistrar.methods.addController(newController._address).send({ from: accounts[0] })
  await newEns.methods.setSubnodeOwner(ROOT_NODE, sha3('reverse'), accounts[0]).send({ from: accounts[0] })
  await newEns.methods.setSubnodeOwner(namehash('reverse'), sha3('addr'), newReverseRegistrar._address).send({ from: accounts[0] })
  await newEns.methods.setSubnodeOwner(namehash('data.' + tld), sha3('eth-usd'), accounts[0]).send({ from: accounts[0] })
  await newEns.methods.setSubnodeOwner(namehash('ens.' + tld), sha3('oracle'), accounts[0]).send({ from: accounts[0] })
  await addNewResolverAndRecords('eth-usd.data.' + tld)
  await newResolver.methods.setAddr(namehash('eth-usd.data.' + tld), priceOracleOfCurrentNetwork._address).send({ from: accounts[0] })
  await addNewResolverAndRecords('oracle.ens.' + tld)
  await newResolver.methods.setText(namehash('oracle.ens.' + tld), 'algorithm', exponential ? 'exponential' : 'linear').send({ from: accounts[0] })

  let response = {
    ensAddress: newEns._address,
    oldEnsAddress: ens._address,
    legacyAuctionRegistrarAddress: legacyAuctionRegistrar._address,
    baseRegistrarAddress: newBaseRegistrar._address,
    controllerAddress: newController._address,
    oldResolverAddresses: [resolver._address, oldResolver._address],
    oldControllerAddress: controller._address,
    ownerAddress: accounts[0],
    bulkRenewalAddress: bulkRenewal._address,
    oldContentResolverAddresses: [oldResolver._address],
    oldBaseRegistrarAddress: oldBaseRegistrar._address,
    reverseRegistrarAddress: oldReverseRegistrar._address,
    registrarMigration: registrarMigration && registrarMigration._address,
    resolverAddress: newResolver._address,
    reverseRegistrarAddress: newReverseRegistrar && newReverseRegistrar._address,
    reverseRegistrarOwnerAddress: accounts[0],
    exponentialPremiumPriceOracle: exponentialPremiumPriceOracle._address,
    priceOracleOfCurrentNetwork: priceOracleOfCurrentNetwork._address,
  }

  let contractNames = Object.keys(response)
  console.log('===================================================')
  console.log('Deployed contracts')
  console.log('===================================================')
  contractNames.map((key) => {
    console.log(key, response[key]);
  })
  console.log('===================================================')
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });