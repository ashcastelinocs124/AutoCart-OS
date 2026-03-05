import json, os, sys
from web3 import Web3
from openai import OpenAI
import httpx
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../matcher"))
from agent_matcher import find_agents, index_registered_agents

load_dotenv()

w3  = Web3(Web3.HTTPProvider(os.getenv("RPC_URL", "http://127.0.0.1:8545")))
oai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

with open("abi/AgentMarketplace.json") as f:
    meta = json.load(f)

contract = w3.eth.contract(address=meta["address"], abi=meta["abi"])

BUYER_PRIVATE_KEY = os.getenv("BUYER_PRIVATE_KEY")
buyer_account = w3.eth.account.from_key(BUYER_PRIVATE_KEY)


def run(task_description: str):
    print(f"\n[Buyer] Task: {task_description}")

    # 1. Discover agents
    index_registered_agents()
    matches = find_agents(task_description, top_k=3)
    if not matches:
        print("[Buyer] No agents found.")
        return

    print(f"\n[Buyer] Top matches:")
    for i, m in enumerate(matches):
        print(f"  {i+1}. {m['name']} | rep: {m['reputation']} | {m['priceWei']} wei | {m['capabilities']}")

    # 2. Pick the best match
    best = matches[0]
    print(f"\n[Buyer] Hiring: {best['name']} ({best['address']})")

    # 3. Create on-chain agreement + escrow ETH
    nonce = w3.eth.get_transaction_count(buyer_account.address)
    tx = contract.functions.createAgreement(
        best["address"], task_description
    ).build_transaction({
        "from": buyer_account.address,
        "value": best["priceWei"],
        "nonce": nonce,
        "gas": 300000,
        "gasPrice": w3.to_wei("1", "gwei"),
    })
    signed = buyer_account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

    # Extract agreementHash from event
    logs = contract.events.AgreementCreated().process_receipt(receipt)
    agreement_hash = logs[0]["args"]["agreementHash"].hex()
    print(f"\n[Buyer] Agreement created. Hash: 0x{agreement_hash}")

    # 4. Call seller off-chain
    print(f"\n[Buyer] Calling seller at {best['endpoint']}/execute ...")
    resp = httpx.post(f"{best['endpoint']}/execute", json={
        "agreementHash": f"0x{agreement_hash}",
        "task": task_description
    }, timeout=30)
    result = resp.json()
    print(f"\n[Seller Output]\n{result['output']}")

    # 5. LLM decides whether output is satisfactory
    verdict = oai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a quality inspector. Reply only 'APPROVE' or 'DISPUTE'."},
            {"role": "user", "content": f"Task: {task_description}\n\nOutput: {result['output']}\n\nIs this output satisfactory?"}
        ]
    )
    decision = verdict.choices[0].message.content.strip().upper()
    print(f"\n[Buyer] Quality verdict: {decision}")

    # 6. Approve or dispute on-chain
    hash_bytes = bytes.fromhex(agreement_hash)
    nonce = w3.eth.get_transaction_count(buyer_account.address)

    if "APPROVE" in decision:
        fn = contract.functions.approveCompletion(hash_bytes)
        action = "approveCompletion"
    else:
        fn = contract.functions.raiseDispute(hash_bytes)
        action = "raiseDispute"

    tx = fn.build_transaction({
        "from": buyer_account.address,
        "nonce": nonce,
        "gas": 100000,
        "gasPrice": w3.to_wei("1", "gwei"),
    })
    signed = buyer_account.sign_transaction(tx)
    w3.eth.send_raw_transaction(signed.raw_transaction)
    print(f"\n[Buyer] {action} submitted on-chain. Done.")
