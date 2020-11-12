import { parseEther } from 'ethers/lib/utils'

export const eth = (amount: Number) => parseEther(amount.toString())
export const mkr = eth
export const dai = eth
