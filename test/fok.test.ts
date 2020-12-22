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
      ;({ orderBook, alice, bob } = await loadFixtureAdapter(await ethers.getSigners())(fixture))
    })
    describe('when selling', () => {
      it('reverts when there is no order to match', async () => {
        await expect(bob.fokSell(mkr('1'), dai('500'))).to.be.revertedWith('fok-not-filled')

        expect(await orderBook.sellDepth()).to.eq(0)
      })

      it('matches single buy order', async () => {
        await alice.buy(mkr('1'), dai('500'), 0)

        expect(await orderBook.buyDepth()).to.eq(1)

        await bob.fokSell(mkr('1'), dai('500'))

        expect(await orderBook.buyDepth()).to.eq(0)
        expect(await orderBook.sellDepth()).to.eq(0)

        expect(await alice.mkrDelta()).to.eq(mkr('1'))
        expect(await alice.daiDelta()).to.eq(dai('-500'))

        expect(await bob.mkrDelta()).to.eq(mkr('-1'))
        expect(await bob.daiDelta()).to.eq(dai('500'))
      })

      it('reverts when order is not filled completely', async () => {
        await alice.buy(mkr('0.5'), dai('500'), 0)

        await expect(bob.fokSell(mkr('1'), dai('500'))).to.be.revertedWith('fok-not-filled')

        expect(await orderBook.sellDepth()).to.eq(0)
        expect(await orderBook.buyDepth()).to.eq(1)
      })

      it('matches multiple buy orders', async () => {
        await alice.buy(mkr('1'), dai('600'), 0)
        await alice.buy(mkr('1'), dai('500'), 0)

        expect(await orderBook.buyDepth()).to.eq(2)

        await bob.fokSell(mkr('2'), dai('500'))

        expect(await orderBook.buyDepth()).to.eq(0)
        expect(await orderBook.sellDepth()).to.eq(0)

        expect(await alice.mkrDelta()).to.eq(mkr('2'))
        expect(await alice.daiDelta()).to.eq(dai('-1100'))

        expect(await bob.mkrDelta()).to.eq(mkr('-2'))
        expect(await bob.daiDelta()).to.eq(dai('1100'))
      })

      it('matches buy order incompletely', async () => {
        await alice.buy(mkr('1'), dai('600'), 0)

        expect(await orderBook.buyDepth()).to.eq(1)

        await bob.fokSell(mkr('0.5'), dai('500'))

        expect(await orderBook.buyDepth()).to.eq(1)
        expect(await orderBook.sellDepth()).to.eq(0)

        expect(await orderBook.mkrBalance()).to.eq(mkr('0'))
        expect(await orderBook.daiBalance()).to.eq(dai('300'))

        expect(await alice.mkrDelta()).to.eq(mkr('0.5'))
        //expect(await alice.daiDelta()).to.eq(dai("-500"))

        expect(await bob.mkrDelta()).to.eq(mkr('-0.5'))
        expect(await bob.daiDelta()).to.eq(dai('300'))
      })

      it('matches multiple buy orders incompletely', async () => {
        await alice.buy(mkr('1'), dai('600'), 0)
        await alice.buy(mkr('1'), dai('500'), 0)

        expect(await orderBook.buyDepth()).to.eq(2)

        await bob.fokSell(mkr('1.5'), dai('500'))

        expect(await orderBook.buyDepth()).to.eq(1)
        expect(await orderBook.sellDepth()).to.eq(0)

        expect(await orderBook.daiBalance()).to.eq(dai('250'))
        expect(await orderBook.mkrBalance()).to.eq(mkr('0'))

        expect(await alice.mkrDelta()).to.eq(mkr('1.5'))
        //expect(await alice.daiDelta()).to.eq(dai("-1100"))

        expect(await bob.mkrDelta()).to.eq(mkr('-1.5'))
        expect(await bob.daiDelta()).to.eq(dai('850'))
      })
    })

    describe('when buying', () => {
      it('reverts when there is no order to match', async () => {
        await expect(bob.fokBuy(mkr('1'), dai('500'))).to.be.revertedWith('fok-not-filled')

        expect(await orderBook.buyDepth()).to.eq(0)
      })

      it('matches single sell order', async () => {
        await alice.sell(mkr('1'), dai('500'), 0)

        expect(await orderBook.sellDepth()).to.eq(1)

        await bob.fokBuy(mkr('1'), dai('500'))

        expect(await orderBook.buyDepth()).to.eq(0)
        expect(await orderBook.sellDepth()).to.eq(0)

        expect(await alice.mkrDelta()).to.eq(mkr('-1'))
        expect(await alice.daiDelta()).to.eq(dai('500'))

        expect(await bob.mkrDelta()).to.eq(mkr('1'))
        expect(await bob.daiDelta()).to.eq(dai('-500'))
      })

      it('reverts when order is filled only partially', async () => {
        await alice.sell(mkr('0.5'), dai('500'), 0)

        await expect(bob.fokBuy(mkr('1'), dai('500'))).to.be.revertedWith('fok-not-filled')

        expect(await orderBook.sellDepth()).to.eq(1)
        expect(await orderBook.buyDepth()).to.eq(0)
      })

      it('matches multiple sell orders', async () => {
        await alice.sell(mkr('1'), dai('600'), 0)
        await alice.sell(mkr('1'), dai('500'), 0)

        expect(await orderBook.sellDepth()).to.eq(2)

        await bob.fokBuy(mkr('2'), dai('600'))

        expect(await orderBook.buyDepth()).to.eq(0)
        expect(await orderBook.sellDepth()).to.eq(0)

        expect(await alice.mkrDelta()).to.eq(mkr('-2'))
        expect(await alice.daiDelta()).to.eq(dai('1100'))

        expect(await bob.mkrDelta()).to.eq(mkr('2'))
        expect(await bob.daiDelta()).to.eq(dai('-1100'))
      })

      it('matches sell order incompletely', async () => {
        await alice.sell(mkr('1'), dai('600'), 0)

        expect(await orderBook.sellDepth()).to.eq(1)

        await bob.fokBuy(mkr('0.5'), dai('600'))

        expect(await orderBook.buyDepth()).to.eq(0)
        expect(await orderBook.sellDepth()).to.eq(1)

        expect(await orderBook.daiBalance()).to.eq(dai('0'))
        expect(await orderBook.mkrBalance()).to.eq(mkr('0.5'))

        // expect(await alice.mkrDelta()).to.eq(mkr("-1"))
        expect(await alice.daiDelta()).to.eq(dai('300'))

        expect(await bob.mkrDelta()).to.eq(mkr('0.5'))
        expect(await bob.daiDelta()).to.eq(dai('-300'))
      })

      it('matches multiple sell orders incompletely', async () => {
        await alice.sell(mkr('1'), dai('600'), 0)
        await alice.sell(mkr('1'), dai('500'), 0)

        expect(await orderBook.sellDepth()).to.eq(2)

        await bob.fokBuy(mkr('1.5'), dai('600'))

        expect(await orderBook.buyDepth()).to.eq(0)
        expect(await orderBook.sellDepth()).to.eq(1)

        expect(await orderBook.daiBalance()).to.eq(dai('0'))
        expect(await orderBook.mkrBalance()).to.eq(mkr('0.5'))

        // expect(await alice.mkrDelta()).to.eq(mkr("-2"))
        expect(await alice.daiDelta()).to.eq(dai('800'))

        expect(await bob.mkrDelta()).to.eq(mkr('1.5'))
        expect(await bob.daiDelta()).to.eq(dai('-800'))
      })
    })
  })
})
