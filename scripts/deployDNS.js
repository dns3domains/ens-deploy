const hre = require("hardhat");
const ethers = hre.ethers;
const Web3 = require('web3');
const deployDNSSEC = require("./deployDNSSEC");
const { loadContract } = require("./utils");
const config = require("../dnsConfig.json");

const dnssec = true;

async function main() {
	hre.Web3 = Web3;
	hre.web3 = new Web3(hre.network.provider);
	const web3 = hre.web3;

	const signers = await ethers.getSigners();
	const accounts = signers.map(s => s.address);

	const resolverJSON = loadContract('resolvers', 'PublicResolver')
	const ENSWithFallbackJSON = loadContract('registry', 'ENSRegistryWithFallback')

	const newEns = new web3.eth.Contract(ENSWithFallbackJSON.abi, config.newEns);
	const newResolver = new web3.eth.Contract(resolverJSON.abi, config.newResolver);

	const tlds = config.tlds;
	if (dnssec) {
		await deployDNSSEC(web3, accounts, newEns, newResolver, tlds)
	}
};

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});