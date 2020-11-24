import { BigNumber } from 'ethers'

import { OasisCustomerBase } from './oasisCustomer'

export class OasisCustomerNoEscrow extends OasisCustomerBase {
  async joinDai(amount: BigNumber) {
    return this.oasisTester.approve(this.daiToken.address, await this.oasisAddress(), amount)
  }
  async joinMkr(amount: BigNumber) {
    return this.oasisTester.approve(this.mkrToken.address, await this.oasisAddress(), amount)
  }
}
