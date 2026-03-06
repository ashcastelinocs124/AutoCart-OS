'use client'

import { useEffect, useRef, useState } from 'react'
import { ethers } from 'ethers'
import ABI from '@/lib/abi'
import type { Agent, Agreement, AgentStatus } from '@/types/marketplace'

const STATUS_MAP: AgentStatus[] = ['PENDING', 'COMPLETED', 'DISPUTED', 'EXPIRED']

export function useMarketplace() {
  const [agents, setAgents] = useState<Record<string, Agent>>({})
  const [agreements, setAgreements] = useState<Record<string, Agreement>>({})
  const [connected, setConnected] = useState(false)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const providerRef = useRef<ethers.WebSocketProvider | null>(null)
  const contractRef = useRef<ethers.Contract | null>(null)
  const reconnectingRef = useRef(false)

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_RPC_WS_URL!
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!
    let mounted = true

    function cleanupConnection() {
      contractRef.current?.removeAllListeners?.()
      providerRef.current?.destroy?.()
      contractRef.current = null
      providerRef.current = null
      reconnectingRef.current = false
    }

    function scheduleReconnect() {
      if (!mounted || reconnectTimerRef.current || reconnectingRef.current) return
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null
        void connect()
      }, 5000)
    }

    async function connect() {
      if (!mounted || reconnectingRef.current || providerRef.current) return
      reconnectingRef.current = true

      try {
        const provider = new ethers.WebSocketProvider(wsUrl)
        const contract = new ethers.Contract(contractAddress, ABI, provider)
        providerRef.current = provider
        contractRef.current = contract

        // ethers v6 types websocket as WebSocketLike; cast is safe in browser context
        const ws = provider.websocket as unknown as WebSocket
        ws.addEventListener('open', () => {
          if (!mounted) return
          setConnected(true)
          reconnectingRef.current = false
        })
        ws.addEventListener('close', () => {
          cleanupConnection()
          if (!mounted) return
          setConnected(false)
          scheduleReconnect()
        })

        // Backfill agents
        const agentMap: Record<string, Agent> = {}
        const agentEvents = await contract.queryFilter(contract.filters.AgentRegistered())
        if (!mounted || contractRef.current !== contract) return
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
        if (!mounted || contractRef.current !== contract) return
        setAgents(agentMap)

        // Backfill agreements
        const agreementMap: Record<string, Agreement> = {}
        const agreementEvents = await contract.queryFilter(contract.filters.AgreementCreated())
        if (!mounted || contractRef.current !== contract) return
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
        if (!mounted || contractRef.current !== contract) return
        setAgreements(agreementMap)

        // Live subscriptions
        contract.on('AgentRegistered', async (wallet: string) => {
          if (!mounted || contractRef.current !== contract) return
          const raw = await contract.agents(wallet)
          if (!mounted || contractRef.current !== contract) return
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
          if (!mounted || contractRef.current !== contract) return
          const raw = await contract.agreements(hash)
          if (!mounted || contractRef.current !== contract) return
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
          if (!mounted || contractRef.current !== contract) return
          setAgreements((prev) =>
            prev[hash] ? { ...prev, [hash]: { ...prev[hash], status: 'COMPLETED' } } : prev
          )
        })

        contract.on('AgreementDisputed', (hash: string) => {
          if (!mounted || contractRef.current !== contract) return
          setAgreements((prev) =>
            prev[hash] ? { ...prev, [hash]: { ...prev[hash], status: 'DISPUTED' } } : prev
          )
        })

        contract.on('AgreementExpired', (hash: string) => {
          if (!mounted || contractRef.current !== contract) return
          setAgreements((prev) =>
            prev[hash] ? { ...prev, [hash]: { ...prev[hash], status: 'EXPIRED' } } : prev
          )
        })
      } catch (err) {
        cleanupConnection()
        if (!mounted) return
        setConnected(false)
        console.error('[useMarketplace] connect error:', err)
        scheduleReconnect()
      }
    }

    void connect()

    return () => {
      mounted = false
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      cleanupConnection()
    }
  }, [])

  const agentList = Object.values(agents).sort((a, b) => b.reputation - a.reputation)
  const agreementList = Object.values(agreements).sort((a, b) => b.createdAt - a.createdAt)

  return { agents: agentList, agreements: agreementList, connected }
}
