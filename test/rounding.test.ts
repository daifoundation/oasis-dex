import { expect } from 'chai'
import { BigNumberish, Signer } from 'ethers'
import { ethers } from 'hardhat'

import {
  Erc20,
  MockTokenFactory,
  OasisEscrowInternalBalancesFactory,
  OasisNoEscrowFactory,
  OasisTesterFactory,
} from '../typechain'
import { OasisCustomerInternalBalances } from './exchange/oasisCustomerInternalBalances'
import { OasisCustomerNoEscrow } from './exchange/oasisCustomerNoEscrow'
import { bn, dai, eth, mkr } from './utils/units'
;[
  { Contract: OasisNoEscrowFactory, Customer: OasisCustomerNoEscrow },
  { Contract: OasisEscrowInternalBalancesFactory, Customer: OasisCustomerInternalBalances },
].forEach(({ Contract, Customer }) => {
  describe(`oasis dex rounding behaviour for ${Contract.name}`, () => {
    let deployer: Signer

    beforeEach(async () => {
      ;[deployer] = await ethers.getSigners()
    })

    async function tokenWithDecimals(decimals: BigNumberish) {
      return new MockTokenFactory(deployer).deploy('MKR', decimals)
    }

    async function oasisWithTic(tic: BigNumberish, baseToken: Erc20, quoteToken: Erc20) {
      const oasis = await new Contract(deployer).deploy(baseToken.address, quoteToken.address, tic, 1)
      const oasisTester = await new OasisTesterFactory(deployer).deploy(oasis.address)
      const customer = new Customer(oasisTester, baseToken, quoteToken)

      const amountBase = eth('1000').div(bn('10').pow(bn('18').sub(await baseToken.decimals())))
      const amountQuote = eth('1000').div(bn('10').pow(bn('18').sub(await quoteToken.decimals())))

      await baseToken.transfer(oasisTester.address, amountBase)
      await quoteToken.transfer(oasisTester.address, amountQuote)

      await customer.joinDai(amountQuote)
      await customer.joinMkr(amountBase)
      return customer
    }

    ;[
      { tic: 1, amount: mkr('1'), price: 1 },
      { tic: 100, amount: mkr('1.99'), price: dai('1') },
      { tic: 100, amount: mkr('1.9'), price: dai('1.2') },
      { tic: 100, amount: mkr('1'), price: dai('1.12') },
      { tic: 10000, amount: mkr('1.123'), price: dai('1.12') },
      { tic: dai('0.01'), amount: mkr('1.1234567890123456'), price: dai('1.12') },
    ].forEach(({ tic, amount, price }) => {
      it(`allows base amount of ${amount.toString()} with price ${price.toString()} and tic=${tic.toString()}`, async () => {
        const baseToken = await tokenWithDecimals(18)
        const quoteToken = await tokenWithDecimals(18)
        const customer = await oasisWithTic(tic, baseToken, quoteToken)
        const { position } = await customer.sell(amount, price)
        expect(position).to.not.eql(0)
      })
    })
    ;[
      { tic: 1, amount: mkr('1.1'), price: 1, expectedError: 'base-dirty' },
      { tic: 100, amount: mkr('1.123'), price: 500, expectedError: 'base-dirty' },
      { tic: dai('0.01'), amount: mkr('1.1234567890123456'), price: dai('1.123'), expectedError: 'tic' },
      { tic: dai('0.01'), amount: mkr('1.12345678901234567'), price: dai('1.12'), expectedError: 'base-dirty' },
    ].forEach(({ tic, amount, price, expectedError }) => {
      it(`does not allow base amount of ${amount.toString()} with price ${price.toString()} and tic=${tic.toString()}`, async () => {
        const baseToken = await tokenWithDecimals(18)
        const quoteToken = await tokenWithDecimals(18)
        const customer = await oasisWithTic(tic, baseToken, quoteToken)
        await expect(customer.sell(amount, price)).to.be.revertedWith(expectedError)
      })
    })

    describe('quote', () => {
      function dec4(value: string) {
        return eth(value).div(bn('10').pow(14))
      }

      it('is accurate when quote token has fewer decimals', async () => {
        const baseToken = await tokenWithDecimals(18)
        const quoteToken = await tokenWithDecimals(4)
        const customer = await oasisWithTic(100, baseToken, quoteToken)
        const { position } = await customer.sell(mkr('1.12'), dec4('1.12'))
        expect(position).to.not.eql(0)
      })

      it('is accurate when base token has fewer decimals', async () => {
        const baseToken = await tokenWithDecimals(4)
        const quoteToken = await tokenWithDecimals(18)
        const customer = await oasisWithTic(100, baseToken, quoteToken)
        const { position } = await customer.sell(dec4('1.12'), dai('1.12'))
        expect(position).to.not.eql(0)
      })
    })
  })
})
