const { ethers, BigNumber } = require("ethers");
const { ChainId } = require("@sushiswap/chain");
const { Token } = require("@sushiswap/currency");
const { erc20Abi, interpreterAbi } = require("./abis");
const { createPublicClient, http, fallback } = require("viem");
const { config: viemConfig } = require("@sushiswap/viem-config");
const { DataFetcher, Router, LiquidityProviders } = require("@sushiswap/router");


/**
 * Fallback transports for viem client
 */
const fallbackTransports = {
    [ChainId.ARBITRUM_NOVA]: {
        transport: http("https://nova.arbitrum.io/rpc"),
    },
    [ChainId.ARBITRUM]: {
        transport: fallback(
            [
                http("https://lb.drpc.org/ogrpc?network=arbitrum&dkey=Ak765fp4zUm6uVwKu4annC8M80dnCZkR7pAEsm6XXi_w"),
                http("https://rpc.ankr.com/arbitrum"),
                http("https://arbitrum-one.public.blastapi.io"),
                http("https://endpoints.omniatech.io/v1/arbitrum/one/public"),
                http("https://arb1.croswap.com/rpc"),
                http("https://1rpc.io/arb"),
                http("https://arbitrum.blockpi.network/v1/rpc/public"),
                http("https://arb-mainnet-public.unifra.io"),
            ],
            { rank: true }
        ),
    },
    [ChainId.AVALANCHE]: {
        transport: fallback([
            http("https://api.avax.network/ext/bc/C/rpc"),
            http("https://rpc.ankr.com/avalanche")
        ]),
    },
    [ChainId.BOBA]: {
        transport: fallback([
            http("https://mainnet.boba.network"),
            http("https://lightning-replica.boba.network")
        ]),
    },
    [ChainId.BOBA_AVAX]: {
        transport: fallback([
            http("https://avax.boba.network"),
            http("https://replica.avax.boba.network")
        ]),
    },
    [ChainId.BOBA_BNB]: {
        transport: fallback([
            http("https://bnb.boba.network"),
            http("https://replica.bnb.boba.network")
        ]),
    },
    [ChainId.BSC]: {
        transport: fallback([
            http("https://rpc.ankr.com/bsc"),
            http("https://lb.drpc.org/ogrpc?network=bsc&dkey=Ak765fp4zUm6uVwKu4annC8M80dnCZkR7pAEsm6XXi_w"),
            http("https://bsc-dataseed.binance.org"),
            http("https://bsc-dataseed1.binance.org"),
            http("https://bsc-dataseed2.binance.org"),
        ]),
    },
    [ChainId.BTTC]: {
        transport: http("https://rpc.bittorrentchain.io"),
    },
    [ChainId.CELO]: {
        transport: http("https://forno.celo.org")
    },
    [ChainId.ETHEREUM]: {
        transport: fallback(
            [
                http("https://lb.drpc.org/ogrpc?network=ethereum&dkey=Ak765fp4zUm6uVwKu4annC8M80dnCZkR7pAEsm6XXi_w"),
                http("https://eth.llamarpc.com"),
                // http('https://eth.rpc.blxrbdn.com'),
                // http('https://virginia.rpc.blxrbdn.com'),
                // http('https://singapore.rpc.blxrbdn.com'),
                // http('https://uk.rpc.blxrbdn.com'),
                http("https://1rpc.io/eth"),
                http("https://ethereum.publicnode.com"),
                http("https://cloudflare-eth.com"),
            ],
            { rank: true }
        ),
    },
    [ChainId.FANTOM]: {
        transport: fallback([
            http("https://rpc.ankr.com/fantom"),
            http("https://rpc.fantom.network"),
            http("https://rpc2.fantom.network"),
        ]),
    },
    [ChainId.FUSE]: {
        transport: http("https://rpc.fuse.io"),
    },
    [ChainId.GNOSIS]: {
        transport: http("https://rpc.ankr.com/gnosis"),
    },
    [ChainId.HARMONY]: {
        transport: fallback([
            http("https://api.harmony.one"),
            http("https://rpc.ankr.com/harmony")
        ]),
    },
    [ChainId.KAVA]: {
        transport: fallback([
            http("https://evm.kava.io"),
            http("https://evm2.kava.io")
        ]),
    },
    [ChainId.MOONBEAM]: {
        transport: fallback([
            http("https://rpc.api.moonbeam.network"),
            http("https://rpc.ankr.com/moonbeam")
        ]),
    },
    [ChainId.MOONRIVER]: {
        transport: http("https://rpc.api.moonriver.moonbeam.network"),
    },
    [ChainId.OPTIMISM]: {
        transport: fallback(
            [
                http("https://lb.drpc.org/ogrpc?network=optimism&dkey=Ak765fp4zUm6uVwKu4annC8M80dnCZkR7pAEsm6XXi_w"),
                http("https://rpc.ankr.com/optimism"),
                http("https://optimism-mainnet.public.blastapi.io"),
                http("https://1rpc.io/op"),
                http("https://optimism.blockpi.network/v1/rpc/public"),
                http("https://mainnet.optimism.io"),
            ],
            { rank: true }
        ),
    },
    [ChainId.POLYGON]: {
        transport: fallback(
            [
                http("https://polygon.llamarpc.com"),
                // http('https://polygon.rpc.blxrbdn.com'),
                http("https://polygon-mainnet.public.blastapi.io"),
                http("https://polygon.blockpi.network/v1/rpc/public"),
                http("https://polygon-rpc.com"),
                http("https://rpc.ankr.com/polygon"),
                http("https://matic-mainnet.chainstacklabs.com"),
                http("https://polygon-bor.publicnode.com"),
                http("https://rpc-mainnet.matic.quiknode.pro"),
                http("https://rpc-mainnet.maticvigil.com"),
                // ...polygon.rpcUrls.default.http.map((url) => http(url)),
            ],
            { rank: true }
        ),
    },
    [ChainId.POLYGON_ZKEVM]: {
        transport: fallback(
            [
                http("https://zkevm-rpc.com"),
                http("https://rpc.ankr.com/polygon_zkevm"),
                http("https://rpc.polygon-zkevm.gateway.fm"),
            ],
            { rank: true }
        ),
    },
    [ChainId.THUNDERCORE]: {
        transport: fallback(
            [
                http("https://mainnet-rpc.thundercore.com"),
                http("https://mainnet-rpc.thundercore.io"),
                http("https://mainnet-rpc.thundertoken.net"),
            ],
            { rank: true }
        ),
    },
};

