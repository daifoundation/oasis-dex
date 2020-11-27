import { expect } from 'chai'
import { ethers } from 'hardhat'

import { OasisCustomerBase } from './exchange/oasisCustomer'
import { OrderBook } from './exchange/orderBook'
import { internalBalancesMkrDaiFixture } from './fixtures/internalBalances'
import { loadFixtureAdapter } from './fixtures/loadFixture'
import { noEscrowMkrDaiFixture } from './fixtures/noEscrow'
import { dai, mkr } from './utils/units'

;[noEscrowMkrDaiFixture, internalBalancesMkrDaiFixture].forEach((fixture) => {
  context(`erc20 MKR/DAI market / MAKE TEST for ${fixture.name}`, () => {
    let orderBook: OrderBook
    let alice: OasisCustomerBase
    beforeEach(async () => {
      ;({ orderBook, alice } = await loadFixtureAdapter(await ethers.getSigners())(fixture))
    })

    it('testSellNoPos', async () => {
      const { position: o1position } = await alice.sell(mkr('1'), dai('500'), 0)
      const { position: o2position } = await alice.sell(mkr('1'), dai('600'), 0)

      // mid price
      const { position: positionMid } = await alice.sell(mkr('1'), dai('550'), 0)
      const { prev: prevMid, next: nextMid } = await orderBook.sellOrder(positionMid)

      expect(prevMid).to.eq(o1position)
      expect(nextMid).to.eq(o2position)
      expect(await orderBook.isSorted()).to.eq(true)

      // best price
      const { position: positionBest } = await alice.sell(mkr('1'), dai('450'), 0)
      const { prev: prevBest, next: nextBest } = await orderBook.sellOrder(positionBest)

      expect(prevBest).to.eq('0')
      expect(nextBest).to.eq(o1position)
      expect(await orderBook.isSorted()).to.eq(true)

      //worst price
      const { position: positionWorst } = await alice.sell(mkr('1'), dai('650'), 0)
      const { prev: prevWorst, next: nextWorst } = await orderBook.sellOrder(positionWorst)

      expect(prevWorst).to.eq(o2position)
      expect(nextWorst).to.eq('0')
      expect(await orderBook.isSorted()).to.eq(true)

      expect(await orderBook.sellDepth()).to.eq(5)
      expect(await orderBook.buyDepth()).to.eq(0)

      expect(await orderBook.daiBalance()).to.eq(dai('0'))
      expect(await orderBook.mkrBalance()).to.eq(mkr('5'))

      expect(await alice.daiDelta()).to.eq(dai('0'))
      //expect(await alice.mkrDelta()).to.eq(mkr('0'))
    })

    it('testSellPosOk', async () => {
      const { position: firstSellPosition } = await alice.sell(mkr('1'), dai('500'), 0)
      const { position: secondSellPosition } = await alice.sell(mkr('1'), dai('600'), 0)

      //mid price
      const { position: thirdSellPosition } = await alice.sell(mkr('1'), dai('550'), secondSellPosition)
      const { prev: prev3, next: next3 } = await orderBook.sellOrder(thirdSellPosition)
      expect(prev3).to.eq(firstSellPosition)
      expect(next3).to.eq(secondSellPosition)
      expect(await orderBook.isSorted()).to.be.true

      //best price
      const { position: fourthSellPosition } = await alice.sell(mkr('1'), dai('450'), firstSellPosition)
      const { prev: prev4, next: next4 } = await orderBook.sellOrder(fourthSellPosition)
      expect(prev4).to.eq(0)
      expect(next4).to.eq(firstSellPosition)
      expect(await orderBook.isSorted()).to.be.true

      //worst price
      const { position: fifthSellPosition } = await alice.sell(mkr('1'), dai('650'), secondSellPosition)
      const { prev: prev5, next: next5 } = await orderBook.sellOrder(fifthSellPosition)
      expect(prev5).to.eq(secondSellPosition)
      expect(next5).to.eq(0)
      expect(await orderBook.isSorted()).to.be.true

      expect(await orderBook.sellDepth()).to.eq(5)
      expect(await orderBook.buyDepth()).to.eq(0)

      expect(await orderBook.daiBalance()).to.eq(dai('0'))
      expect(await orderBook.mkrBalance()).to.eq(mkr('5'))

      expect(await alice.daiDelta()).to.eq(dai('0'))
      //expect(await alice.mkrDelta()).to.eq(mkr('0'))
    })

    it('testSellPosWrong', async () => {
      const { position: firstSellPosition } = await alice.sell(mkr('1'), dai('500'), 0)
      const { position: secondSellPosition } = await alice.sell(mkr('1'), dai('600'), 0)

      //price after pos
      const { position: thirdSellPosition } = await alice.sell(mkr('1'), dai('650'), secondSellPosition)
      const { prev: prev3, next: next3 } = await orderBook.sellOrder(thirdSellPosition)
      expect(prev3).to.eq(secondSellPosition)
      expect(next3).to.eq(0)
      expect(await orderBook.isSorted()).to.be.true

      //price much before pos
      const { position: fourthSellPosition } = await alice.sell(mkr('1'), dai('450'), secondSellPosition)
      const { prev: prev4, next: next4 } = await orderBook.sellOrder(fourthSellPosition)
      expect(prev4).to.eq(0)
      expect(next4).to.eq(firstSellPosition)
      expect(await orderBook.isSorted()).to.be.true

      expect(await orderBook.sellDepth()).to.eq(4)
      expect(await orderBook.buyDepth()).to.eq(0)

      expect(await orderBook.daiBalance()).to.eq(dai('0'))
      expect(await orderBook.mkrBalance()).to.eq(mkr('4'))

      expect(await alice.daiDelta()).to.eq(dai('0'))
      //expect(await alice.mkrDelta()).to.eq(mkr('0'))
    })

    it('testBuyNoPos', async () => {
      const { position: o1position } = await alice.buy(mkr('1'), dai('500'), 0)
      const { position: o2position } = await alice.buy(mkr('1'), dai('600'), 0)

      // mid price
      const { position: positionMid } = await alice.buy(mkr('1'), dai('550'), 0)
      const { prev: prevMid, next: nextMid } = await orderBook.buyOrder(positionMid)

      expect(prevMid).to.eq(o2position)
      expect(nextMid).to.eq(o1position)
      expect(await orderBook.isSorted()).to.eq(true)

      // best price
      const { position: positionBest } = await alice.buy(mkr('1'), dai('450'), 0)
      const { prev: prevBest, next: nextBest } = await orderBook.buyOrder(positionBest)

      expect(prevBest).to.eq(o1position)
      expect(nextBest).to.eq(0)
      expect(await orderBook.isSorted()).to.eq(true)

      //worst price
      const { position: positionWorst } = await alice.buy(mkr('1'), dai('650'), 0)
      const { prev: prevWorst, next: nextWorst } = await orderBook.buyOrder(positionWorst)

      expect(prevWorst).to.eq(0)
      expect(nextWorst).to.eq(o2position)
      expect(await orderBook.isSorted()).to.eq(true)

      expect(await orderBook.sellDepth()).to.eq(0)
      expect(await orderBook.buyDepth()).to.eq(5)

      expect(await orderBook.daiBalance()).to.eq(dai('2750'))
      expect(await orderBook.mkrBalance()).to.eq(mkr('0'))

      //expect(await alice.daiDelta()).to.eq(dai('0'))
      //expect(await alice.mkrDelta()).to.eq(mkr('0'))
    })

    it('testBuyPosOk', async () => {
      const { position: o1position } = await alice.buy(mkr('1'), dai('500'), 0)
      const { position: o2position } = await alice.buy(mkr('1'), dai('600'), 0)

      // mid price
      const { position: positionMid } = await alice.buy(mkr('1'), dai('550'), 0)
      const { prev: prevMid, next: nextMid } = await orderBook.buyOrder(positionMid)

      expect(prevMid).to.eq(o2position)
      expect(nextMid).to.eq(o1position)
      expect(await orderBook.isSorted()).to.eq(true)

      // best price
      const { position: positionBest } = await alice.buy(mkr('1'), dai('650'), 0)
      const { prev: prevBest, next: nextBest } = await orderBook.buyOrder(positionBest)

      expect(prevBest).to.eq(0)
      expect(nextBest).to.eq(o2position)
      expect(await orderBook.isSorted()).to.eq(true)

      //worst price
      const { position: positionWorst } = await alice.buy(mkr('1'), dai('450'), 0)
      const { prev: prevWorst, next: nextWorst } = await orderBook.buyOrder(positionWorst)

      expect(prevWorst).to.eq(o1position)
      expect(nextWorst).to.eq(0)
      expect(await orderBook.isSorted()).to.eq(true)

      expect(await orderBook.sellDepth()).to.eq(0)
      expect(await orderBook.buyDepth()).to.eq(5)

      expect(await orderBook.daiBalance()).to.eq(dai('2750'))
      expect(await orderBook.mkrBalance()).to.eq(mkr('0'))

      // expect(await alice.daiDelta()).to.eq(dai('0'))
      // expect(await alice.mkrDelta()).to.eq(mkr('0'))
    })

    it('testBuyPosWrong', async () => {
      const { position: firstBuyPosition } = await alice.buy(mkr('1'), dai('500'), 0)
      const { position: secondBuyPosition } = await alice.buy(mkr('1'), dai('600'), 0)

      //price after pos
      const { position: thirdBuyPosition } = await alice.buy(mkr('1'), dai('650'), secondBuyPosition)
      const { prev: prev3, next: next3 } = await orderBook.buyOrder(thirdBuyPosition)
      expect(prev3).to.eq(0)
      expect(next3).to.eq(secondBuyPosition)
      expect(await orderBook.isSorted()).to.be.true

      // price much before pos
      const { position: fourthBuyPosition } = await alice.buy(mkr('1'), dai('450'), secondBuyPosition)
      const { prev: prev4, next: next4 } = await orderBook.buyOrder(fourthBuyPosition)
      expect(prev4).to.eq(firstBuyPosition)
      expect(next4).to.eq(0)
      expect(await orderBook.isSorted()).to.be.true

      expect(await orderBook.sellDepth()).to.eq(0)
      expect(await orderBook.buyDepth()).to.eq(4)

      expect(await orderBook.daiBalance()).to.eq(dai('2200'))
      expect(await orderBook.mkrBalance()).to.eq(0)

      // expect(await alice.daiDelta()).to.eq(0)
      // expect(await alice.mkrDelta()).to.eq(0)
    })
  })
})
