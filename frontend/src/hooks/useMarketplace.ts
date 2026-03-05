'use client'

import { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import ABI from '@/lib/abi'
import type { Agent, Agreement, AgentStatus } from '@/types/marketplace'

const STATUS_MAP: AgentStatus[] = ['PENDING', 'COMPLETED', 'DISPUTED', 'EXPIRED']

export function useMarketplace() {
  const [agents, setAgents] = useState<Record<string, Agent>>({})
  const [agreements, setAgreements] = useState<Record<string, Agreement>>({})
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_RPC_WS_URL!
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!

    let provider: ethers.WebSocketProvider
    let contract: ethers.Contract
    let reconnectTimer: ReturnType<typeof setTimeout>

    async function connect() {
      try {
        provider = new ethers.WebSocketProvider(wsUrl)
        contract = new ethers.Contract(contractAddress, ABI, provider)

        // ethers v6 types websocket as WebSocketLike; cast is safe in browser context
        const ws = provider.websocket as unknown as WebSocket
        ws.addEventListener('open', () => setConnected(true))
        ws.addEventListener('close', () => {
          setConnected(false)
          reconnectTimer = setTimeout(connect, 5000)
        })

        // Backfill agents
        const agentMap: Record<string, Agent> = {}
        const agentEvents = await contract.queryFilter(contract.filters.AgentRegistered())
        for (const e of agentEvents) {
          const log = e as ethers.EventLog
          const addr: string = log.args.wallet
          const raw = await contract.agents(addr)
          agentMap[addr] = {
            address: addr,
            name: raw.name,
            capabilities: (raw.capabilities as string).split(',').map((s) => s.trim()).filter(Boolean),
            priceEth: ethers.formatEther(raw.priceWei),
            reputation: Number(raw.reputation),
          }
        }
        setAgents(agentMap)

        // Backfill agreements
        const agreementMap: Record<string, Agreement> = {}
        const agreementEvents = await contract.queryFilter(contract.filters.AgreementCreated())
        for (const e of agreementEvents) {
          const log = e as ethers.EventLog
          const hash: string = log.args.agreementHash
          const raw = await contract.agreements(hash)
          agreementMap[hash] = {
            hash,
            buyer: raw.buyer,
            seller: raw.seller,
            sellerName: agentMap[raw.seller]?.name ?? raw.seller.slice(0, 8) + '…',
            taskDescription: raw.taskDescription,
            amountEth: ethers.formatEther(raw.amountEscrowed),
            status: STATUS_MAP[Number(raw.status)] ?? 'PENDING',
            createdAt: Number(raw.createdAt),
          }
        }
        setAgreements(agreementMap)

        // Live subscriptions
        contract.on('AgentRegistered', async (wallet: string) => {
          const raw = await contract.agents(wallet)
          setAgents((prev) => ({
            ...prev,
            [wallet]: {
              address: wallet,
              name: raw.name,
              capabilities: (raw.capabilities as string).split(',').map((s: string) => s.trim()).filter(Boolean),
              priceEth: ethers.formatEther(raw.priceWei),
              reputation: Number(raw.reputation),
            },
          }))
        })

        contract.on('AgreementCreated', async (hash: string, buyer: string, seller: string) => {
          const raw = await contract.agreements(hash)
          setAgents((prevAgents) => {
            setAgreements((prev) => ({
              ...prev,
              [hash]: {
                hash,
                buyer,
                seller,
                sellerName: prevAgents[seller]?.name ?? seller.slice(0, 8) + '…',
                taskDescription: raw.taskDescription,
                amountEth: ethers.formatEther(raw.amountEscrowed),
                status: 'PENDING',
                createdAt: Number(raw.createdAt),
              },
            }))
            return prevAgents
          })
        })

        contract.on('AgreementCompleted', (hash: string) => {
          setAgreements((prev) =>
            prev[hash] ? { ...prev, [hash]: { ...prev[hash], status: 'COMPLETED' } } : prev
          )
        })

        contract.on('AgreementDisputed', (hash: string) => {
          setAgreements((prev) =>
            prev[hash] ? { ...prev, [hash]: { ...prev[hash], status: 'DISPUTED' } } : prev
          )
        })

        contract.on('AgreementExpired', (hash: string) => {
          setAgreements((prev) =>
            prev[hash] ? { ...prev, [hash]: { ...prev[hash], status: 'EXPIRED' } } : prev
          )
        })
      } catch (err) {
        console.error('[useMarketplace] connect error:', err)
        reconnectTimer = setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimer)
      contract?.removeAllListeners?.()
      provider?.destroy?.()
    }
  }, [])

  const agentList = Object.values(agents).sort((a, b) => b.reputation - a.reputation)
  const agreementList = Object.values(agreements).sort((a, b) => b.createdAt - a.createdAt)

  return { agents: agentList, agreements: agreementList, connected }
}
