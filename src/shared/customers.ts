export type Customer = {
  _id?: string
  name: string
  /** National ID or any customer ID number. */
  nationalId: string
  phone: string
  email?: string
  address?: string
  notes?: string
  /** 1250 = 12.5% off, filled in at the POS when the customer is chosen. */
  discountBasisPoints: number
  active: boolean
  createdAt: string
  updatedAt: string
}
