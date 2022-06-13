# 部署说明

## A 部署主合约

### 准备工作：

1. 检查`/hardhat.config.js`，补充目标链的相关配置。
2. 修改`/config.json`中的必要配置，如果目标链上没有可用的（实现了`AggregatorInterface`的）priceOracle的话，以下《`D 部署priceOracle`》提供了部署一个封装较通用的`AggregatorInterfaceV3`合约的方法。

### 然后执行：

```shell
npm run deploy --network=[network in hardhat.config.js]
```

## B 部署DNSSEC支持

### 准备工作：

在 `./dnsConfig.json` 中更改目标网络的域名相关配置。

### 然后执行：

```shell
npm run deploy-dnssec --network=[network in hardhat.config.js]
```

**注意：请注意保存所有的输出信息。**

## C 更新价格设置

### 准备工作

在 `./priceConfig.json` 中更改目标网络的域名价格相关配置。

### 然后执行：

```shell
npm run update-price --network=[network in hardhat.config.js]
```

## D 部署priceOracle

```shell
npm run deploy-aggregator --network=[network in hardhat.config.js] --addr=[AggregatorInterfaceV3]
```
