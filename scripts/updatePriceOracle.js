const { default: BigNumber } = require("bignumber.js");
const hre = require("hardhat");
const ethers = hre.ethers;
const config = require("../priceConfig.json");
const { loadContract } = require("./utils");

const DAYS = 86400;

async function main() {
	console.log("检查priceOracle：")
	const priceOracle = await ethers.getContractAt("WrappedPriceOracle", config.priceOracle);
	const latestAnswer = await priceOracle.functions.latestAnswer();
	const currencyPrice = latestAnswer / 1e8;
	console.log('本币USD价格：', currencyPrice);

	const secondsOfYear = 365 * DAYS;
	const currencyDecimals = 18; // 这里指定部署目标链本币的decimals。
	const usdPrice = config.priceInUSD; // 这里指定域名价格，单位为USD/年。
	console.log('域名价格（USD/s）数组：', usdPrice);

	const priceArray = [
		usdPrice[0],
		usdPrice[1],
		new BigNumber(usdPrice[2]).dividedBy(currencyPrice).dividedBy(secondsOfYear).shiftedBy(currencyDecimals).toFixed(0),
		new BigNumber(usdPrice[3]).dividedBy(currencyPrice).dividedBy(secondsOfYear).shiftedBy(currencyDecimals).toFixed(0),
		new BigNumber(usdPrice[4]).dividedBy(currencyPrice).dividedBy(secondsOfYear).shiftedBy(currencyDecimals).toFixed(0)
	];
	console.log('域名价格（ETH/s）数组：', priceArray);

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

	const contract = await ethers.getContractAt("ETHRegistrarController", config.contracts.controller);
	await contract.functions.setPriceOracle(linearPremiumPriceOracle.address);
	console.log("更新priceOracle完成");
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});