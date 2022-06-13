const hre = require("hardhat");
const ethers = hre.ethers;
const Web3 = require('web3');

async function main() {
	if (!process.env.AGGREGATOR_ADDR) {
		return;
	}

	hre.Web3 = Web3;
	hre.web3 = new Web3(hre.network.provider);

	const WrappedPriceOracle = await ethers.getContractFactory("WrappedPriceOracle");
	const wrappedPriceOracle = await WrappedPriceOracle.deploy(process.env.AGGREGATOR_ADDR);
	await wrappedPriceOracle.deployed();
	const latestAnswer = await wrappedPriceOracle.latestAnswer()
	console.log('当前本币价格', latestAnswer);
	console.log('priceOrace', wrappedPriceOracle.address);
};

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});