const util = require('util')
const moment = require('moment');
const hardhatConfig = require('../hardhat.config');
const DAYS = 86400;

const advanceTime = util.promisify(function (web3, delay, done) {
  return web3.currentProvider.send(
    {
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [delay],
    },
    done
  )
})

const mine = util.promisify(function (web3, done) {
  return web3.currentProvider.send(
    {
      jsonrpc: '2.0',
      method: 'evm_mine',
    },
    done
  )
})

const getGas = (estimatedGas = 0) => {
  const tempObject = {};

  const g = hardhatConfig.networks[process.env.npm_config_network].gas;
  if (estimatedGas > 0) {
    tempObject.gas = estimatedGas;
  } else if (g && (typeof g) === "number") {
    tempObject.gas = g;
  }

  const price = hardhatConfig.networks[process.env.npm_config_network].gasPrice;
  if (price && (typeof price) === "number") {
    tempObject.gasPrice = price;
  }

  return tempObject;
}

const registerName = async function (
  web3,
  account,
  controllerContract,
  name,
  duration = 365 * DAYS
) {
  console.log(`Registering ${name}`)
  const secret = '0x0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF'
  // const VALUE = duration + 1
  let newnameAvailable = await controllerContract.available(name).call()
  var commitment = await controllerContract.makeCommitment(name, account, secret).call()
  await controllerContract.commit(commitment).send({ from: account })
  // var minCommitmentAge = await controllerContract.minCommitmentAge().call()
  // const time = await advanceTime(web3, parseInt(minCommitmentAge))
  // await mine(web3)
  const value = await controllerContract.rentPrice(name, duration).call()
  const trx = await controllerContract
    .register(name, account, duration, secret)
    .send({ from: account, value: value, ...getGas() })

  const registeredAt = moment(
    (await web3.eth.getBlock('latest')).timestamp * 1000
  )
  const expiresTimestamp = trx.events.NameRegistered.returnValues.expires
  const expires = moment(expiresTimestamp * 1000)
  const releasedDate = moment(expiresTimestamp * 1000).add(90, 'days')
  const endOfPremiumDate = moment(expiresTimestamp * 1000).add(90 + 28, 'days')

  console.log({
    name,
    registeredAt,
    expiresTimestamp,
    expires,
    releasedDate,
    endOfPremiumDate,
  })

  // The name should be no longer available
  newnameAvailable = await controllerContract.available(name).call()
  if (newnameAvailable) throw `Failed to register "${name}"`
}

async function auctionLegacyNameWithoutFinalise(
  web3,
  account,
  registrarContract,
  name
) {
  let labelhash = web3.utils.sha3(name)
  let value = web3.utils.toWei('10', 'ether')
  let salt = web3.utils.sha3('0x01')
  let auctionlength = 60 * 60 * 24 * 5
  let reveallength = 60 * 60 * 24 * 2
  let bidhash = await registrarContract
    .shaBid(labelhash, account, value, salt)
    .call()

  let labelState = await registrarContract.state(labelhash).call()

  await registrarContract
    .startAuction(labelhash)
    .send({ from: account, ...getGas() })

  await registrarContract
    .newBid(bidhash)
    .send({ from: account, value: value, ...getGas() })
  await registrarContract.state(labelhash).call()
  await advanceTime(web3, parseInt(auctionlength - reveallength + 100))
  await mine(web3)
  await registrarContract.state(labelhash).call()
  await registrarContract
    .unsealBid(labelhash, value, salt)
    .send({ from: account, ...getGas() })
  await advanceTime(web3, parseInt(reveallength * 2))
  await mine(web3)
}

const auctionLegacyName = async function (
  web3,
  account,
  registrarContract,
  name
) {
  await auctionLegacyNameWithoutFinalise(web3, account, registrarContract, name)
  const labelhash = web3.utils.sha3(name)
  console.log('labelhash', labelhash)
  await registrarContract.state(labelhash).call()
  await registrarContract
    .finalizeAuction(labelhash)
    .send({ from: account, ...getGas() })
}

function loadContract(modName, contractPath) {
  let loadpath
  const contractName = contractPath.split('/').reverse()[0]
  if (['ens-022', 'ethregistrar-202', 'subdomain-registrar'].includes(modName)) {
    loadpath = `${process.cwd()}/node_modules/@ensdomains/ens-archived-contracts/abis/${modName}/${contractName}.json`
  } else {
    loadpath = `${process.cwd()}/node_modules/@ensdomains/ens-contracts/artifacts/contracts/${modName}/${contractPath}.sol/${contractName}.json`
  }
  return require(loadpath)
}

async function deploy(web3, account, contractJSON, ...args) {
  const contract = new web3.eth.Contract(contractJSON.abi)
  const func = contract.deploy({
    data: contractJSON.bytecode,
    arguments: args,
  });
  const gas = await func.estimateGas({ from: account })
  return func.send({
    from: account,
    ...getGas(gas)
  })
  .on('error', function (error) {
    console.log("　　部署合约中……", error)
  }).on('transactionHash', function (transactionHash) {
    console.log("　　部署合约中……", transactionHash)
  }).on('receipt', function (receipt) {
    console.log("　　部署合约中……", receipt.contractAddress) // contains the new contract address
  }).on('confirmation', function (confirmationNumber, receipt) {
    console.log("　　部署合约中……", confirmationNumber, receipt.contractAddress) // contains the new contract address
  });
}

function loadOldContract(modName, contractName) {
  const loadpath = `${process.env.PWD}/node_modules/@ensdomains/ens-archived-contracts/abis/${modName}/${contractName}.json`
  return require(loadpath)
}

module.exports = { DAYS, mine, advanceTime, auctionLegacyName, registerName, loadContract, loadOldContract, deploy, getGas }