/**
 * convert float numbers to big number
 *
 * @param {any} float - Any form of number
 * @param {number} decimals - Decimals point of the number
 * @returns ethers BigNumber with decimals point
 */
const bnFromFloat = (float, decimals = 18) => {
    if (typeof float == "string") {
        if (float.startsWith("0x")) {
            const num = BigInt(float).toString();
            return BigNumber.from(num.padEnd(num.length + decimals), "0");
        }
        else {
            if (float.includes(".")) {
                const offset = decimals - float.slice(float.indexOf(".") + 1).length;
                float = offset < 0 ? float.slice(0, offset) : float;
            }
            return ethers.utils.parseUnits(float, decimals);
        }
    }
    else {
        try {
            float = float.toString();
            return bnFromFloat(float, decimals);
        }
        catch {
            return undefined;
        }

    }
};

/**
 * Convert a BigNumber to a fixed 18 point BigNumber
 *
 * @param {BigNumber} bn - The BigNumber to convert
 * @param {number} decimals - The decimals point of the given BigNumber
 * @returns A 18 fixed point BigNumber
 */
const toFixed18 = (bn, decimals) => {
    const num = bn.toBigInt().toString();
    return BigNumber.from(
        num + "0".repeat(18 - decimals)
    );
};

/**
 * Convert a 18 fixed point BigNumber to a  BigNumber with some other decimals point
 *
 * @param {BigNumber} bn - The BigNumber to convert
 * @param {number} decimals - The decimals point of convert the given BigNumber
 * @returns A decimals point BigNumber
 */
