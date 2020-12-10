import { expect } from 'chai'
import { ethers } from 'hardhat'

import { OasisCustomerBase } from './exchange/oasisCustomer'
import { OrderBook } from './exchange/orderBook'
import { internalBalancesFixture } from './fixtures/internalBalances'
import { loadFixtureAdapter } from './fixtures/loadFixture'
import { noEscrowFixture } from './fixtures/noEscrow'
import { dai, mkr } from './utils/units'
;[noEscrowFixture, internalBalancesFixture].forEach((fixture) => {
  context(`cancel / ${fixture.name}`, () => {
    let alice: OasisCustomerBase
    let bob: OasisCustomerBase
    let orderBook: OrderBook

    const SENTINEL_ID = 0
    const UNUSED_ID = 8

    beforeEach(async () => {
      ;({ orderBook, alice, bob } = await loadFixtureAdapter(await ethers.getSigners())(fixture))
    })

    it('removes buy order', async () => {
      await alice.buy(mkr('1'), dai('500'), 0)
      const { position: secondBuyPosition } = await alice.buy(mkr('1'), dai('550'), 0)
      await alice.buy(mkr('1'), dai('600'), 0)

      await alice.cancelBuy(secondBuyPosition)

      expect(await orderBook.isSorted()).to.be.true

      expect(await orderBook.orderExists(secondBuyPosition)).to.be.false
    })

    it('removes sell order', async () => {
      await alice.sell(mkr('1'), dai('500'), 0)
      const { position: secondSellPosition } = await alice.sell(mkr('1'), dai('550'), 0)
      await alice.sell(mkr('1'), dai('600'), 0)

      await alice.cancelSell(secondSellPosition)

      expect(await orderBook.isSorted()).to.be.true

      expect(await orderBook.orderExists(secondSellPosition)).to.be.false
    })

    it("reverts when trying to cancel someone's buying order", async () => {
      const { position: secondSellPosition } = await alice.buy(mkr('1'), dai('550'), 0)

      expect(await orderBook.buyDepth()).to.eq(1)
      await expect(bob.cancelBuy(secondSellPosition)).to.be.revertedWith('only-owner')
    })

    it("reverts when trying to cancel someone's selling order", async () => {
      const { position: secondSellPosition } = await alice.sell(mkr('1'), dai('550'), 0)

      expect(await orderBook.sellDepth()).to.eq(1)
      await expect(bob.cancelSell(secondSellPosition)).to.be.revertedWith('only-owner')
    })

    it('reverts when trying to cancel buy order that does not exist', async () => {
      await alice.buy(mkr('1'), dai('550'), 0)
      await bob.buy(mkr('1'), dai('550'), 0)

      expect(await orderBook.buyDepth()).to.eq(2)
      await expect(bob.cancelBuy(UNUSED_ID)).to.be.revertedWith('no-order')
    })

    it('reverts when trying to cancel sell order that does not exist', async () => {
      await alice.sell(mkr('1'), dai('550'), 0)
      await bob.sell(mkr('1'), dai('550'), 0)

      expect(await orderBook.sellDepth()).to.eq(2)
      await expect(bob.cancelSell(UNUSED_ID)).to.be.revertedWith('no-order')
    })

    it('reverts when trying to cancel the sentinel order (buy)', async () => {
      await expect(bob.cancelBuy(SENTINEL_ID)).to.be.revertedWith('sentinel-forever')
    })

    it('reverts when trying to cancel the sentinel order (sell)', async () => {
      await expect(bob.cancelSell(SENTINEL_ID)).to.be.revertedWith('sentinel-forever')
    })
  })
})
