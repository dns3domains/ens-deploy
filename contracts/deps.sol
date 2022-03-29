//SPDX-License-Identifier: MIT
// These imports are here to force Hardhat to compile contracts we depend on in our tests but don't need anywhere else.
// import "@ensdomains/ens-contracts/contracts/registry/ENSRegistry.sol";
// import "@ensdomains/ens-contracts/contracts/registry/ENSRegistryWithFallback.sol";
// import "@ensdomains/ens-contracts/contracts/registry/FIFSRegistrar.sol";

// Registry
import "@ensdomains/ens-contracts/contracts/registry/ENS.sol";
import "@ensdomains/ens-contracts/contracts/registry/ENSRegistry.sol";
import "@ensdomains/ens-contracts/contracts/registry/ENSRegistryWithFallback.sol";
import "@ensdomains/ens-contracts/contracts/registry/ReverseRegistrar.sol";
import "@ensdomains/ens-contracts/contracts/registry/TestRegistrar.sol";
import "@ensdomains/ens-contracts/contracts/registry/FIFSRegistrar.sol";
// EthRegistrar
import "@ensdomains/ens-contracts/contracts/ethregistrar/BaseRegistrar.sol";
import "@ensdomains/ens-contracts/contracts/ethregistrar/BaseRegistrarImplementation.sol";
import "@ensdomains/ens-contracts/contracts/ethregistrar/BulkRenewal.sol";
import "@ensdomains/ens-contracts/contracts/ethregistrar/BaseRegistrar.sol";
import "@ensdomains/ens-contracts/contracts/ethregistrar/ETHRegistrarController.sol";
import "@ensdomains/ens-contracts/contracts/ethregistrar/LinearPremiumPriceOracle.sol";
import "@ensdomains/ens-contracts/contracts/ethregistrar/PriceOracle.sol";
import "@ensdomains/ens-contracts/contracts/ethregistrar/StablePriceOracle.sol";
// Resolvers
import "@ensdomains/ens-contracts/contracts/resolvers/PublicResolver.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/Resolver.sol";