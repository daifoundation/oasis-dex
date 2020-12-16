import { parseFixed } from '@ethersproject/bignumber'
import { BigNumber } from 'ethers'
import { parseEther } from 'ethers/lib/utils'

export function eth(amount: string) {
  return parseEther(amount)
}

export const mkr = eth
export const dai = eth

export function bn(value: string) {
  return BigNumber.from(value)
}

export function decn(value: string, power: number) {
  return parseFixed(value, power)
}
