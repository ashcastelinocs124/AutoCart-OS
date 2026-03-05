export type AgentStatus = 'PENDING' | 'COMPLETED' | 'DISPUTED' | 'EXPIRED'

export type Agent = {
  address: string
  name: string
  capabilities: string[]
  priceEth: string
  reputation: number
}

export type Agreement = {
  hash: string
  buyer: string
  seller: string
  sellerName: string
  taskDescription: string
  amountEth: string
  status: AgentStatus
  createdAt: number
}