const fromFixed18 = (bn, decimals) => {
    if (decimals != 18) {
        const num = bn.toBigInt().toString();
        return BigNumber.from(
            num.slice(0, decimals - 18)
        );
    }
    else return bn;
};

/**
 * Calls eval for a specific order to get its max output and ratio
 *
 * @param {ethers.Contract} interpreter - The interpreter ethersjs contract instance
 * @param {string} arbAddress - Arb contract address
 * @param {string} obAddress - OrderBook contract address
 * @param {object} order - The order details fetched from sg
 * @param {number} inputIndex - The input token index
 * @param {number} outputIndex - The ouput token index
 * @returns The ratio and maxOuput as BigNumber
*/
const interpreterEval = async(
    interpreter,
    arbAddress,
    obAddress,
    order,
    inputIndex,
    outputIndex,
    inputBalance,
    outputBalance
) => {
    try {
        const { stack: [ maxOutput, ratio ] } = await interpreter.eval(
            order.interpreterStore,
            order.owner.id,
            order.expression + "00000002",
            // construct the context for eval
            [
                [
                    // base column
                    arbAddress,
                    obAddress
                ],
                [
                    // calling context column
                    order.id,
                    order.owner.id,
                    arbAddress
                ],
                [
                    // calculateIO context column
                ],
                [
                    // input context column
                    order.validInputs[inputIndex].token.id,
                    order.validInputs[inputIndex].token.decimals,
                    order.validInputs[inputIndex].vault.id.split("-")[0],
                    inputBalance,
                    "0"
                ],
                [
                    // output context column
                    order.validOutputs[outputIndex].token.id,
                    order.validOutputs[outputIndex].token.decimals,
                    order.validOutputs[outputIndex].vault.id.split("-")[0],
                    outputBalance,
                    "0"
                ],
                [
                    // empty context column
                ],
                [
                    // signed context column
                ]
            ]
        );
        return { ratio, maxOutput };
    }
    catch {
        return {
            ratio: undefined,
            maxOutput: undefined
        };
    }
};

/**
 * Constructs Order struct from the result of sg default query
 *
 * @param {object} orderDetails - The order details fetched from sg
 * @returns The order struct as js object
 */
const getOrderStruct = (orderDetails) => {
    return {
        owner: orderDetails.owner.id,
        handleIO: orderDetails.handleIO,
        evaluable: {
            interpreter: orderDetails.interpreter,
            store: orderDetails.interpreterStore,
            expression: orderDetails.expression
        },
        validInputs: orderDetails.validInputs.map(v => {
            return {
                token: v.token.id,
                decimals: Number(v.token.decimals),
                vaultId: v.vault.id.split("-")[0]
            };
        }),
        validOutputs: orderDetails.validOutputs.map(v => {
            return {
                token: v.token.id,
                decimals: Number(v.token.decimals),
                vaultId: v.vault.id.split("-")[0]
            };
        })
    };
};

/**
 * Waits for provided miliseconds
 * @param {number} ms - Miliseconds to wait
 */
const sleep = async(ms) => {
    let _timeoutReference;
    return new Promise(
        resolve => _timeoutReference = setTimeout(resolve, ms)
    ).finally(
        () => clearTimeout(_timeoutReference)
    );
};

/**
 * Extracts the income (received token value) from transaction receipt
 *
 * @param {ethers.Wallet} signer - The ethers wallet instance of the bot
 * @param {any} receipt - The transaction receipt
 * @returns The income value or undefined if cannot find any valid value
 */
const getIncome = (signer, receipt) => {
    const erc20Interface = new ethers.utils.Interface(erc20Abi);
    return receipt.events.filter(
        v => v.topics[2] && ethers.BigNumber.from(v.topics[2]).eq(signer.address)
    ).map(v => {
        try{
            return erc20Interface.decodeEventLog("Transfer", v.data, v.topics);
        }
        catch {
            return undefined;
        }
    })[0]?.value;
};

