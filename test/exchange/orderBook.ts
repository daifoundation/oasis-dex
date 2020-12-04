import { BigNumber } from 'ethers'

import { OasisBase } from '../../typechain/OasisBase'
import { isSorted } from '../utils/isSorted'

type OrderFromContract = {
  baseAmt: BigNumber
  price: BigNumber
  owner: string
  prev: BigNumber
  next: BigNumber
  '0': BigNumber
  '1': BigNumber
  '2': string
  '3': BigNumber
  '4': BigNumber
}

interface Order {
  baseAmt: BigNumber
  price: BigNumber
  owner: string
  prev: BigNumber
  next: BigNumber
}

function sum(a: BigNumber, b: BigNumber) {
  return a.add(b)
}

function descending(lhs: Order, rhs: Order) {
  return lhs.price.gte(rhs.price)
}

function ascending(lhs: Order, rhs: Order) {
  return lhs.price.lte(rhs.price)
}

function pickOrder(orderFromContract: OrderFromContract): Order {
  return (({ baseAmt, next, owner, prev, price }) => ({ baseAmt, next, owner, prev, price }))(orderFromContract)
}

export class OrderBook {
  constructor(private oasis: OasisBase) {}
  async sellDepth(): Promise<number> {
    return (await this.sellOrders()).length
  }

  async buyDepth(): Promise<number> {
    return (await this.buyOrders()).length
  }

  private async sellOrders() {
    return this.orders(false)
  }

  async sellOrder(orderId: number) {
    return pickOrder(await this.oasis.getOrder(false, orderId))
  }

  private buyOrders() {
    return this.orders(true)
  }

  async buyOrder(orderId: number) {
    return pickOrder(await this.oasis.getOrder(true, orderId))
  }

  private async orders(buying: boolean) {
    let next = 0
    const result = []
    let order = pickOrder(await this.oasis.getOrder(buying, next))
    while (order.next.toNumber() !== 0) {
      next = order.next.toNumber()
      order = await this.oasis.getOrder(buying, next)
      result.push(order)
    }
    return result
  }

  async daiBalance() {
    return (await this.buyOrders())
      .map((order) => order.baseAmt.mul(order.price).div(BigNumber.from(10).pow(18)))
      .reduce(sum, BigNumber.from(0))
  }

  async mkrBalance() {
    return (await this.sellOrders()).map((order) => order.baseAmt).reduce(sum, BigNumber.from(0))
  }

  async isSorted() {
    return (await this.isSellSorted()) && (await this.isBuySorted())
  }

  private async isSellSorted() {
    return isSorted(await this.sellOrders(), ascending)
  }

  private async isBuySorted() {
    return isSorted(await this.buyOrders(), descending)
  }

  async buyOrderAtIndex(index: number) {
    return (await this.buyOrders())[index]
  }

  async sellOrderAtIndex(index: number) {
    return (await this.sellOrders())[index]
  }

  async orderExists(orderId: number): Promise<boolean> {
    let order = await this.buyOrder(orderId)
    order = order.baseAmt.isZero() ? await this.sellOrder(orderId) : order
    return !order.baseAmt.isZero()
  }

  async isEmpty() {
    return (await this.buyDepth()) === 0 && (await this.sellDepth()) === 0
  }
}
