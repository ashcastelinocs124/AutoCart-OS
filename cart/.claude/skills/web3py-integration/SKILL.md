---
name: web3py-integration
description: Use when connecting Python to Ethereum smart contracts using web3.py - reading state, sending transactions, listening to events, or signing with private keys.
---

# web3.py Integration

## Overview
web3.py is the Python library for interacting with Ethereum. Use it to call contract functions, send transactions, and listen to on-chain events from Python agents.

## Setup
```python
from web3 import Web3
from dotenv import load_dotenv
import json, os

load_dotenv()
w3 = Web3(Web3.HTTPProvider(os.getenv("RPC_URL", "http://127.0.0.1:8545")))

with open("abi/MyContract.json") as f:
    meta = json.load(f)  # {"address": "0x...", "abi": [...]}

contract = w3.eth.contract(address=meta["address"], abi=meta["abi"])
```

## Reading State (free, no gas)
```python
result = contract.functions.myView(arg1, arg2).call()
```

## Sending a Transaction (costs gas)
```python
account = w3.eth.account.from_key(os.getenv("PRIVATE_KEY"))

tx = contract.functions.myFunction(arg1).build_transaction({
    "from": account.address,
    "value": w3.to_wei("0.01", "ether"),   # only if payable
    "nonce": w3.eth.get_transaction_count(account.address),
    "gas": 200000,
    "gasPrice": w3.to_wei("1", "gwei"),
})
signed = account.sign_transaction(tx)
tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
```

## Parsing Events from Receipt
```python
logs = contract.events.MyEvent().process_receipt(receipt)
value = logs[0]["args"]["fieldName"]
```

## Fetching Historical Events
```python
events = contract.events.MyEvent.get_logs(from_block=0)
for e in events:
    print(e["args"]["wallet"], e["args"]["name"])
```

## Working with bytes32
```python
# Contract returns bytes32 as raw bytes
hash_bytes = logs[0]["args"]["agreementHash"]   # type: bytes
hash_hex   = hash_bytes.hex()                    # "abc123..."

# Passing bytes32 back to contract
contract.functions.approve(bytes.fromhex(hash_hex)).build_transaction(...)
```

## Common Mistakes
| Mistake | Fix |
|---------|-----|
| `nonce` not incremented | Always fetch fresh: `w3.eth.get_transaction_count(addr)` per tx |
| `raw_transaction` attribute error | Use `signed.raw_transaction` (web3.py >= 6) |
| Event `args` returns tuple, not dict | Use `e["args"]["fieldName"]` or `e["args"][0]` |
| `from_block` missing in get_logs | Default is latest block — always pass `from_block=0` for full history |
| Checksum address error | Wrap address: `Web3.to_checksum_address(addr)` |