/**
 * Calculates the actual clear price from transactioin event
 *
 * @param {any} receipt - The transaction receipt
 * @param {string} orderbook - The Orderbook contract address
 * @param {string} arb - The Arb contract address
 * @param {string} amount - The clear amount
 * @param {number} buyDecimals - The buy token decimals
 * @returns The actual clear price or undefined if necessary info not found in transaction events
 */
const getActualPrice = (receipt, orderbook, arb, amount, buyDecimals) => {
    const erc20Interface = new ethers.utils.Interface(erc20Abi);
    const eventObj = receipt.events.map(v => {
        try{
            return erc20Interface.decodeEventLog("Transfer", v.data, v.topics);
        }
        catch {
            return undefined;
        }
    }).filter(v => v &&
        !ethers.BigNumber.from(v.from).eq(orderbook) &&
        ethers.BigNumber.from(v.to).eq(arb)
    );
    if (eventObj[0] && eventObj[0]?.value) return ethers.utils.formatUnits(
        eventObj[0].value
            .mul("1" + "0".repeat(36 - buyDecimals))
            .div(amount)
    );
    else return undefined;
};

/**
 * Estimates the profit for a single bundled orders struct
 *
 * @param {string} pairPrice - The price token pair
 * @param {string} ethPrice - Price of ETH to buy token
 * @param {object} bundledOrder - The bundled order object
 * @param {ethers.BigNumber} gas - The estimated gas cost in ETH
 * @param {string} gasCoveragePercentage - Percentage of gas to cover, default is 100,i.e. full gas coverage
 * @returns The estimated profit
 */
const estimateProfit = (pairPrice, ethPrice, bundledOrder, gas, gasCoveragePercentage = "100") => {
    let income = ethers.constants.Zero;
    const price = ethers.utils.parseUnits(pairPrice);
    const gasCost = ethers.utils.parseEther(ethPrice)
        .mul(gas)
        .div(ethers.utils.parseUnits("1"))
        .mul(gasCoveragePercentage)
        .div("100");
    for (const takeOrder of bundledOrder.takeOrders) {
        income = price
            .sub(takeOrder.ratio)
            .mul(takeOrder.quoteAmount)
            .div(ethers.utils.parseUnits("1"))
            .add(income);
    }
    return income.sub(gasCost);
};

/**
 * Builds and bundles orders which their details are queried from a orderbook subgraph by checking the vault balances and evaling
 *
 * @param {any[]} ordersDetails - Orders details queried from subgraph
 * @param {ethers.Contract} orderbook - The Orderbook EthersJS contract instance with signer
 * @param {ethers.Contract} arb - The Arb EthersJS contract instance with signer
 * @returns Array of bundled take orders
 */
