const fs = require("fs");
const path = require("path");
const axios = require("axios");
const ethers = require("ethers");
const CONFIG = require("../config.json");
const { DefaultQuery } = require("./query");
let { abi: interpreterAbi } = require("./abis/IInterpreterV1.json");
let { abi: arbAbi } = require("./abis/ZeroExOrderBookFlashBorrower.json");
const { interpreterEval, getOrderStruct, ETHERSCAN_TX_PAGE } = require("./utils");


/**
 * Builds initial 0x requests bodies from token addresses that is required
 * for getting token prices with least amount of hits possible and that is
 * to pair up tokens in a way that each show up only once in a request body
 * so that the number of requests will be: "number-of-tokens / 2" at best or
 * "(number-of-tokens / 2) + 1" at worst if the number of tokens is an odd digit.
 * This way the responses will include the "rate" for sell/buy tokens to native
 * network token which will be used to estimate the initial price of all possible
 * token pair combinations.
 *
 * @param {string} api - The 0x API endpoint URL
 * @param {any[]} quotes - The array that keeps the quotes
 * @param {string} tokenAddress - The token address
 * @param {number} tokenDecimals - The token decimals
 */
const initRequests = (api, quotes, tokenAddress, tokenDecimals) => {
    if (quotes.length === 0) quotes.push([
        tokenAddress,
        tokenDecimals
    ]);
    else if (typeof quotes[quotes.length - 1] === "string") {
        if(!quotes.find(v => v.includes(tokenAddress))) quotes.push([
            tokenAddress,
            tokenDecimals
        ]);
    }
    else {
        if(
            quotes[quotes.length - 1][0] !== tokenAddress &&
            !quotes.slice(0, -1).find(v => v.includes(tokenAddress))
        ) {
            quotes[quotes.length - 1] = `${
                api
            }swap/v1/price?buyToken=${
                quotes[quotes.length - 1][0]
            }&sellToken=${
                tokenAddress
            }&sellAmount=${
                "1" + "0".repeat(tokenDecimals)
            }`;
        }
    }
};

/**
 * Prepares the bundled orders by getting the best deals from 0x and sorting the
 * bundled orders based on the best deals
 *
 * @param {string[]} quotes - The 0x request quote bodies
 * @param {any[]} bundledOrders - The bundled orders array
 * @param {boolean} sort - (optional) Sort based on best deals or not
 */
const prepareBundledOrders = async(quotes, bundledOrders, sort = true) => {
    try {
        const responses = await Promise.allSettled(
            quotes.map(
                async(e) => {
                    const response = await axios.get(
                        e,
                        {headers: { "accept-encoding": "null" }}
                    );
                    return [
                        {
                            token: response.data.buyTokenAddress,
                            rate: response.data.buyTokenToEthRate
                        },
                        {
                            rate: response.data.sellTokenToEthRate,
                            token: response.data.sellTokenAddress
                        }
                    ];
                }
            )
        );

        let prices = [];
        responses.forEach(v => {
            if (v.status == "fulfilled") prices.push(v.value);
        });
        prices = prices.flat();

        [...bundledOrders].forEach((v, i) => {
            const sellTokenPrice = prices.find(e => e.token === v.sellToken)?.rate;
            const buyTokenPrice = prices.find(e => e.token === v.buyToken)?.rate;
            if (sellTokenPrice && buyTokenPrice) {
                bundledOrders[i].initPrice = ethers.utils.parseUnits(buyTokenPrice)
                    .mul(ethers.utils.parseUnits("1"))
                    .div(ethers.utils.parseUnits(sellTokenPrice));
            }
            else bundledOrders.splice(i, 1);
        });

        if (sort) bundledOrders.sort(
            (a, b) => a.initPrice.gt(b.initPrice) ? -1 : a.initPrice.lt(b.initPrice) ? 1 : 0
        );
    }
    catch (error) {
        console.log("something went wrong during the process of getting initial prices!");
        console.log(error);
    }
};

/**
 * Estimates the profit for a single bundled orders struct
 *
 * @param {any} txQuote - The quote from 0x
 * @param {object} bundledOrder - The bundled order object
 * @param {ethers.BigNumber} gas - The estimated gas cost
 * @returns The estimated profit
 */
const estimateProfit = (txQuote, bundledOrder, gas) => {
    let income = ethers.constants.Zero;
    const price = ethers.utils.parseUnits(txQuote.price);
    const gasConsumption = ethers.utils.parseEther(txQuote.buyTokenToEthRate)
        .mul(gas)
        .div(ethers.utils.parseEther("1"));
    for (const takeOrder of bundledOrder.takeOrders) {
        income = price
            .sub(takeOrder.ratio)
            .mul(takeOrder.quoteAmount)
            .div(ethers.utils.parseUnits("1"))
            .add(income);
    }
    return income.sub(gasConsumption);
};

