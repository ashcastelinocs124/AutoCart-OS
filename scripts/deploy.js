import { network } from "hardhat";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const { ethers } = await network.connect();
  const [deployer] = await ethers.getSigners();

  console.log("Deploying AgentMarketplace with account:", deployer.address);

  const contract = await ethers.deployContract("AgentMarketplace", [], {
    from: deployer.address,
  });

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log("AgentMarketplace deployed to:", address);

  // Read ABI from Hardhat artifacts
  const artifactPath = join(
    __dirname,
    "../artifacts/contracts/AgentMarketplace.sol/AgentMarketplace.json"
  );
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));

  // Save address + ABI for Python agents to consume
  const abiOutput = { address, abi: artifact.abi };
  const abiPath = join(__dirname, "../abi/AgentMarketplace.json");
  writeFileSync(abiPath, JSON.stringify(abiOutput, null, 2));

  console.log("ABI + address saved to abi/AgentMarketplace.json");

  // Update CONTRACT_ADDRESS in .env
  const envPath = join(__dirname, "../.env");
  let env = readFileSync(envPath, "utf8");
  env = env.replace(/^CONTRACT_ADDRESS=.*/m, `CONTRACT_ADDRESS=${address}`);
  writeFileSync(envPath, env);

  console.log(".env updated with CONTRACT_ADDRESS =", address);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