const bundleTakeOrders = async(ordersDetails, orderbook, arb) => {
    const bundledOrders = [];
    const obAsSigner = new ethers.VoidSigner(
        orderbook.address,
        orderbook.signer.provider
    );

    for (let i = 0; i < ordersDetails.length; i++) {
        const order = ordersDetails[i];
        for (let j = 0; j < order.validOutputs.length; j++) {
            const _output = order.validOutputs[j];
            const _outputBalance = await orderbook.vaultBalance(
                order.owner.id,
                _output.token.id,
                _output.vault.id.split("-")[0]
            );
            const _outputBalanceFixed = ethers.utils.parseUnits(
                ethers.utils.formatUnits(
                    _outputBalance,
                    _output.token.decimals
                )
            );
            // const _outputBalance = ethers.utils.parseUnits(
            //     ethers.utils.formatUnits(
            //         _output.tokenVault.balance,
            //         _output.token.decimals
            //     )
            // );
            if (!_outputBalanceFixed.isZero()) {
                for (let k = 0; k < order.validInputs.length; k ++) {
                    if (_output.token.id !== order.validInputs[k].token.id) {
                        const _input = order.validInputs[k];
                        const _inputBalance = await orderbook.vaultBalance(
                            order.owner.id,
                            _input.token.id,
                            _input.vault.id.split("-")[0]
                        );
                        const { maxOutput, ratio } = await interpreterEval(
                            new ethers.Contract(
                                order.interpreter,
                                interpreterAbi,
                                obAsSigner
                            ),
                            arb.address,
                            orderbook.address,
                            order,
                            k,
                            j ,
                            _inputBalance.toString() ,
                            _outputBalance.toString()
                        );

                        if (maxOutput && ratio) {
                            const quoteAmount = _outputBalanceFixed.lte(maxOutput)
                                ? _outputBalanceFixed
                                : maxOutput;

                            if (!quoteAmount.isZero()) {
                                const pair = bundledOrders.find(v =>
                                    v.sellToken === _output.token.id &&
                                    v.buyToken === _input.token.id
                                );
                                if (pair) pair.takeOrders.push({
                                    id: order.id,
                                    ratio,
                                    quoteAmount,
                                    takeOrder: {
                                        order: getOrderStruct(order),
                                        inputIOIndex: k,
                                        outputIOIndex: j,
                                        signedContext: []
                                    }
                                });
                                else bundledOrders.push({
                                    buyToken: _input.token.id,
                                    buyTokenSymbol: _input.token.symbol,
                                    buyTokenDecimals: _input.token.decimals,
                                    sellToken: _output.token.id,
                                    sellTokenSymbol: _output.token.symbol,
                                    sellTokenDecimals: _output.token.decimals,
                                    takeOrders: [{
                                        id: order.id,
                                        ratio,
                                        quoteAmount,
                                        takeOrder: {
                                            order: getOrderStruct(order),
                                            inputIOIndex: k,
                                            outputIOIndex: j,
                                            signedContext: []
                                        }
                                    }]
                                });
                            }
                        }
                    }
                }
            }
        }
    }
    return bundledOrders;
};

/**
 * Instantiates a DataFetcher
 *
 * @param {any} config - The network config data
 * @param {LiquidityProviders[]} liquidityProviders - Array of Liquidity Providers
 */
const getDataFetcher = (config, liquidityProviders = []) => {
    try {
        const dataFetcher = new DataFetcher(
            config.chainId,
            createPublicClient({
                chain: viemConfig[config.chainId]?.chain,
                transport: config.rpc && config.rpc !== "test"
                    ? http(config.rpc)
                    : fallbackTransports[config.chainId].transport,
                // batch: {
                //     multicall: {
                //         batchSize: 512
                //     },
                // },
                // pollingInterval: 8_000,
            })
        );
        dataFetcher.startDataFetching(
            !liquidityProviders.length ? undefined : liquidityProviders
        );
        return dataFetcher;
    }
    catch(error) {
        throw "cannot instantiate DataFetcher for this network";
    }
};

/**
 * Gets ETH price against a target token
 *
 * @param {any} config - The network config data
 * @param {string} targetTokenAddress - The target token address
 * @param {number} targetTokenDecimals - The target token decimals
 * @param {BigNumber} gasPrice - The network gas price
 * @param {DataFetcher} dataFetcher - (optional) The DataFetcher instance
 */
const getEthPrice = async(
    config,
    targetTokenAddress,
    targetTokenDecimals,
    gasPrice,
    dataFetcher = undefined
) => {
    const amountIn = BigNumber.from(
        "1" + "0".repeat(config.nativeWrappedToken.decimals)
    );
    const fromToken = new Token({
        chainId: config.chainId,
        decimals: config.nativeWrappedToken.decimals,
        address: config.nativeWrappedToken.address,
        symbol: config.nativeWrappedToken.symbol
    });
    const toToken = new Token({
        chainId: config.chainId,
        decimals: targetTokenDecimals,
        address: targetTokenAddress
    });
    if (!dataFetcher) dataFetcher = getDataFetcher(config);
    await fetchPoolsForTokenWrapper(dataFetcher, fromToken, toToken);
    const pcMap = dataFetcher.getCurrentPoolCodeMap(fromToken, toToken);
    const route = Router.findBestRoute(
        pcMap,
        config.chainId,
        fromToken,
        amountIn,
        toToken,
        gasPrice.toNumber()
        // 30e9,
        // providers,
        // poolFilter
    );
    if (route.status == "NoWay") return undefined;
    else return ethers.utils.formatUnits(route.amountOutBN, targetTokenDecimals);
};

