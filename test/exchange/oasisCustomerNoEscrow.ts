import { BigNumber } from 'ethers'

import { INITIAL_DAI_BALANCE, INITIAL_MKR_BALANCE } from '../fixtures/fixtureCommon'
import { OasisCustomerBase } from './oasisCustomer'

export class OasisCustomerNoEscrow extends OasisCustomerBase {
  async joinDai(amount: BigNumber) {
    return this.oasisTester.approve(this.daiToken.address, await this.oasisAddress(), amount)
  }
  async joinMkr(amount: BigNumber) {
    return this.oasisTester.approve(this.mkrToken.address, await this.oasisAddress(), amount)
  }
  async exitMkr(amount: BigNumber) {
    return amount
  }
  async exitDai(amount: BigNumber) {
    return amount
  }
  async daiDelta() {
    return (await this.daiToken.balanceOf(this.oasisTester.address)).sub(INITIAL_DAI_BALANCE)
  }
  async mkrDelta() {
    return (await this.mkrToken.balanceOf(this.oasisTester.address)).sub(INITIAL_MKR_BALANCE)
  }
}
