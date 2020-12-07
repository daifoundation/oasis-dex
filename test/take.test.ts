import { expect } from 'chai'
import { ethers } from 'hardhat'

import { OasisCustomerBase } from './exchange/oasisCustomer'
import { OrderBook } from './exchange/orderBook'
import { internalBalancesFixture } from './fixtures/internalBalances'
import { loadFixtureAdapter } from './fixtures/loadFixture'
import { noEscrowFixture } from './fixtures/noEscrow'
import { dai, mkr } from './utils/units'
;[noEscrowFixture, internalBalancesFixture].forEach((fixture) => {
  context(`take / ${fixture.name}`, () => {
    let orderBook: OrderBook
    let alice: OasisCustomerBase
    let bob: OasisCustomerBase
    beforeEach(async () => {
      ;({ orderBook, alice, bob } = await loadFixtureAdapter(await ethers.getSigners())(fixture))
    })
    describe('when selling', () => {
      it('matches single buy order', async () => {
        await alice.buy(mkr('1'), dai('600'), 0)
        await alice.buy(mkr('1'), dai('500'), 0)
  
        expect(await orderBook.sellDepth()).to.eq(0)
        expect(await orderBook.buyDepth()).to.eq(2)
  
        const { position, left, total } = await bob.sell(mkr('1'), dai('600'), 0)
        expect(position).to.eq('0') // order immediately filled
        expect(left).to.eq(mkr('0'))
        expect(total).to.eq(dai('600'))
  
        expect(await orderBook.sellDepth()).to.eq(0)
        expect(await orderBook.buyDepth()).to.eq(1)
  
        expect(await orderBook.daiBalance()).to.eq(dai('500'))
        expect(await orderBook.mkrBalance()).to.eq(mkr('0'))
  
        expect(await alice.mkrDelta()).to.eq(mkr('1'))
  
        expect(await bob.daiDelta()).to.eq(dai('600'))
        expect(await bob.mkrDelta()).to.eq(mkr('-1'))
      })

      it('matches multiple buy orders', async () => {
        await alice.buy(mkr('1'), dai('600'), 0)
        await alice.buy(mkr('1'), dai('500'), 0)
  
        const { position, left, total } = await bob.sell(mkr('2'), dai('500'), 0)
  
        expect(position).to.eq('0')
        expect(left).to.eq(mkr('0'))
        expect(total).to.eq(dai('1100'))
  
        expect(await orderBook.sellDepth()).to.eq(0)
        expect(await orderBook.buyDepth()).to.eq(0)
  
        expect(await alice.daiDelta()).to.eq(dai('-1100'))
        expect(await alice.mkrDelta()).to.eq(mkr('2'))
  
        expect(await bob.daiDelta()).to.eq(dai('1100'))
        expect(await bob.mkrDelta()).to.eq(mkr('-2'))
      })

      it('matches multiple buy orders, then makes a sell order', async () => {
        await alice.buy(mkr('1'), dai('600'), 0)
        await alice.buy(mkr('1'), dai('500'), 0)
  
        const { position, left, total } = await bob.sell(mkr('3'), dai('500'), 0)
  
        expect(position).to.not.eq('0')
        expect(left).to.eq(mkr('1'))
        expect(total).to.eq(dai('1100'))
  
        expect(await orderBook.sellDepth()).to.eq(1)
        expect(await orderBook.buyDepth()).to.eq(0)
  
        expect(await orderBook.daiBalance()).to.eq(dai('0'))
        expect(await orderBook.mkrBalance()).to.eq(mkr('1'))
  
        expect(await alice.daiDelta()).to.eq(dai('-1100'))
        expect(await alice.mkrDelta()).to.eq(mkr('2'))
  
        expect(await bob.daiDelta()).to.eq(dai('1100'))
        //expect(await bob.mkrDelta()).to.eq(mkr('-2'))
      })

      it('matches buy order incompletely', async () => {
        await alice.buy(mkr('1'), dai('600'), 0)
        await alice.buy(mkr('1'), dai('500'), 0)

        expect(await orderBook.daiBalance()).to.eq(dai('1100'))
        expect(await orderBook.sellDepth()).to.eq(0)
        expect(await orderBook.buyDepth()).to.eq(2)

        const { position, left, total } = await bob.sell(mkr('0.5'), dai('600'), 0)
        expect(position).to.eq('0') // order immediately filled
        expect(await orderBook.sellDepth()).to.eq(0)
        expect(await orderBook.buyDepth()).to.eq(2)
        expect(left).to.eq(mkr('0'))
        expect(total).to.eq(dai('300'))

        expect(await orderBook.daiBalance()).to.eq(dai('800'))
        expect(await orderBook.mkrBalance()).to.eq(mkr('0'))

        //expect(await alice.daiDelta()).to.eq(dai('-300'))
        expect(await alice.mkrDelta()).to.eq(mkr('0.5'))

        expect(await bob.daiDelta()).to.eq(dai('300'))
        expect(await bob.mkrDelta()).to.eq(mkr('-0.5'))
      })

      it('matches multiple buy orders incompletely', async () => {
        await alice.buy(mkr('1'), dai('600'), 0)
        const buyOrder = await alice.buy(mkr('1'), dai('500'), 0)
        expect(await orderBook.daiBalance()).to.eq(dai('1100'))

        const { position, left, total } = await bob.sell(mkr('1.5'), dai('500'), 0)

        expect(position).to.eq('0') // order immediately filled
        expect(left).to.eq(mkr('0'))
        expect(total).to.eq(dai('850'))

        expect(await orderBook.sellDepth()).to.eq(0)
        expect(await orderBook.buyDepth()).to.eq(1)

        const { baseAmt } = await orderBook.buyOrder(buyOrder.position)
        expect(baseAmt).to.eq(mkr('0.5'))

        expect(await orderBook.daiBalance()).to.eq(dai('250'))
        expect(await orderBook.mkrBalance()).to.eq(mkr('0'))

        //expect(await alice.daiDelta()).to.eq(dai('-850'))
        expect(await alice.mkrDelta()).to.eq(mkr('1.5'))

        expect(await bob.daiDelta()).to.eq(dai('850'))
        expect(await bob.mkrDelta()).to.eq(mkr('-1.5'))
      })

    })
    describe('when buying', () => {
      it('matches single sell order', async () => {
        await alice.sell(mkr('1'), dai('500'), 0)
        await alice.sell(mkr('1'), dai('600'), 0)
  
        expect(await orderBook.sellDepth()).to.eq(2)
        expect(await orderBook.buyDepth()).to.eq(0)
  
        await bob.buy(mkr('1'), dai('500'), 0)
  
        expect(await orderBook.sellDepth()).to.eq(1)
        expect(await orderBook.buyDepth()).to.eq(0)
  
        expect(await orderBook.daiBalance()).to.eq(dai('0'))
        expect(await orderBook.mkrBalance()).to.eq(mkr('1'))
  
        expect(await alice.daiDelta()).to.eq(dai('500'))
        //expect(await alice.mkrDelta()).to.eq(mkr('-1'))
  
        expect(await bob.daiDelta()).to.eq(dai('-500'))
        expect(await bob.mkrDelta()).to.eq(mkr('1'))
      })
  
      it('matches multiple sell orders', async () => {
        await alice.sell(mkr('1'), dai('500'), 0)
        await alice.sell(mkr('1'), dai('600'), 0)
  
        const { position } = await bob.buy(mkr('2'), dai('600'), 0)
  
        expect(position).to.eq('0')
  
        expect(await orderBook.sellDepth()).to.eq(0)
        expect(await orderBook.buyDepth()).to.eq(0)
  
        expect(await orderBook.daiBalance()).to.eq(dai('0'))
        expect(await orderBook.mkrBalance()).to.eq(mkr('0'))
  
        expect(await alice.daiDelta()).to.eq(dai('1100'))
        expect(await alice.mkrDelta()).to.eq(mkr('-2'))
  
        expect(await bob.daiDelta()).to.eq(dai('-1100'))
        expect(await bob.mkrDelta()).to.eq(mkr('2'))
      })
  
      it('matches multiple sell orders, then makes a buy order', async () => {
        await alice.sell(mkr('1'), dai('500'), 0)
        await alice.sell(mkr('1'), dai('600'), 0)
  
        const { position } = await bob.buy(mkr('3'), dai('600'), 0)
  
        expect(position).to.not.eq('0')
  
        expect(await orderBook.sellDepth()).to.eq(0)
        expect(await orderBook.buyDepth()).to.eq(1)
  
        expect(await orderBook.daiBalance()).to.eq(dai('600'))
        expect(await orderBook.mkrBalance()).to.eq(mkr('0'))
  
        expect(await alice.daiDelta()).to.eq(dai('1100'))
        expect(await alice.mkrDelta()).to.eq(mkr('-2'))
  
        //expect(await bob.daiDelta()).to.eq(dai('-1100'))
        expect(await bob.mkrDelta()).to.eq(mkr('2'))
      })
  
      it('matches sell order incompletely', async () => {
        const { position: aliceSellPosition } = await alice.sell(mkr('1'), dai('500'), 0)
        await alice.sell(mkr('1'), dai('600'), 0)
  
        const { position: bobBuyPosition } = await bob.buy(mkr('0.5'), dai('500'), 0)
  
        expect(bobBuyPosition).to.eq('0')
  
        expect(await orderBook.sellDepth()).to.eq(2)
        expect(await orderBook.buyDepth()).to.eq(0)
  
        const { baseAmt } = await orderBook.sellOrder(aliceSellPosition)
        expect(baseAmt).to.eq(dai('0.5'))
  
        expect(await orderBook.daiBalance()).to.eq('0')
        expect(await orderBook.mkrBalance()).to.eq(mkr('1.5'))
  
        expect(await alice.daiDelta()).to.eq(dai('250'))
        //expect(await alice.mkrDelta()).to.eq(mkr('-0.5'))
  
        expect(await bob.daiDelta()).to.eq(dai('-250'))
        expect(await bob.mkrDelta()).to.eq(mkr('0.5'))
      })
  
      it('matches multiple sell orders incompletely', async () => {
        await alice.sell(mkr('1'), dai('500'), 0)
        const { position: aliceSellPosition } = await alice.sell(mkr('1'), dai('600'), 0)
  
        const { position: bobBuyPosition } = await bob.buy(mkr('1.5'), dai('600'), 0)
  
        expect(bobBuyPosition).to.eq('0')
  
        expect(await orderBook.sellDepth()).to.eq(1)
        expect(await orderBook.buyDepth()).to.eq(0)
  
        const { baseAmt } = await orderBook.sellOrder(aliceSellPosition)
  
        expect(baseAmt).to.eq(mkr('0.5'))
  
        expect(await orderBook.daiBalance()).to.eq(dai('0'))
        expect(await orderBook.mkrBalance()).to.eq(mkr('0.5'))
  
        expect(await alice.daiDelta()).to.eq(dai('800'))
        //expect(await alice.mkrDelta()).to.eq(mkr('-1.5'))
  
        expect(await bob.daiDelta()).to.eq(dai('-800'))
        expect(await bob.mkrDelta()).to.eq(mkr('1.5'))
      })
    })
    it('total is the amount of quote token filled on take', async () => {
      await alice.buy(mkr('1'), dai('600'), 0)
  
      const { left, total } = await bob.sell(mkr('0.3'), dai('600'), 0)
  
      expect(left).to.eq(mkr('0'))
      expect(total).to.eq(dai('180'))
    })
  
    it('left is the amount of base token that has not been matched', async () => {
      await alice.buy(mkr('0.3'), dai('600'), 0)
  
      const { left, total } = await bob.sell(mkr('1'), dai('600'), 0)
  
      expect(left).to.eq(mkr('0.7'))
      expect(total).to.eq(dai('180'))
    })
  
    it('left and total are returned also when order was removed due to dust condition', async () => {
      await alice.buy(mkr('0.3001'), dai('600'), 0)
  
      const { left, total } = await bob.sell(mkr('0.3'), dai('600'), 0)
  
      expect(await orderBook.isEmpty()).to.be.true
      expect(left).to.eq(mkr('0'))
      expect(total).to.eq(dai('180'))
    })
  })
})
