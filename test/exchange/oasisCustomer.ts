import { ContractTransaction } from '@ethersproject/contracts'
import { BigNumber, BigNumberish } from 'ethers'

import { Erc20, OasisTester } from '../../typechain'

type TransactionType = 'limit' | 'fok'
export abstract class OasisCustomerBase {
  constructor(protected oasisTester: OasisTester, protected mkrToken: Erc20, protected daiToken: Erc20) {}

  async buy(amount: BigNumberish, price: BigNumberish, position: number) {
    const transaction = await this.oasisTester.limit(amount, price, true, position)
    return this.findReturnValue(transaction, 'limit')
  }

  async sell(amount: BigNumberish, price: BigNumberish, position = 0) {
    const transaction = await this.oasisTester.limit(amount, price, false, position)
    return this.findReturnValue(transaction, 'limit')
  }

  async fokBuy(amount: BigNumberish, price: BigNumberish, totalLimit: BigNumberish){
    const transaction = await this.oasisTester.fok(amount, price, true, totalLimit)
    return this.findReturnValue(transaction, 'fok')
  }

  async fokSell(amount: BigNumberish, price: BigNumberish, totalLimit: BigNumberish){
    const transaction = await this.oasisTester.fok(amount, price, false, totalLimit)
    return this.findReturnValue(transaction, 'fok')
  }

  private async findReturnValue(transaction: ContractTransaction, type: TransactionType) {
    const receipt = await transaction.wait()
    const eventFragment = type === 'limit' ? this.oasisTester.interface.getEvent('LimitResult') : this.oasisTester.interface.getEvent('FokResult')
    const topic = this.oasisTester.interface.getEventTopic(eventFragment)
    const log = receipt.logs.find((log) => log.topics.includes(topic))
    if (!log) {
      throw new Error('no event emitted')
    }
    const event = this.oasisTester.interface.parseLog(log)
    if (type === 'fok') return {
      left: BigNumber.from(event.args[0]),
      total: BigNumber.from(event.args[1]),
    }
    return {
      position: event.args[0],
      left: BigNumber.from(event.args[1]),
      total: BigNumber.from(event.args[2]),
    }
  }

  abstract daiDelta(): Promise<BigNumber>

  abstract mkrDelta(): Promise<BigNumber>

  abstract joinDai(amount: BigNumber): Promise<ContractTransaction>

  protected async oasisAddress() {
    return this.oasisTester.oasis()
  }

  abstract joinMkr(amount: BigNumber): Promise<ContractTransaction>

  abstract exitMkr(amount: BigNumber): Promise<ContractTransaction> | Promise<BigNumber>

  abstract exitDai(amount: BigNumber): Promise<ContractTransaction> | Promise<BigNumber>

  private async cancel(buying: boolean, orderId: number) {
    await this.oasisTester.cancel(buying, orderId)
  }

  async cancelBuy(orderId: number) {
    await this.cancel(true, orderId)
  }

  async cancelSell(orderId: number) {
    await this.cancel(false, orderId)
  }
}
