import { ContractTransaction } from '@ethersproject/contracts'
import { BigNumber } from 'ethers'

import { OasisCustomerBase } from './oasisCustomer'

export class OasisCustomerInternalBalances extends OasisCustomerBase {
  async joinDai(amount: BigNumber): Promise<ContractTransaction> {
    await this.oasisTester.approve(this.daiToken.address, await this.oasisAddress(), amount)
    return this.oasisTester.join(false, this.oasisTester.address, amount)
  }

  async joinMkr(amount: BigNumber): Promise<ContractTransaction> {
    await this.oasisTester.approve(this.mkrToken.address, await this.oasisAddress(), amount)
    return this.oasisTester.join(true, this.oasisTester.address, amount)
  }
}
