import { ContractTransaction } from '@ethersproject/contracts'
import { BigNumber, BigNumberish } from 'ethers'

import { Erc20, OasisTester } from '../../typechain'
export abstract class OasisCustomerBase {
  constructor(protected oasisTester: OasisTester, protected mkrToken: Erc20, protected daiToken: Erc20) {}

  async buy(amount: BigNumberish, price: BigNumberish, position: number) {
    const transaction = await this.oasisTester.limit(amount, price, true, position)
    return this.findReturnValue(transaction)
  }

  async sell(amount: BigNumberish, price: BigNumberish, position = 0) {
    const transaction = await this.oasisTester.limit(amount, price, false, position)
    return this.findReturnValue(transaction)
  }

  private async findReturnValue(transaction: ContractTransaction) {
    const receipt = await transaction.wait()
    const eventFragment = this.oasisTester.interface.getEvent('LimitResult')
    const topic = this.oasisTester.interface.getEventTopic(eventFragment)
    const log = receipt.logs.find((log) => log.topics.includes(topic))
    if (!log) {
      throw new Error('no event emitted')
    }
    const event = this.oasisTester.interface.parseLog(log)
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
