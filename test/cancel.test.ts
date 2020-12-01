import { expect } from 'chai'
import { ethers } from 'hardhat'

import { OasisCustomerBase } from './exchange/oasisCustomer'
import { OrderBook } from './exchange/orderBook'
import { internalBalancesFixture } from './fixtures/internalBalances'
import { loadFixtureAdapter } from './fixtures/loadFixture'
import { noEscrowFixture } from './fixtures/noEscrow'
import { dai, mkr } from './utils/units'
;[noEscrowFixture, internalBalancesFixture].forEach((fixture) => {
  context(`Cancel / ${fixture.name}`, () => {
    let alice: OasisCustomerBase
    let orderBook: OrderBook

    beforeEach(async () => {
      ;({ orderBook, alice } = await loadFixtureAdapter(await ethers.getSigners())(fixture))
    })

    it('FailCancelBuy', async () => {
      await alice.buy(mkr('1'), dai('500'), 0)
      const { position: secondBuyPosition } = await alice.buy(mkr('1'), dai('550'), 0)
      await alice.buy(mkr('1'), dai('600'), 0)

      await alice.cancelBuy(secondBuyPosition)

      expect(await orderBook.isSorted()).to.be.true

      expect(await orderBook.orderExists(secondBuyPosition)).to.be.false
    })

    it('FailCancelSell', async () => {
      await alice.sell(mkr('1'), dai('500'), 0)
      const { position: secondSellPosition } = await alice.sell(mkr('1'), dai('550'), 0)
      await alice.sell(mkr('1'), dai('600'), 0)

      await alice.cancelSell(secondSellPosition)

      expect(await orderBook.isSorted()).to.be.true

      expect(await orderBook.orderExists(secondSellPosition)).to.be.false
    })
  })
})
