import { expect } from 'chai'
import { ethers } from 'hardhat'

import { OasisBase } from '../typechain/OasisBase'
import { OasisCustomerBase } from './exchange/oasisCustomer'
import { OrderBook } from './exchange/orderBook'
import { internalBalancesMkrDaiFixture } from './fixtures/internalBalances'
import { loadFixtureAdapter } from './fixtures/loadFixture'
import {noEscrowMkrDaiFixture} from './fixtures/noEscrow'
import { dai, mkr } from './utils/units';

[noEscrowMkrDaiFixture, internalBalancesMkrDaiFixture].forEach(fixture => {
  context(`no escrow, erc20 MKR/DAI market / TAKE TEST for ${fixture.name}`, () => {
    let oasis: OasisBase
    let orderBook: OrderBook
    let alice: OasisCustomerBase
    let bob: OasisCustomerBase
    beforeEach(async () => {
      ;({ oasis, alice, bob } = await loadFixtureAdapter(await ethers.getSigners())(fixture))
      orderBook = new OrderBook(oasis)
      await alice.joinDai(dai('10000'))
      await alice.joinMkr(mkr('10000'))
      await bob.joinDai(dai('10000'))
      await bob.joinMkr(mkr('10000'))

    })
    it('testSingleSellComplete', async () => {
      await alice.buy(mkr('1'), dai('600'), 0)
      await alice.buy(mkr('1'), dai('500'), 0)
  
      expect(await orderBook.sellDepth()).to.eq(0)
      expect(await orderBook.buyDepth()).to.eq(2)
  
      const { position } = await bob.sell(mkr('1'), dai('600'), 0)
      expect(position).to.eq('0') // order immediately filled
  
      expect(await orderBook.sellDepth()).to.eq(0)
      expect(await orderBook.buyDepth()).to.eq(1)
  
      expect(await orderBook.daiBalance()).to.eq(dai('500'))
      expect(await orderBook.mkrBalance()).to.eq(mkr('0'))
      
      expect(await alice.mkrDelta()).to.eq(mkr('1'))

      expect(await bob.daiDelta()).to.eq(dai('600'))
      expect(await bob.mkrDelta()).to.eq(mkr('-1'))
    })
  
    it('testMultiSellComplete', async () => {
      await alice.buy(mkr('1'), dai('600'), 0)
      await alice.buy(mkr('1'), dai('500'), 0)
  
      const { position } = await bob.sell(mkr('2'), dai('500'), 0)
  
      expect(position).to.eq('0')
  
      expect(await orderBook.sellDepth()).to.eq(0)
      expect(await orderBook.buyDepth()).to.eq(0)
  
      expect(await alice.daiDelta()).to.eq(dai('-1100'))
      expect(await alice.mkrDelta()).to.eq(mkr('2'))
  
      expect(await bob.daiDelta()).to.eq(dai('1100'))
      expect(await bob.mkrDelta()).to.eq(mkr('-2'))
    })
  
    it('testMultiSellCompleteThenMake', async () => {
      await alice.buy(mkr('1'), dai('600'), 0)
      await alice.buy(mkr('1'), dai('500'), 0)
  
      const { position } = await bob.sell(mkr('3'), dai('500'), 0)
  
      expect(position).to.not.eq('0')
  
      expect(await orderBook.sellDepth()).to.eq(1)
      expect(await orderBook.buyDepth()).to.eq(0)
  
      expect(await orderBook.daiBalance()).to.eq(dai('0'))
      expect(await orderBook.mkrBalance()).to.eq(mkr('1'))
  
      expect(await alice.daiDelta()).to.eq(dai('-1100'))
      expect(await alice.mkrDelta()).to.eq(mkr('2'))
  
      expect(await bob.daiDelta()).to.eq(dai('1100'))
    })
  
    it('testSingleSellIncomplete', async () => {
      await alice.buy(mkr('1'), dai('600'), 0)
      await alice.buy(mkr('1'), dai('500'), 0)
  
      expect(await orderBook.daiBalance()).to.eq(dai('1100'))
      expect(await orderBook.sellDepth()).to.eq(0)
      expect(await orderBook.buyDepth()).to.eq(2)
  
      const { position } = await bob.sell(mkr('0.5'), dai('600'), 0)
      expect(position).to.eq('0') // order immediately filled
      expect(await orderBook.sellDepth()).to.eq(0)
      expect(await orderBook.buyDepth()).to.eq(2)
  
      expect(await orderBook.daiBalance()).to.eq(dai('800'))
      expect(await orderBook.mkrBalance()).to.eq(mkr('0'))
  
      expect(await alice.mkrDelta()).to.eq(mkr('0.5'))
  
      expect(await bob.daiDelta()).to.eq(dai('300'))
      expect(await bob.mkrDelta()).to.eq(mkr('-0.5'))
    })
  
    it('testMultiSellIncomplete', async () => {
      await alice.buy(mkr('1'), dai('600'), 0)
      const buyOrder = await alice.buy(mkr('1'), dai('500'), 0)
      expect(await orderBook.daiBalance()).to.eq(dai('1100'))
  
      const { position } = await bob.sell(mkr('1.5'), dai('500'), 0)
  
      expect(position).to.eq('0') // order immediately filled
  
      expect(await orderBook.sellDepth()).to.eq(0)
      expect(await orderBook.buyDepth()).to.eq(1)
  
      const { baseAmt } = await orderBook.buyOrder(buyOrder.position)
      expect(baseAmt).to.eq(mkr('0.5'))
  
      expect(await orderBook.daiBalance()).to.eq(dai('250'))
      expect(await orderBook.mkrBalance()).to.eq(mkr('0'))
  
      expect(await alice.mkrDelta()).to.eq(mkr('1.5'))
  
      expect(await bob.daiDelta()).to.eq(dai('850'))
      expect(await bob.mkrDelta()).to.eq(mkr('-1.5'))
    })
  
    it('testSingleBuyComplete', async () => {
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
  
      expect(await bob.daiDelta()).to.eq(dai('-500'))
      expect(await bob.mkrDelta()).to.eq(mkr('1'))
    })
  
    it('testMultiBuyComplete', async () => {
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
  
    it('testMultiBuyCompleteThenMake', async () => {
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
  
      expect(await bob.mkrDelta()).to.eq(mkr('2'))
    })
  
    it('testSingleBuyIncomplete', async () => {
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
  
      expect(await bob.daiDelta()).to.eq(dai('-250'))
      expect(await bob.mkrDelta()).to.eq(mkr('0.5'))
    })
  
    it('testMultiBuyIncomplete', async () => {  
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
      expect(await bob.daiDelta()).to.eq(dai('-800'))
      expect(await bob.mkrDelta()).to.eq(mkr('1.5'))
    })
  })
})
