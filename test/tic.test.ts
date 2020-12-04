import { expect } from 'chai'
import { ethers } from 'hardhat'

import { OasisBase } from '../typechain/OasisBase'
import { OasisCustomerBase } from './exchange/oasisCustomer'
import { OrderBook } from './exchange/orderBook'
import { internalBalancesFixture } from './fixtures/internalBalances'
import { loadFixtureAdapter } from './fixtures/loadFixture'
import { noEscrowFixture } from './fixtures/noEscrow'
import { dai, mkr } from './utils/units'
;[noEscrowFixture, internalBalancesFixture].forEach((fixture) => {
  context(`tic / ${fixture.name}`, () => {
    let oasis: OasisBase
    let orderBook: OrderBook
    let alice: OasisCustomerBase
    beforeEach(async () => {
      ;({ orderBook, oasis, alice } = await loadFixtureAdapter(await ethers.getSigners())(fixture))
    })

    it('passes tic control', async () => {
      const tic = await oasis.tic()
      const transaction = alice.sell(mkr('1'), dai('1').add(tic), 0)

      await expect(transaction).to.not.be.reverted

      expect(await orderBook.sellDepth()).to.eq(1)
      expect(await orderBook.buyDepth()).to.eq(0)

      expect(await orderBook.daiBalance()).to.eq(dai('0'))
      expect(await orderBook.mkrBalance()).to.eq(mkr('1'))
    })

    it('reverts on tic control', async () => {
      const tic = await oasis.tic()
      const transaction = alice.sell(mkr('1'), dai('1').add(tic).sub('1'), 0)

      await expect(transaction).to.be.revertedWith('tic')
    })
  })
})
