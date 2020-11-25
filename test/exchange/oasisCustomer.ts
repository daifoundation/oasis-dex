import { ContractTransaction } from '@ethersproject/contracts'
import { BigNumber, BigNumberish } from 'ethers'

import { Erc20, OasisTester } from '../../typechain'
import { INITIAL_DAI_BALANCE, INITIAL_MKR_BALANCE } from '../fixtures/noEscrow'

export class OasisCustomer {
  constructor(private oasisTester: OasisTester, private mkrToken: Erc20, private daiToken: Erc20) {}

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
      left: event.args[1],
      total: event.args[2],
    }
  }

  async daiDelta() {
    return (await this.daiToken.balanceOf(this.oasisTester.address)).sub(INITIAL_DAI_BALANCE)
  }

  async mkrDelta() {
    return (await this.mkrToken.balanceOf(this.oasisTester.address)).sub(INITIAL_MKR_BALANCE)
  }

  async joinDai(amount: BigNumber) {
    return this.oasisTester.approve(this.daiToken.address, await this.oasisAddress(), amount)
  }

  private async oasisAddress() {
    return this.oasisTester.oasis()
  }

  async joinMkr(amount: BigNumber) {
    return this.oasisTester.approve(this.mkrToken.address, await this.oasisAddress(), amount)
  }

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
