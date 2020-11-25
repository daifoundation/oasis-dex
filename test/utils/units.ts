import { BigNumber } from 'ethers'
import { parseEther } from 'ethers/lib/utils'

export const eth = (amount: string) => parseEther(amount)
export const mkr = eth
export const dai = eth
export const bn = (value: string) => BigNumber.from(value)