/**
 * Get the order details from a subgraph
 *
 * @param {string} subgraphUrl - The subgraph endpoint URL to query for orders' details
 * @returns An array of order details
 */
exports.query = async(subgraphUrl) => {
    try {
        const result = await axios.post(
            subgraphUrl,
            { query: DefaultQuery },
            { headers: { "Content-Type": "application/json" } }
        );
        return result.data.data.orders;
    }
    catch {
        throw "Cannot get order details from subgraph";
    }
};

/**
 * Get the configuration info of a network required for the bot
 * @param {ethers.Wallet} wallet - The ethers wallet with private key instance
 * @param {string} orderbookAddress - The Rain Orderbook contract address deployed on the network
 * @param {string} arbAddress - The Rain Arb contract address deployed on the network
 * @param {string} interpreterAbiPath - (optional) The path to IInterpreter contract ABI, default is ABI in './src/abis' folder
 * @param {string} arbAbiPath - (optional) The path to Arb contract ABI, default is ABI in './src/abis' folder
 * @returns The configuration object
 */
exports.getConfig = async(
    wallet,
    orderbookAddress,
    arbAddress,
    arbAbiPath = "",
    interpreterAbiPath = ""
) => {
    const AddressPattern = /^0x[a-fA-F0-9]{40}$/;
    const chainId = (await wallet.getChainId());
    const config = CONFIG.find(v => v.chainId === chainId);
    if (!AddressPattern.test(orderbookAddress)) throw "invalid orderbook contract address";
    if (!AddressPattern.test(arbAddress)) throw "invalid arb contract address";
    config.orderbookAddress = orderbookAddress;
    config.arbAddress = arbAddress;
    if (interpreterAbiPath) config.interpreterAbi = interpreterAbiPath;
    if (arbAbiPath) config.arbAbi = arbAbiPath;
    return config;
};

/**
 * Main function that gets order details from subgraph, bundles the ones that have balance and tries clearing them
 *
 * @param {ethers.Signer} signer - The ethersjs signer constructed from provided private keys and rpc url provider
 * @param {object} config - The configuration object
 * @param {number} slippage - (optional) The slippage for clearing orders, default is 0.01 i.e. 1 percent
 * @param {boolean} prioritization - (optional) Prioritize better deals to get cleared first, default is true
 * @returns The report of details of cleared orders
 */
