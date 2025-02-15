require("dotenv").config();
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
/**
 * import('hardhat/config').HardhatUserConfig
 */
module.exports = {
    networks: {
        hardhat: {
            forking: {
                url: "https://polygon-rpc.com/", // avalanche network to run the test on
                blockNumber: 42314555
            },
            gasPrice: "auto",
            blockGasLimit: 100000000,
            allowUnlimitedContractSize: true
        },
    },
    mocha: {
        // explicit test configuration, just in case
        asyncOnly: true,
        bail: false,
        parallel: false,
        timeout: 500000,
    },
};