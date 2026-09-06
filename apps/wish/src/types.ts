export type WishStatus = 'active' | 'ready' | 'purchased' | 'abandoned'

export interface Wish {
  id: string
  title: string
  targetAmount: number
  allocatedAmount: number
  desiredDate: string | null
  categoryId: string | null
  status: WishStatus
  linkedTransactionId?: string
  createdAt: number
  updatedAt: number
}

export interface WishEvent {
  id: string
  wishId: string
  type: 'created' | 'allocated' | 'ready' | 'purchased' | 'abandoned'
  amount?: number
  createdAt: number
}
