import { ContractTransaction } from '@ethersproject/contracts'
import { BigNumber } from 'ethers'

import { OasisEscrowInternalBalancesFactory } from '../../typechain'
import { dai, mkr } from '../utils/units'
import { OasisCustomerBase } from './oasisCustomer'

export class OasisCustomerInternalBalances extends OasisCustomerBase {
  async daiDelta(): Promise<BigNumber> {
    const oasis = OasisEscrowInternalBalancesFactory.connect(await this.oasisAddress(), this.oasisTester.signer)
    return (await oasis.quoteBal(this.oasisTester.address)).sub(dai('10000'))
  }

  async mkrDelta(): Promise<BigNumber> {
    const oasis = OasisEscrowInternalBalancesFactory.connect(await this.oasisAddress(), this.oasisTester.signer)
    return (await oasis.baseBal(this.oasisTester.address)).sub(mkr('10000'))
  }

  async joinDai(amount: BigNumber): Promise<ContractTransaction> {
    await this.oasisTester.approve(this.daiToken.address, await this.oasisAddress(), amount)
    return this.oasisTester.join(false, this.oasisTester.address, amount)
  }

  async joinMkr(amount: BigNumber): Promise<ContractTransaction> {
    await this.oasisTester.approve(this.mkrToken.address, await this.oasisAddress(), amount)
    return this.oasisTester.join(true, this.oasisTester.address, amount)
  }

  async exitDai(amount: BigNumber): Promise<ContractTransaction>{
    return await this.oasisTester.exit(false, this.oasisTester.address, amount)
  }

  async exitMkr(amount: BigNumber): Promise<ContractTransaction>{
    return await this.oasisTester.exit(true, this.oasisTester.address, amount)
  }

  
}