/**
 * A wrapper for DataFetcher fetchPoolsForToken() to avoid any errors for liquidity providers that are not available for target chain
 *
 * @param {DataFetcher} dataFetcher - DataFetcher instance
 * @param {Token} fromToken - The from token
 * @param {Token} toToken - The to token
 * @param {string[]} excludePools - Set of pools to exclude
 */
const fetchPoolsForTokenWrapper = async(dataFetcher, fromToken, toToken, excludePools) => {
    // ensure that we only fetch the native wrap pools if the
    // token is the native currency and wrapped native currency
    if (fromToken.wrapped.equals(toToken.wrapped)) {
        const provider = dataFetcher.providers.find(
            (p) => p.getType() === LiquidityProviders.NativeWrap
        );
        if (provider) {
            try {
                await provider.fetchPoolsForToken(
                    fromToken.wrapped,
                    toToken.wrapped,
                    excludePools
                );
            }
            catch {}
        }
    }
    else {
        const [token0, token1] =
            fromToken.wrapped.equals(toToken.wrapped) ||
            fromToken.wrapped.sortsBefore(toToken.wrapped)
                ? [fromToken.wrapped, toToken.wrapped]
                : [toToken.wrapped, fromToken.wrapped];
        await Promise.allSettled(
            dataFetcher.providers.map((p) => {
                try {
                    return p.fetchPoolsForToken(token0, token1, excludePools);
                }
                catch {
                    return;
                }
            })
        );
    }
};

/**
 * Resolves an array of case-insensitive names to LiquidityProviders, ignores the ones that are not valid
 *
 * @param {string[]} liquidityProviders - List of liquidity providers
 */
const processLps = (liquidityProviders) => {
    if (
        !liquidityProviders ||
        !Array.isArray(liquidityProviders) ||
        !liquidityProviders.length ||
        !liquidityProviders.every(v => typeof v === "string")
    ) return undefined;
    const _lps = [];
    const LP = Object.values(LiquidityProviders);
    for (let i = 0; i < liquidityProviders.length; i++) {
        const index = LP.findIndex(v => v.toLowerCase() === liquidityProviders[i].toLowerCase());
        if (index > -1 && !_lps.includes(LP[index])) _lps.push(LP[index]);
    }
    return _lps.length ? _lps : undefined;
};

/**
 * Validates content of an array of orders
 *
 * @param {any[]} orders - Array of order struct
 */
const validateOrders = (orders) => {
    const addressPattern = /^0x[a-fA-F0-9]{40}$/;
    const vaultIdPattern = /^0x[a-fA-F0-9]{64}$/;
    return Array.isArray(orders)
        && orders.every(v => typeof v.owner === "string"
            && addressPattern.test(v.owner)
            && typeof v.handleIO === "boolean"
            && v.evaluable !== null
            && typeof v.evaluable === "object"
            && typeof v.evaluable.interpreter === "string"
            && addressPattern.test(v.evaluable.interpreter)
            && typeof v.evaluable.store === "string"
            && addressPattern.test(v.evaluable.store)
            && typeof v.evaluable.expression === "string"
            && addressPattern.test(v.evaluable.expression)
            && Array.isArray(v.validInputs)
            && v.validInputs.length > 0
            && Array.isArray(v.validOutputs)
            && v.validOutputs.length > 0
            && v.validInputs.every(e =>
                typeof e.token === "string"
                && addressPattern.test(e.token)
                && typeof e.decimals === "number"
                && e.decimals > 0
                && typeof e.vaultId === "string"
                && vaultIdPattern.test(e.vaultId)
            )
            && v.validOutputs.every(e =>
                typeof e.token === "string"
                && addressPattern.test(e.token)
                && typeof e.decimals === "number"
                && e.decimals > 0
                && typeof e.vaultId === "string"
                && vaultIdPattern.test(e.vaultId)
            )
        );
};

