// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AgentMarketplace is ReentrancyGuard {

    enum Status { PENDING, COMPLETED, DISPUTED, EXPIRED }

    struct Agent {
        string  name;
        string  capabilities;
        string  endpoint;
        uint256 priceWei;
        uint256 reputation;
        bool    active;
    }

    struct Agreement {
        bytes32 agreementHash;
        address buyer;
        address seller;
        string  taskDescription;
        uint256 amountEscrowed;
        Status  status;
        uint256 createdAt;
    }

    mapping(address => Agent)     public agents;
    mapping(bytes32 => Agreement) public agreements;

    address public owner;
    uint256 public constant PLATFORM_FEE_BPS = 100;
    uint256 public constant EXPIRY_SECONDS   = 7 days;

    event AgentRegistered(address indexed wallet, string name, uint256 priceWei);
    event AgreementCreated(bytes32 indexed agreementHash, address indexed buyer, address indexed seller, uint256 amount);
    event AgreementCompleted(bytes32 indexed agreementHash, address indexed seller, uint256 amount);
    event AgreementDisputed(bytes32 indexed agreementHash);
    event AgreementExpired(bytes32 indexed agreementHash);

    constructor() {
        owner = msg.sender;
    }

    function registerService(
        string calldata name,
        string calldata capabilities,
        string calldata endpoint,
        uint256 priceWei
    ) external {
        agents[msg.sender] = Agent(name, capabilities, endpoint, priceWei, agents[msg.sender].reputation, true);
        emit AgentRegistered(msg.sender, name, priceWei);
    }

    function createAgreement(
        address seller,
        string calldata taskDescription
    ) external payable returns (bytes32) {
        Agent storage a = agents[seller];
        require(a.active, "Seller not registered");
        require(msg.value >= a.priceWei, "Insufficient ETH");

        bytes32 h = keccak256(abi.encodePacked(msg.sender, seller, taskDescription, block.timestamp));
        require(agreements[h].createdAt == 0, "Hash collision");

        agreements[h] = Agreement(h, msg.sender, seller, taskDescription, msg.value, Status.PENDING, block.timestamp);
        emit AgreementCreated(h, msg.sender, seller, msg.value);
        return h;
    }

    function approveCompletion(bytes32 agreementHash) external nonReentrant {
        Agreement storage ag = agreements[agreementHash];
        require(ag.buyer == msg.sender, "Not buyer");
        require(ag.status == Status.PENDING, "Not pending");

        ag.status = Status.COMPLETED;
        uint256 fee    = (ag.amountEscrowed * PLATFORM_FEE_BPS) / 10000;
        uint256 payout = ag.amountEscrowed - fee;

        (bool ok,)  = ag.seller.call{value: payout}("");
        require(ok, "Transfer failed");
        (bool ok2,) = owner.call{value: fee}("");
        require(ok2, "Fee transfer failed");

        agents[ag.seller].reputation += 1;
        emit AgreementCompleted(agreementHash, ag.seller, payout);
    }

    function raiseDispute(bytes32 agreementHash) external nonReentrant {
        Agreement storage ag = agreements[agreementHash];
        require(ag.buyer == msg.sender, "Not buyer");
        require(ag.status == Status.PENDING, "Not pending");

        ag.status = Status.DISPUTED;
        (bool ok,) = ag.buyer.call{value: ag.amountEscrowed}("");
        require(ok, "Refund failed");
        emit AgreementDisputed(agreementHash);
    }

    function expireAgreement(bytes32 agreementHash) external nonReentrant {
        Agreement storage ag = agreements[agreementHash];
        require(ag.status == Status.PENDING, "Not pending");
        require(block.timestamp >= ag.createdAt + EXPIRY_SECONDS, "Not expired");

        ag.status = Status.EXPIRED;
        (bool ok,) = ag.buyer.call{value: ag.amountEscrowed}("");
        require(ok, "Refund failed");
        emit AgreementExpired(agreementHash);
    }
}
