const { default: BigNumber } = require("bignumber.js");
const hre = require("hardhat");
const ethers = hre.ethers;
const config = require("../config.json");

const DAYS = 86400;

async function checkOraclePrice() {
	console.log("检查priceOracle：")
	const contract = await ethers.getContractAt("WrappedPriceOracle", config.priceOracle);
	const latestAnswer = await contract.functions.latestAnswer();
	const currencyPrice = latestAnswer / 1e8;
	console.log('本币USD价格：', currencyPrice);

	const secondsOfYear = 365 * DAYS;
	const currencyDecimals = config.currencyDecimals; // 这里指定部署目标链本币的decimals。
	const usdPrice = config.priceInUSD; // 这里指定域名价格，单位为USD/年。
	console.log('域名价格（USD/s）数组：', usdPrice);
	const priceArray = [
		usdPrice[0],
		usdPrice[1],
		((usdPrice[2] / currencyPrice / secondsOfYear) * (10 ** currencyDecimals)).toFixed(0),
		((usdPrice[3] / currencyPrice / secondsOfYear) * (10 ** currencyDecimals)).toFixed(0),
		((usdPrice[4] / currencyPrice / secondsOfYear) * (10 ** currencyDecimals)).toFixed(0)
	];
	console.log('域名价格（ETH/s）数组：', priceArray);
}

async function checkController() {
	console.log("检查controller：")

	let contract = await ethers.getContractAt("WrappedPriceOracle", config.priceOracle);
	const latestAnswer = await contract.functions.latestAnswer();
	const currencyPrice = latestAnswer / 1e8;
	console.log('本币USD价格：', currencyPrice);

	contract = await ethers.getContractAt("ETHRegistrarController", config.contracts.controller);
	let result = await contract.functions.owner();
	console.log("controller的owner", result);

	result = await contract.functions.rentPrice("abcde", 1);
	console.log("5个字母年费", result);
}

async function main() {
	await checkOraclePrice();
	// await checkController();
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});