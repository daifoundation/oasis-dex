import { BigNumber } from 'ethers'

import { OasisBase } from '../../typechain/OasisBase'

const sum = (a: BigNumber, b: BigNumber) => a.add(b)

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
    const orderFromContract = await this.oasis.getOrder(false, orderId)
    return (({ baseAmt, prev, next, owner }) => ({ baseAmt, prev, next, owner }))(orderFromContract)
  }

  private buyOrders() {
    return this.orders(true)
  }

  async buyOrder(orderId: number){
    const orderFromContract = await this.oasis.getOrder(true, orderId)
    return (({ baseAmt, prev, next, owner }) => ({ baseAmt, prev, next, owner }))(orderFromContract)
  }

  private async orders(buying: boolean) {
    let next = 0
    const result = []
    let order = await this.oasis.getOrder(buying, next)
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

  async isSorted(){
    return await this.isSellSorted()
    && await this.isBuySorted();
  }

  private async isSellSorted(){
    const array = await this.sellOrders();
    if (array.length === 0) return true;
    const result = array
    .slice(0)
    .reduce((acc, curr, i ,arr) =>  {
      if (acc.price > curr.price) arr.splice(1);
      return curr;
    });
    if (result === array[array.length - 1]) return true;
    return false;
  }

  private async isBuySorted(){
    const array = await this.buyOrders();
    if (array.length === 0) return true;
    const result = array
    .slice(0)
    .reduce((acc, curr, i ,arr) =>  {
      if (acc.price < curr.price) arr.splice(1);
      return curr;
    });
    if (result === array[array.length - 1]) return true;
    return false;
  }
}
