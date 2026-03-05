import { defineConfig } from "hardhat/config";
import hardhatMocha from "@nomicfoundation/hardhat-mocha";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";

export default defineConfig({
  solidity: {
    version: "0.8.24"
  },
  plugins: [hardhatMocha, hardhatEthers],
});
