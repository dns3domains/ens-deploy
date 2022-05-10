# 部署说明

## 准备工作

1. 检查`/hardhat.config.js`，补充目标链的相关配置。
2. 如果部署的同时要增加DNSSEC支持，请修改`/scripts/deployDNS.js`的`tlds`域名数组。
3. 需要确保位于`/scripts/deploy.js` `L206`的本币priceOracle（合约名`wrappedPriceOracle`）是实现了`Chainlink`和`AggregatorInterface`接口的合约。
4. 需要确保位于`/scripts/deploy.js` `L211`的域名定价数组ps内数组是正确的。

## 部署主合约

```shell
hardhat run --network [network in hardhat.config.js] scripts/deploy.js &&
hardhat run --network [network in hardhat.config.js] scripts/deployDNS.js
```

**注意：请注意保存所有的输出信息。**
