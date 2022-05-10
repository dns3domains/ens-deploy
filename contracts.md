# 关于ENS合约

## A 最简部署方案

01. 注册表：<font color="red">EnsRegistry</font>
02. 解析器：<font color="blue">PublicResolver</font>(<font color="red">EnsRegistry</font>)，需要在注册表中查询域名的所有权，因此部署解析器时需要用到注册表的地址作为参数
03. 注册中心：FIFSRegistrar(<font color="red">EnsRegistry</font>, TLD)，部署注册中心合约，并将其设置为顶级域名的所有者。
04. 反向注册中心：ReverseRegistrar(<font color="red">EnsRegistry</font>, <font color="blue">PublicResolver</font>)

### 注册与反向注册业务流：

```mermaid
graph TD;
    users(用户) -- 注册 --> fifs[FIFSRegistrar]
		fifs --".register()"-->ens[EnsRegistry]
		ens--".setSubNodeOwner()"-->end1(注册成功)

		users -. 反向注册 .-> reverse[ReverseRegistrar]
		reverse -.".setName()".->resolver[PublicResolver]
		resolver -.".setName()".->end2(反向注册成功)
```

## B 适配ens-app前端的，必须部署的合约

### B.1 第一部分 旧合约

01. 旧注册表：<font color="red">ens</font>
02. ~~旧解析器1：oldResolver(<font color="red">ens</font>)~~
03. 旧解析器2：<font color="blue">resolver</font>(<font color="red">ens</font>)：另一个解析器，意味着不同的合约版本。
04. ~~旧反向注册中心：oldReverseRegistrar(<font color="red">ens</font>, <font color="blue">resolver</font>)~~
05. 旧拍卖合约：<font color="orange">legacyAuctionRegistrar</font>：拍买相关合约，该功能可能已在前端被隐藏。但目前仍用于作为部署一步合约的参数。
06. 旧注册中心：<font color="green">oldBaseRegistrar</font>(<font color="red">ens</font>, <font color="orange">legacyAuctionRegistrar</font>, TLD)
07. 旧价格预言机：<font color="darkviolet">priceOracle</font>，价格单位是1ETH。
08. 旧控制器：<font color="chocolate">controller</font></a>(<font color="green">oldBaseRegistrar</font>, <font color="darkviolet">priceOracle</font>)
09. 旧解析器2设置接口：通过<font color="blue">resolver</font>.setInterface(interfaceID, <font color="chocolate">controller</font></a>)设置接口，用户可以更换实现ERC165的其它控制器。接口interfaceID可能包括：
    - legacyRegistrar: '0x7ba18ba1', 
    - permanentRegistrar: '0x018fac06', 
    - permanentRegistrarWithConfig: '0xca27ac4c', 
    - baseRegistrar: '0x6ccb2df4', 
    - linearPremiumPriceOracle: '0x5e75f6a9'
10. 旧子域名注册中心：oldSubdomainRegistrar(<font color="red">ens</font>)，用于兼容旧版合约。
11. 旧迁移子域名注册中心：ensMigrationSubdomainRegistrar(<font color="red">ens</font>)，用于兼容旧版合约。

### B.2 第二部分 新合约

01. 新注册表：<span style="background-color:red;color:white;">newEns</span>(<font color="red">ens</font>)，用旧注册表地址注册新注册表
02. 新注册中心：<span style="background-color:blue;color:white;">newBaseRegistrar</span>(<font color="red">ens</font>, TLD)
03. 新价格预言机，<span style="background-color:yellow;color:black;">newPriceOracle</span>，根据需求可能是`linearPremiumPriceOracle`或`exponentialPremiumPriceOracle`两种不同的合约。这两种合约部署时都需要另外一个oracle合约以实时读取本币的美元价格。
04. 新控制器：newController(<span style="background-color:blue;color:white;">newBaseRegistrar</span>, <span style="background-color:yellow;color:black;">newPriceOracle</span>);
05. 新解析器：<span style="background-color:gray;color:white;">newResolver</span>(<span style="background-color:red;color:white;">newEns</span>)
06. 新续费合约：newBulkRenewal(<span style="background-color:red;color:white;">newEns</span>)，用于下一步设置解析器接口，不会独立使用。
09. 新解析器设置接口：通过<span style="background-color:gray;color:white;">newResolver</span>.setInterface(interfaceID, <font color="chocolate">controller</font></a>)设置接口，用户可以更换实现ERC165的其它控制器。
07. 新反向注册中心：newReverseRegistrar(<span style="background-color:red;color:white;">newEns</span>, <span style="background-color:gray;color:white;">newResolver</span>)

### B.3 第三部分 Migration

registrarMigration(<font color="green">oldBaseRegistrar</font>, <span style="background-color:blue; color:white; ">newBaseRegistrar</span>, oldSubdomainRegistrar, ensMigrationSubdomainRegistrar)

### B.4 注册与反向注册业务流

注册，renewal等业务遵循类似的业务流程，即通过控制器合约进行代理。

```mermaid
graph TD;
    users(用户) -- 注册 -->tld_resolver[TLD Resolver]
		tld_resolver--".interfaceImplementer()"-->controller[newController]
		controller --".registerWithConfig()"-->base[newBaseRegistrar]
		base--".register()"-->ens[newEns]
		ens--".setResolver()"-->resolver[newResolver]
		resolver--".setAddr()"-->end1(注册成功)

		users -. 反向注册 .-> reverse[ReverseRegistrar]
		reverse -.".setName()".->resolver1[newResolver]
		resolver1 -.".setName()".->end2(反向注册成功)
```

## DNSSEC验证流程

```mermaid
graph TD;
		users(用户) --> domains[输入域名]
		domains --> registrar[取得Registrar]
		registrar --> dnsOwer[取得DNS OWNER]
		dnsOwer --> address0{是否为0x0}
		domains --> txt[请求TXT记录]
		txt --> rrsig[请求RRSIG]
		rrsig --> rrset[用RRSIG验证TXT RRSET]
		rrset --> owner[取得所有者]
		owner --> eq{比对}
		address0 -- 否 --> eq
		owner --> dnsKey[得到DNS KEY公钥]
		dnsKey --> ds[取得DS公钥哈希]
		ds --> proofs[取得proofs]
		eq -- 相同 --> submit[提交证明]
		address0 -- 是 --> submit
		proofs --> submit
		submit --> save(把Owner写入合约)
```