exports.clear = async(signer, config, queryResults, slippage = 0.01, prioritization = true) => {
    const api = config.apiUrl;
    const chainId = config.chainId;
    const arbAddress = config.arbAddress;
    const orderbookAddress = config.orderbookAddress;
    const nativeToken = config.nativeToken.address;
    const intAbiPath = config.interpreterAbi;
    const arbAbiPath = config.arbAbi;

    // get the abis if path is provided for them
    if (intAbiPath) interpreterAbi = (JSON.parse(
        fs.readFileSync(path.resolve(__dirname, intAbiPath)).toString())
    )?.abi;
    if (arbAbiPath) arbAbi = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, arbAbiPath)).toString()
    )?.abi;

    // instantiating arb contract
    const arb = new ethers.Contract(arbAddress, arbAbi, signer);

    // orderbook as signer used for eval
    const obAsSigner = new ethers.VoidSigner(
        orderbookAddress,
        signer.provider
    );

    console.log(
        "------------------------- Starting Clearing Process -------------------------",
        "\n"
    );
    console.log("Arb Contract Address: " , arbAddress);
    console.log("OrderBook Contract Address: " , orderbookAddress, "\n");

    console.log(
        "------------------------- Fetching Order Details From Subgraph -------------------------",
        "\n"
    );

    const initQuotes = [];
    const bundledOrders = [];

    if (queryResults.length) console.log(
        "------------------------- Bundling Orders -------------------------", "\n"
    );
    else console.log("No orders found, exiting...", "\n");

    for (let i = 0; i < queryResults.length; i++) {

        const order = queryResults[i];
        for (let j = 0; j < order.validOutputs.length; j++) {
            const _output = order.validOutputs[j];
            const _outputBalance = ethers.utils.parseUnits(
                ethers.utils.formatUnits(
                    _output.tokenVault.balance,
                    _output.token.decimals
                )
            );
            if (!_outputBalance.isZero()) {
                for (let k = 0; k < order.validInputs.length; k ++) {
                    if (_output.token.id !== order.validInputs[k].token.id) {
                        const _input = order.validInputs[k];
                        const { maxOutput, ratio } = await interpreterEval(
                            new ethers.Contract(
                                order.interpreter,
                                interpreterAbi,
                                obAsSigner
                            ),
                            arbAddress,
                            orderbookAddress,
                            order,
                            k,
                            j
                        );
                        if (maxOutput && ratio) {
                            const quoteAmount = _outputBalance.lte(maxOutput)
                                ? _outputBalance
                                : maxOutput;

                            if (!quoteAmount.isZero()) {
                                initRequests(
                                    api,
                                    initQuotes,
                                    _output.token.id,
                                    _output.token.decimals
                                );
                                initRequests(
                                    api,
                                    initQuotes,
                                    _input.token.id,
                                    _input.token.decimals
                                );
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

    if (!bundledOrders.length) {
        console.log("Could not find any order with sufficient balance, exiting...", "\n");
        return;
    }

    console.log(
        "------------------------- Getting Best Deals From 0x -------------------------",
        "\n"
    );
    if (typeof initQuotes[initQuotes.length - 1] !== "string") {
        initQuotes[initQuotes.length - 1] = `${
            api
        }swap/v1/price?buyToken=${
            nativeToken.toLowerCase()
        }&sellToken=${
            initQuotes[initQuotes.length - 1][0]
        }&sellAmount=${
            "1" + "0".repeat(initQuotes[initQuotes.length - 1][1])
        }`;
    }
    await prepareBundledOrders(initQuotes, bundledOrders, prioritization);

    if (bundledOrders.length) console.log(
        "------------------------- Trying To Clear Bundled Orders -------------------------",
        "\n"
    );
    else {
        console.log("Could not find any order to clear for current market price, exiting...", "\n");
        return;
    }

    const report = [];
    for (let i = 0; i < bundledOrders.length; i++) {
        if (bundledOrders[i].takeOrders.length) {
            try {
                console.log(
                    `------------------------- Trying To Clear For ${
                        bundledOrders[i].buyTokenSymbol
                    }/${
                        bundledOrders[i].sellTokenSymbol
                    } -------------------------`,
                    "\n"
                );
                console.log(`Buy Token Address: ${bundledOrders[i].buyToken}`);
                console.log(`Sell Token Address: ${bundledOrders[i].sellToken}`, "\n");
                console.log(">>> Getting current price for this token pair...", "\n");
                let cumulativeAmount = ethers.constants.Zero;
                bundledOrders[i].takeOrders.forEach(v => {
                    cumulativeAmount = cumulativeAmount.add(v.quoteAmount);
                });
                const currentPrice = ethers.utils.parseUnits((await axios.get(
                    `${
                        api
                    }swap/v1/price?buyToken=${
                        bundledOrders[i].buyToken
                    }&sellToken=${
                        bundledOrders[i].sellToken
                    }&sellAmount=${
                        (
                            bundledOrders[i].sellTokenDecimals < 18
                                ? cumulativeAmount.div(
                                    "1" + "0".repeat(18 - bundledOrders[i].sellTokenDecimals)
                                )
                                : cumulativeAmount
                        ).div(2).toString()
                    }&skipValidation=false`,
                    {headers: { "accept-encoding": "null" }}
                ))?.data?.price);

                console.log(
                    ">>> Filtering the bundled orders of this token pair with lower ratio than current market price...",
                    "\n"
                );
                bundledOrders[i].takeOrders = bundledOrders[i].takeOrders.filter(
                    v => currentPrice.gte(v.ratio)
                );

                if (bundledOrders[i].takeOrders.length) {

                    cumulativeAmount = ethers.constants.Zero;
                    bundledOrders[i].takeOrders.forEach(v => {
                        cumulativeAmount = cumulativeAmount.add(v.quoteAmount);
                    });

                    let bundledQuoteAmount = cumulativeAmount;
                    if (bundledOrders[i].sellTokenDecimals < 18) {
                        bundledQuoteAmount = bundledQuoteAmount.div(
                            "1" +
                            "0".repeat(18 - bundledOrders[i].sellTokenDecimals)
                        );
                    }

                    console.log(">>> Getting quote for this token pair...", "\n");
                    const response = await axios.get(
                        `${
                            api
                        }swap/v1/quote?buyToken=${
                            bundledOrders[i].buyToken
                        }&sellToken=${
                            bundledOrders[i].sellToken
                        }&sellAmount=${
                            bundledQuoteAmount.toString()
                        }&slippagePercentage=${
                            slippage
                        }`,
                        {headers: { "accept-encoding": "null" }}
                    );
                    const txQuote = response?.data;
                    if (txQuote) {
                        const takeOrdersConfigStruct = {
                            output: bundledOrders[i].buyToken,
                            input: bundledOrders[i].sellToken,
                            // max and min input should be exactly the same as quoted sell amount
                            // this makes sure the cleared order amount will exactly match the 0x quote
                            minimumInput: bundledQuoteAmount,
                            maximumInput: bundledQuoteAmount,
                            maximumIORatio: ethers.constants.MaxUint256,
                            orders: bundledOrders[i].takeOrders.map(v => v.takeOrder),
                        };

                        // submit the transaction
                        try {
                            console.log(">>> Estimating the profit for this token pair...", "\n");
                            const gasLimit = await arb.estimateGas.arb(
                                takeOrdersConfigStruct,
                                // set to zero because only profitable transactions are submitted
                                0,
                                txQuote.allowanceTarget,
                                txQuote.data,
                                { gasPrice: txQuote.gasPrice }
                            );
                            const estimatedProfit = estimateProfit(
                                txQuote,
                                bundledOrders[i],
                                gasLimit.mul(txQuote.gasPrice)
                            );
                            console.log(`Estimated profit: ${
                                ethers.utils.formatUnits(
                                    bundledOrders[i].buyTokenDecimals < 18
                                        ? estimatedProfit.div(
                                            "1" + "0".repeat(18 - bundledOrders[i].buyTokenDecimals)
                                        )
                                        : estimatedProfit,
                                    bundledOrders[i].buyTokenDecimals
                                )
                            } ${bundledOrders[i].buyTokenSymbol}`, "\n");
                            if (!estimatedProfit.isNegative()) {
                                console.log(">>> Trying to submit the transaction for this token pair...", "\n");
                                const tx = await arb.arb(
                                    takeOrdersConfigStruct,
                                    // set to zero because only profitable transactions are submitted
                                    0,
                                    txQuote.allowanceTarget,
                                    txQuote.data,
                                    { gasPrice: txQuote.gasPrice, gasLimit }
                                );
                                console.log(ETHERSCAN_TX_PAGE[chainId] + tx.hash, "\n");
                                console.log(
                                    ">>> Transaction submitted successfully to the network, waiting for transaction to mine...",
                                    "\n"
                                );
                                try {
                                    const receipt = await tx.wait(1);
                                    console.log(`${bundledOrders[i].takeOrders.length} orders cleared successfully!`);
                                    console.log(`Clear price: ${txQuote.price}`);
                                    console.log(`Clear amount: ${
                                        ethers.utils.formatUnits(
                                            bundledQuoteAmount,
                                            bundledOrders[i].sellTokenDecimals
                                        )
                                    }`, "\n");

                                    report.push({
                                        tokenPair:
                                            bundledOrders[i].buyTokenSymbol +
                                            "/" +
                                            bundledOrders[i].sellTokenSymbol,
                                        buyToken: bundledOrders[i].buyToken,
                                        buyTokenDecimals: bundledOrders[i].buyTokenDecimals,
                                        sellToken: bundledOrders[i].sellToken,
                                        sellTokenDecimals: bundledOrders[i].sellTokenDecimals,
                                        clearedAmount: bundledQuoteAmount.toString(),
                                        clearPrice: txQuote.price,
                                        clearGuaranteedPrice: txQuote.guaranteedPrice,
                                        estimatedProfit,
                                        gasUsed: receipt.gasUsed,
                                        clearedOrders: bundledOrders[i].takeOrders
                                    });

                                    // filter out upcoming take orders matching current cleared order
                                    if (i + 1 < bundledOrders.length) console.log(
                                        ">>> Updating upcoming bundled orders...",
                                        "\n"
                                    );
                                    for (let j = i + 1; j < bundledOrders.length; j++) {
                                        bundledOrders[j].takeOrders = bundledOrders[j].takeOrders
                                            .filter(v => {
                                                for (const item of bundledOrders[i].takeOrders) {
                                                    if (
                                                        item.id === v.id ||
                                                        (
                                                            bundledOrders[j].sellToken ===
                                                            bundledOrders[i].sellToken &&

                                                            v.takeOrder.order.owner ===
                                                                item.takeOrder.order.owner &&

                                                            v.takeOrder.order.validOutputs[
                                                                v.takeOrder.outputIOIndex
                                                            ].vaultId ===
                                                                item.takeOrder.order.validOutputs[
                                                                    v.takeOrder.outputIOIndex
                                                                ].vaultId
                                                        )
                                                    ) return false;
                                                    return true;
                                                }
                                            });
                                    }
                                }
                                catch (error) {
                                    console.log(">>> Transaction execution failed due to:");
                                    console.log(error.reason, "\n");
                                }
                            }
                            else console.log(">>> Skipping because estimated negative profit for this token pair", "\n");
                        }
                        catch (error) {
                            console.log(">>> Transaction failed due to:");
                            console.log(error.reason, "\n");
                        }
                    }
                    else console.log("Failed to get quote from 0x", "\n");
                }
                else console.log(
                    "All orders of this token pair have higher ratio than current market price, checking next token pair...",
                    "\n"
                );
            }
            catch (error) {
                console.log(">>> Failed to get quote from 0x due to:", "\n");
                console.log(error.message);
                console.log("data:");
                console.log(JSON.stringify(error.response.data, null, 2), "\n");
            }
        }
    }
    console.log("---------------------------------------------------------------------------", "\n");
    return report;
};