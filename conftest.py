collect_ignore_glob = []

# Disable web3's pytest plugin — it imports eth_typing.ContractName
# which is absent in eth_typing 5.x
def pytest_configure(config):
    config.pluginmanager.set_blocked("pytest_ethereum")
