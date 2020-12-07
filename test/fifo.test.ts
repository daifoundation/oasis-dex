import { expect } from 'chai'
import { ethers } from 'hardhat'

import { OasisCustomerBase } from './exchange/oasisCustomer'
import { OrderBook } from './exchange/orderBook'
import { internalBalancesFixture } from './fixtures/internalBalances'
import { loadFixtureAdapter } from './fixtures/loadFixture'
import { noEscrowFixture } from './fixtures/noEscrow'
import { dai, mkr } from './utils/units';

[noEscrowFixture, internalBalancesFixture].forEach((fixture) => {
  context(`fifo / ${fixture.name}`, () => {
    let orderBook: OrderBook
    let alice: OasisCustomerBase
    let bob: OasisCustomerBase
    beforeEach(async () => {
      ;({ orderBook, alice, bob } = await loadFixtureAdapter(await ethers.getSigners())(fixture))
    })
    it('sell order matches the buy offer that was created earlier', async () => {
      const {position: aliceFirstBuy} = await alice.buy(mkr('1'), dai('500'), 0)
      const {position: aliceSecondBuy} = await alice.buy(mkr('1'), dai('500'), 0)

      expect(await orderBook.sellDepth()).to.eq(0)
      expect(await orderBook.buyDepth()).to.eq(2)
      
      await bob.sell(mkr('1'), dai('500'), 0)
      
      expect(await orderBook.sellDepth()).to.eq(0)
      expect(await orderBook.buyDepth()).to.eq(1)

      const firstBuyExists = await orderBook.orderExists(aliceFirstBuy)
      const secondBuyExists = await orderBook.orderExists(aliceSecondBuy)

      expect(firstBuyExists).to.be.false
      expect(secondBuyExists).to.be.true
    })

    it('buy order matches the sell offer that was created earlier', async () => {
      const {position: aliceFirstSell} = await alice.sell(mkr('1'), dai('500'), 0)
      const {position: aliceSecondSell} = await alice.sell(mkr('1'), dai('500'), 0)

      expect(await orderBook.sellDepth()).to.eq(2)
      expect(await orderBook.buyDepth()).to.eq(0)
      
      await bob.buy(mkr('1'), dai('500'), 0)
      
      expect(await orderBook.sellDepth()).to.eq(1)
      expect(await orderBook.buyDepth()).to.eq(0)

      const firstSellExists = await orderBook.orderExists(aliceFirstSell)
      const secondSellExists = await orderBook.orderExists(aliceSecondSell)

      expect(firstSellExists).to.be.false
      expect(secondSellExists).to.be.true
    })
  })
})