/**
 * Get the order hash from an order struct
 *
 * @param {any} order - The order struct
 * @returns The order hash
 */
const getOrderHash = (order) => {
    return ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            [
                "tuple("
                    + "address,"
                    + "bool,"
                    + "tuple(address,address,address),"
                    + "tuple[](address,uint8,uint256),"
                    + "tuple[](address,uint8,uint256)" +
                ")"
            ],
            [[
                order.owner,
                order.handleIO,
                [
                    order.evaluable.interpreter,
                    order.evaluable.store,
                    order.evaluable.expression
                ],
                order.validInputs.map(v => [
                    v.token,
                    v.decimals,
                    v.vaultId
                ]),
                order.validOutputs.map(v => [
                    v.token,
                    v.decimals,
                    v.vaultId
                ])
            ]]
        )
    );
};

/**
 * Get order details from an array of order struct
 *
 * @param {string} jsonContent - Content of a JSON file containing orders struct
 */
const getOrderDetailsFromJson = async(jsonContent, signer) => {
    const orders = JSON.parse(jsonContent);
    if (!validateOrders(orders)) throw "invalid orders format";
    const orderDetails = [];
    for (let i = 0; i < orders.length; i++) {
        const _inputSymbols = [];
        const _outputSymbols = [];
        for (let j = 0; j < orders[i].validInputs.length; j++) {
            const erc20 = new ethers.Contract(orders[i].validInputs[j].token, erc20Abi, signer);
            const symbol = await erc20.symbol();
            _inputSymbols.push(symbol);
        }
        for (let j = 0; j < orders[i].validOutputs.length; j++) {
            const erc20 = new ethers.Contract(orders[i].validOutputs[j].token, erc20Abi, signer);
            const symbol = await erc20.symbol();
            _outputSymbols.push(symbol);
        }
        orderDetails.push({
            id: getOrderHash(orders[i]).toLowerCase(),
            handleIO: orders[i].handleIO,
            expression: orders[i].evaluable.expression.toLowerCase(),
            interpreter: orders[i].evaluable.interpreter.toLowerCase(),
            interpreterStore: orders[i].evaluable.store.toLowerCase(),
            owner: {
                id: orders[i].owner.toLowerCase()
            },
            validInputs: orders[i].validInputs.map((v, i) => {
                const _input = {
                    index: i,
                    token: {
                        id: v.token.toLowerCase(),
                        decimals: v.decimals,
                        symbol: _inputSymbols[i]
                    },
                    vault: {
                        id: v.vaultId.toLowerCase() + "-" + orders[i].owner.toLowerCase()
                    }
                };
                return _input;
            }),
            validOutputs: orders[i].validOutputs.map((v, i) => {
                const _output = {
                    index: i,
                    token: {
                        id: v.token.toLowerCase(),
                        decimals: v.decimals,
                        symbol: _outputSymbols[i]
                    },
                    vault: {
                        id: v.vaultId.toLowerCase() + "-" + orders[i].owner.toLowerCase()
                    }
                };
                return _output;
            })
        });
    }
    return orderDetails;
};

/**
 * Method to shorten data fields of items that are logged and optionally hide sensitive data
 *
 * @param {boolean} scurb - Option to scrub sensitive data
 * @param {...any[]} data - The optinnal data to hide
 */
