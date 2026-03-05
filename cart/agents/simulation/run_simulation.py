"""
Simulation orchestrator:
1. Registers 3 seller agents on-chain
2. Runs 3 buyer tasks end-to-end
"""
import json, os, sys, time
from web3 import Web3
from dotenv import load_dotenv

load_dotenv()

# Run from project root so abi/ and agents/ paths resolve correctly
root = os.path.join(os.path.dirname(__file__), "../..")
sys.path.insert(0, os.path.join(root, "agents"))
os.chdir(root)

w3 = Web3(Web3.HTTPProvider(os.getenv("RPC_URL", "http://127.0.0.1:8545")))

with open("abi/AgentMarketplace.json") as f:
    meta = json.load(f)
contract = w3.eth.contract(address=meta["address"], abi=meta["abi"])

ACCOUNTS = [
    os.getenv("SELLER1_PRIVATE_KEY"),
    os.getenv("SELLER2_PRIVATE_KEY"),
    os.getenv("SELLER3_PRIVATE_KEY"),
]

SELLERS = [
    {
        "key": ACCOUNTS[0],
        "name": "SummarizeBot",
        "capabilities": "summarization,text-analysis,document-processing",
        "endpoint": "http://localhost:8001",
        "price": w3.to_wei("0.005", "ether"),
    },
    {
        "key": ACCOUNTS[1],
        "name": "WebSearchBot",
        "capabilities": "web-search,information-retrieval,research",
        "endpoint": "http://localhost:8002",
        "price": w3.to_wei("0.003", "ether"),
    },
    {
        "key": ACCOUNTS[2],
        "name": "CodeReviewBot",
        "capabilities": "code-review,bug-detection,python,javascript",
        "endpoint": "http://localhost:8003",
        "price": w3.to_wei("0.008", "ether"),
    },
]

TASKS = [
    "Summarize the key findings of this machine learning research paper about transformers.",
    "Search the web for the latest news on autonomous AI agents.",
    "Review this Python function for bugs: def add(a,b): return a-b",
]


def register_sellers():
    print("=== Registering Seller Agents ===")
    for s in SELLERS:
        account = w3.eth.account.from_key(s["key"])
        nonce = w3.eth.get_transaction_count(account.address)
        tx = contract.functions.registerService(
            s["name"], s["capabilities"], s["endpoint"], s["price"]
        ).build_transaction({
            "from": account.address,
            "nonce": nonce,
            "gas": 200000,
            "gasPrice": w3.to_wei("1", "gwei"),
        })
        signed = account.sign_transaction(tx)
        w3.eth.send_raw_transaction(signed.rawTransaction)
        print(f"  Registered: {s['name']} at {account.address[:10]}…")
        time.sleep(0.5)
    print()


def run_tasks():
    from buyer.buyer_agent import run
    print("=== Running Buyer Tasks ===")
    for task in TASKS:
        print(f"\n{'='*60}")
        run(task)
        time.sleep(1)


if __name__ == "__main__":
    register_sellers()
    run_tasks()
