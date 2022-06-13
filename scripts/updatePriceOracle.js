const { default: BigNumber } = require("bignumber.js");
const { web3 } = require("hardhat");
const hre = require("hardhat");
const { sha3 } = require("web3-utils");
const ethers = hre.ethers;
const config = require("../priceConfig.json");
const { loadContract } = require("./utils");

const DAYS = 86400;

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
	const signers = await ethers.getSigners();
	const accounts = signers.map(s => s.address);
	console.log("执行者", accounts[0]);

	const priceOracle = await ethers.getContractAt("WrappedPriceOracle", config.priceOracle);
	const latestAnswer = await priceOracle.functions.latestAnswer();
	const currencyPrice = latestAnswer / 1e8;
	console.log('本币USD价格：', currencyPrice);

	const secondsOfYear = 365 * DAYS;
	const currencyDecimals = 18; // 这里指定部署目标链本币的decimals。
	const usdPrice = config.priceInUSD; // 这里指定域名价格，单位为USD/年。
	console.log('域名价格（USD/year）数组：', usdPrice);

	const priceArray = [
		new BigNumber(usdPrice[0]).shiftedBy(currencyDecimals).dividedBy(secondsOfYear).toFixed(0),
		new BigNumber(usdPrice[1]).shiftedBy(currencyDecimals).dividedBy(secondsOfYear).toFixed(0),
		new BigNumber(usdPrice[2]).shiftedBy(currencyDecimals).dividedBy(secondsOfYear).toFixed(0),
		new BigNumber(usdPrice[3]).shiftedBy(currencyDecimals).dividedBy(secondsOfYear).toFixed(0),
		new BigNumber(usdPrice[4]).shiftedBy(currencyDecimals).dividedBy(secondsOfYear).toFixed(0)
	];
	console.log('域名价格（attoUSD/s）数组：', priceArray);

	const premium = config.premium;
	console.log('premium =', premium);

	const decreaseDuration = 28 * DAYS;
	const decreaseRate = new BigNumber(premium).dividedBy(decreaseDuration).toFixed(0);
	console.log('decreaseRate =', decreaseRate);

	const linearPremiumPriceOracleJson = loadContract('ethregistrar', 'LinearPremiumPriceOracle')
	const linearPremiumPriceOracleFactory = await ethers.getContractFactoryFromArtifact(linearPremiumPriceOracleJson);
	const linearPremiumPriceOracle = await linearPremiumPriceOracleFactory.deploy(priceOracle.address, priceArray, premium, decreaseRate);
	await linearPremiumPriceOracle.deployed();
	console.log('linearPremiumPriceOracle:', linearPremiumPriceOracle.address);

	const controllerJSON = loadContract('ethregistrar', 'ETHRegistrarController')
	const contract = await ethers.getContractAtFromArtifact(controllerJSON, config.contracts.controller);
	await contract.functions.setPriceOracle(linearPremiumPriceOracle.address);
	console.log("更新priceOracle完成");

	const resolverJSON = loadContract('resolvers', 'PublicResolver');
	const newResolver = new web3.eth.Contract(resolverJSON.abi, config.contracts.newResolver);
	await newResolver.methods.setAddr(namehash('eth-usd.data.' + config.tld), config.priceOracle).send({ from: accounts[0] });
	console.log("更新", "eth-usd.data." + config.tld, "完成");
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});