const appGlobalLogger = (scurb, ...data) => {
    const largeDataPattern = /0x[a-fA-F0-9]{128,}/g;
    const consoleMethods = ["log", "warn", "error", "info", "debug"];

    // Stringifies an object
    const objStringify = (obj) => {
        const keys = Object.getOwnPropertyNames(obj);
        for (let i = 0; i < keys.length; i++) {
            if (
                typeof obj[keys[i]] === "bigint"
                || typeof obj[keys[i]] === "number"
                || typeof obj[keys[i]] === "symbol"
            ) obj[keys[i]] = obj[keys[i]].toString();
            else if (typeof obj[keys[i]] === "object" && obj[keys[i]] !== null) {
                obj[keys[i]] = objStringify(obj[keys[i]]);
            }
        }
        return obj;
    };

    // Replaces a search value with replace value in an object's properties string content
    const objStrReplacer = (logObj, searchee, replacer) => {
        const objKeys = Object.getOwnPropertyNames(logObj);
        for (let i = 0; i < objKeys.length; i++) {
            if (typeof logObj[objKeys[i]] === "string" && logObj[objKeys[i]]) {
                if (typeof searchee === "string") {
                    while (logObj[objKeys[i]].includes(searchee)) {
                        logObj[objKeys[i]] = logObj[objKeys[i]].replace(searchee, replacer);
                    }
                }
                else logObj[objKeys[i]] = logObj[objKeys[i]].replace(searchee, replacer);
            }
            else if (typeof logObj[objKeys[i]] === "object" && logObj[objKeys[i]] !== null) {
                logObj[objKeys[i]] = objStrReplacer(logObj[objKeys[i]], searchee, replacer);
            }
        }
        return logObj;
    };

    // filtering unscrubable data
    const _data = data.filter(
        v => v !== undefined && v !== null && !isNaN(v)
    ).map(
        v => {
            try {
                const str = v.toString();
                if (str) return str;
                else return undefined;
            }
            catch { return undefined; }
        }
    ).filter(
        v => v !== undefined
    );

    // intercepting the console with custom function to scrub and shorten loggings
    consoleMethods.forEach(methodName => {
        const orgConsole = console[methodName];
        console[methodName] = function (...params) {
            const modifiedParams = [];
            for (let i = 0; i < params.length; i++) {
                let logItem = params[i];
                if (
                    typeof logItem === "number" ||
                    typeof logItem === "bigint" ||
                    typeof logItem === "symbol"
                ) logItem = logItem.toString();

                if (typeof logItem === "string" && logItem) {
                    if (scurb) for (let j = 0; j < _data.length; j++) {
                        while (logItem.includes(_data[i])) logItem = logItem.replace(
                            _data[i],
                            "**********"
                        );
                    }
                    logItem = logItem.replace(
                        largeDataPattern,
                        largeData => largeData.slice(0, 67) + "..."
                    );
                }
                else if (typeof logItem === "object" && logItem !== null) {
                    logItem = objStringify(logItem);
                    if (scurb) for (let j = 0; j < _data.length; j++) {
                        logItem = objStrReplacer(logItem, _data[j], "**********");
                    }
                    logItem = objStrReplacer(
                        logItem,
                        largeDataPattern,
                        largeData => largeData.slice(0, 67) + "..."
                    );
                }
                modifiedParams.push(logItem);
            }
            orgConsole.apply(console, modifiedParams);
        };
    });
};

/**
 * Method to put a timeout on a promise, throws the exception if promise is not settled within the time
 *
 * @param {Promise} promise - The Promise to put timeout on
 * @param {number} time - The time in milliseconds
 * @param {string | number | bigint | symbol | boolean} exception - The exception value to reject with if the
 * promise is not settled within time
 * @returns A new promise that gets settled with initial promise settlement or rejected with exception value
 * if the time runs out before the main promise settlement
 */
const promiseTimeout = async(promise, time, exception) => {
    let timer;
    return Promise.race([
        promise,
        new Promise(
            (_res, _rej) => timer = setTimeout(_rej, time, exception)
        )
    ]).finally(
        () => clearTimeout(timer)
    );
};

module.exports = {
    fallbackTransports,
    bnFromFloat,
    toFixed18,
    fromFixed18,
    interpreterEval,
    getOrderStruct,
    sleep,
    getIncome,
    getActualPrice,
    estimateProfit,
    bundleTakeOrders,
    getDataFetcher,
    getEthPrice,
    fetchPoolsForTokenWrapper,
    processLps,
    validateOrders,
    getOrderHash,
    getOrderDetailsFromJson,
    appGlobalLogger,
    promiseTimeout
};