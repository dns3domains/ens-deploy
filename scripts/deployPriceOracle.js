const { namehash } = require("ethers/lib/utils");
const hre = require("hardhat");
const ethers = hre.ethers;
const Web3 = require('web3');
const deployDNSSEC = require("./deployDNSSEC");
const { loadContract } = require("./utils");

const dnssec = true;
const tld = "ela";

async function main() {
	hre.Web3 = Web3;
	hre.web3 = new Web3(hre.network.provider);
	const web3 = hre.web3;
	// console.log(await web3.eth.getBlock("latest"));

	const signers = await ethers.getSigners();
	const accounts = signers.map(s => s.address);
	console.log("accounts:", accounts);

	const tldHash = namehash("ela");
	const tldSha = web3.utils.sha3("ela");

	const resolverJSON = loadContract('resolvers', 'PublicResolver')
	const ENSWithFallbackJSON = loadContract('registry', 'ENSRegistryWithFallback')
	const DnsRegistrarNew = loadContract('dnsregistrar', 'DNSRegistrar')
	const dummyOracleJSON = loadContract('ethregistrar', 'DummyOracle')
	const controllerJSON = loadContract('ethregistrar', 'ETHRegistrarController')
	const linearPremiumPriceOracleJSON = loadContract('ethregistrar', 'LinearPremiumPriceOracle')
	const newBaseRegistrarJSON = loadContract('ethregistrar', 'BaseRegistrarImplementation')
	const WrappedPriceOracle = await ethers.getContractFactory("WrappedPriceOracle");

	const wrappedPriceOracle = await WrappedPriceOracle.deploy("0xe848389b35Ca2E9A06faa50b6644C26A871BdD12");
	await wrappedPriceOracle.deployed();
	const latestAnswer = await wrappedPriceOracle.latestAnswer()
	console.log('USD Rate', latestAnswer, wrappedPriceOracle.address);

	const DAYS = 24 * 60 * 60;
	const ps = [
		0,
		0,
		((640 / (latestAnswer / 1e8) / 365 / DAYS) * 1e18).toFixed(0),
		((160 / (latestAnswer / 1e8) / 365 / DAYS) * 1e18).toFixed(0),
		((5 / (latestAnswer / 1e8) / 365 / DAYS) * 1e18).toFixed(0)
	];
	console.log('ps', ps);

	const premium = web3.utils.toBN('1000000000000000000') // 1e18
	const decreaseDuration = web3.utils.toBN(28 * DAYS)
	const decreaseRate = premium.div(decreaseDuration)
	const linearPremiumPriceOracleContract = new web3.eth.Contract(linearPremiumPriceOracleJSON.abi);
	const linearPremiumPriceOracle = await linearPremiumPriceOracleContract.deploy({
		data: linearPremiumPriceOracleJSON.bytecode,
		arguments: [wrappedPriceOracle.address, ps, premium, decreaseRate]
	}).send({ from: accounts[0] });
	console.log("linearPremiumPriceOracle:", linearPremiumPriceOracle._address);
};

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});