import { expect } from 'chai'
import { ethers } from 'hardhat'

import { OasisCustomerBase } from './exchange/oasisCustomer'
import { OrderBook } from './exchange/orderBook'
import { internalBalancesFixture } from './fixtures/internalBalances'
import { loadFixtureAdapter } from './fixtures/loadFixture'
import { noEscrowFixture } from './fixtures/noEscrow'
import { dai, mkr } from './utils/units'
;[noEscrowFixture, internalBalancesFixture].forEach((fixture) => {
  context(`fok / ${fixture.name}`, () => {
    let orderBook: OrderBook
    let alice: OasisCustomerBase
    let bob: OasisCustomerBase
    beforeEach(async () => {
      ;({ orderBook, alice, bob} = await loadFixtureAdapter(await ethers.getSigners())(fixture))
    })
    describe('when selling', () => {
      it('dose not make order when there is no match', async () => {
        await bob.fokSell(mkr('1'), dai('500'), mkr('1'))

        expect(await orderBook.sellDepth()).to.eq(0)
      })

      it('matches single buy order', async () => {
        await alice.buy(mkr('1'), dai('500'), 0)

        expect(await orderBook.buyDepth()).to.eq(1)

        await bob.fokSell(mkr('1'), dai('500'), mkr('1'))

        expect(await orderBook.buyDepth()).to.eq(0)
        expect(await orderBook.sellDepth()).to.eq(0)

        expect(await alice.mkrDelta()).to.eq(mkr("1"))
        expect(await alice.daiDelta()).to.eq(dai("-500"))

        expect(await bob.mkrDelta()).to.eq(mkr("-1"))
        expect(await bob.daiDelta()).to.eq(dai("500"))
      })

      it('matches multiple buy order', async () => {
        await alice.buy(mkr('1'), dai('600'), 0)
        await alice.buy(mkr('1'), dai('500'), 0)
      
        expect(await orderBook.buyDepth()).to.eq(2)

        await bob.fokSell(mkr('2'), dai('500'), mkr('2'))
  
        expect(await orderBook.buyDepth()).to.eq(0)
        expect(await orderBook.sellDepth()).to.eq(0)
    
        expect(await alice.mkrDelta()).to.eq(mkr("2"))
        expect(await alice.daiDelta()).to.eq(dai("-1100"))

        expect(await bob.mkrDelta()).to.eq(mkr("-2"))
        expect(await bob.daiDelta()).to.eq(dai("1100"))
      })
    })

    describe('when buying', () => {
      it('dose not make order when there is no match', async () => {
        await bob.fokBuy(mkr('1'), dai('500'), dai('500'))
        
        expect(await orderBook.buyDepth()).to.eq(0)
      })

      it('matches single sell order', async () => {
        await alice.sell(mkr('1'), dai('500'), 0)

        expect(await orderBook.sellDepth()).to.eq(1)

        await bob.fokBuy(mkr('1'), dai('500'), dai('500'))

        expect(await orderBook.buyDepth()).to.eq(0)
        expect(await orderBook.sellDepth()).to.eq(0)

        expect(await alice.mkrDelta()).to.eq(mkr("-1"))
        expect(await alice.daiDelta()).to.eq(dai("500"))

        expect(await bob.mkrDelta()).to.eq(mkr("1"))
        expect(await bob.daiDelta()).to.eq(dai("-500"))
      })

      it('matches multiple sell order', async () => {
        await alice.sell(mkr('1'), dai('600'), 0)
        await alice.sell(mkr('1'), dai('500'), 0)
      
        expect(await orderBook.sellDepth()).to.eq(2)

        await bob.fokBuy(mkr('2'), dai('600'), dai('1100'))

        expect(await orderBook.buyDepth()).to.eq(0)
        expect(await orderBook.sellDepth()).to.eq(0)
    
        expect(await alice.mkrDelta()).to.eq(mkr("-2"))
        expect(await alice.daiDelta()).to.eq(dai("1100"))

        expect(await bob.mkrDelta()).to.eq(mkr("2"))
        expect(await bob.daiDelta()).to.eq(dai("-1100"))
      })
    })
    
  })
})
