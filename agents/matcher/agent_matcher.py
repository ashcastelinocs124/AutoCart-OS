import json, os
from pathlib import Path
from web3 import Web3
from openai import OpenAI
from dotenv import load_dotenv
import numpy as np

load_dotenv()

client   = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
w3       = Web3(Web3.HTTPProvider(os.getenv("RPC_URL", "http://127.0.0.1:8545")))

# Resolve abi/ relative to project root (two levels up from this file)
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
with open(_PROJECT_ROOT / "abi" / "AgentMarketplace.json") as f:
    meta = json.load(f)

contract = w3.eth.contract(address=meta["address"], abi=meta["abi"])

# In-memory index: {address: {agent_data, embedding}}
_index: dict = {}


def _embed(text: str) -> list[float]:
    resp = client.embeddings.create(model="text-embedding-3-small", input=text)
    return resp.data[0].embedding


def _cosine(a, b) -> float:
    a, b = np.array(a), np.array(b)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def index_registered_agents():
    """Pull all AgentRegistered events and build the local index."""
    events = contract.events.AgentRegistered.get_logs(from_block=0)
    for e in events:
        addr = e["args"]["wallet"]
        agent = contract.functions.agents(addr).call()
        name, capabilities, endpoint, price, reputation, active = agent
        if not active:
            continue
        embedding = _embed(f"{name}: {capabilities}")
        _index[addr] = {
            "address": addr,
            "name": name,
            "capabilities": capabilities,
            "endpoint": endpoint,
            "priceWei": price,
            "reputation": reputation,
            "embedding": embedding,
        }
    print(f"Indexed {len(_index)} agents")


def find_agents(task_description: str, top_k: int = 3) -> list[dict]:
    """Return top_k agents ranked by (embedding similarity + reputation bonus)."""
    if not _index:
        index_registered_agents()

    task_emb = _embed(task_description)
    scored = []
    for addr, data in _index.items():
        sim = _cosine(task_emb, data["embedding"])
        rep_bonus = min(data["reputation"] * 0.01, 0.1)  # up to +0.10
        scored.append((sim + rep_bonus, data))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [d for _, d in scored[:top_k]]


if __name__ == "__main__":
    index_registered_agents()
    results = find_agents("I need to summarize a long research paper")
    for r in results:
        print(f"  {r['name']} ({r['address'][:8]}…) — rep: {r['reputation']}")
