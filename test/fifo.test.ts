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
    describe('when selling', () => {
      it('matches the buy offer that was created earlier', async () => {
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

      it('fully matches the buy offer that was created earlier and partially the newer one', async () => {
        const {position: aliceFirstBuy} = await alice.buy(mkr('1'), dai('500'), 0)
        const {position: aliceSecondBuy} = await alice.buy(mkr('1'), dai('500'), 0)
  
        expect(await orderBook.sellDepth()).to.eq(0)
        expect(await orderBook.buyDepth()).to.eq(2)
        
        await bob.sell(mkr('1.3'), dai('400'), 0)
        
        expect(await orderBook.sellDepth()).to.eq(0)
        expect(await orderBook.buyDepth()).to.eq(1)
  
        const firstBuyExists = await orderBook.orderExists(aliceFirstBuy)
        const secondBuyExists = await orderBook.orderExists(aliceSecondBuy)
  
        expect(firstBuyExists).to.be.false
        expect(secondBuyExists).to.be.true
  
        expect(await orderBook.daiBalance()).to.eq(dai("350"))
      })

      it('matches buy order that was crated second after the first buy order was canceled', async ()=> {
        const {position: aliceFirstBuy} = await alice.buy(mkr('1'), dai('500'), 0)
        const {position: aliceSecondBuy} = await alice.buy(mkr('1'), dai('500'), 0)
        const {position: aliceThirdBuy} = await alice.buy(mkr('1'), dai('500'), 0)
        
        expect(await orderBook.buyDepth()).to.eq(3)
        
        await alice.cancelBuy(aliceFirstBuy)
  
        expect(await orderBook.buyDepth()).to.eq(2)
  
        await bob.sell(mkr('1'), dai('500'), 0)
  
        expect(await orderBook.buyDepth()).to.eq(1)
        
        expect(await orderBook.orderExists(aliceFirstBuy)).to.be.false
        expect(await orderBook.orderExists(aliceSecondBuy)).to.be.false
        expect(await orderBook.orderExists(aliceThirdBuy)).to.be.true
  
        expect(await orderBook.daiBalance()).to.eq(dai("500"))
      })
      it('matches buy order that was crated first after the second buy order was canceled', async ()=> {
        const {position: aliceFirstBuy} = await alice.buy(mkr('1'), dai('500'), 0)
        const {position: aliceSecondBuy} = await alice.buy(mkr('1'), dai('500'), 0)
        const {position: aliceThirdBuy} = await alice.buy(mkr('1'), dai('500'), 0)
          
        expect(await orderBook.buyDepth()).to.eq(3)
          
        await alice.cancelBuy(aliceSecondBuy)
    
        await bob.sell(mkr('1'), dai('500'), 0)
    
        expect(await orderBook.buyDepth()).to.eq(1)
          
        expect(await orderBook.orderExists(aliceFirstBuy)).to.be.false
        expect(await orderBook.orderExists(aliceSecondBuy)).to.be.false
        expect(await orderBook.orderExists(aliceThirdBuy)).to.be.true
    
        expect(await orderBook.daiBalance()).to.eq(dai("500"))
      })
    })
    describe('when buying', () => {
      it('matches the sell offer that was created earlier', async () => {
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

      it('fully matches the sell offer that was created earlier and partially the newer one', async () => {
        const {position: aliceFirstSell} = await alice.sell(mkr('1'), dai('500'), 0)
        const {position: aliceSecondSell} = await alice.sell(mkr('1'), dai('500'), 0)
  
        expect(await orderBook.sellDepth()).to.eq(2)
        expect(await orderBook.buyDepth()).to.eq(0)
        
        await bob.buy(mkr('1.3'), dai('600'), 0)
        
        expect(await orderBook.sellDepth()).to.eq(1)
        expect(await orderBook.buyDepth()).to.eq(0)
  
        const firstSellExists = await orderBook.orderExists(aliceFirstSell)
        const secondSellExists = await orderBook.orderExists(aliceSecondSell)
  
        expect(firstSellExists).to.be.false
        expect(secondSellExists).to.be.true
  
        expect(await orderBook.mkrBalance()).to.eq(mkr("0.7"))
      })

      it('matches sell order that was crated second after the first sell order was canceled', async ()=> {
        const {position: aliceFirstSell} = await alice.sell(mkr('1'), dai('500'), 0)
        const {position: aliceSecondSell} = await alice.sell(mkr('1'), dai('500'), 0)
        const {position: aliceThirdSell} = await alice.sell(mkr('1'), dai('500'), 0)
        
        expect(await orderBook.sellDepth()).to.eq(3)
        
        await alice.cancelSell(aliceFirstSell)
  
        await bob.buy(mkr('1'), dai('500'), 0)
  
        expect(await orderBook.sellDepth()).to.eq(1)
        
        expect(await orderBook.orderExists(aliceFirstSell)).to.be.false
        expect(await orderBook.orderExists(aliceSecondSell)).to.be.false
        expect(await orderBook.orderExists(aliceThirdSell)).to.be.true
  
        expect(await orderBook.mkrBalance()).to.eq(mkr("1"))
      })

      it('matches sell order that was crated first after the second sell order was canceled', async ()=> {
        const {position: aliceFirstSell} = await alice.sell(mkr('1'), dai('500'), 0)
        const {position: aliceSecondSell} = await alice.sell(mkr('1'), dai('500'), 0)
        const {position: aliceThirdSell} = await alice.sell(mkr('1'), dai('500'), 0)
        
        expect(await orderBook.sellDepth()).to.eq(3)
        
        await alice.cancelSell(aliceSecondSell)

        await bob.buy(mkr('1'), dai('500'), 0)
  
        expect(await orderBook.sellDepth()).to.eq(1)

        expect(await orderBook.orderExists(aliceFirstSell)).to.be.false
        expect(await orderBook.orderExists(aliceSecondSell)).to.be.false
        expect(await orderBook.orderExists(aliceThirdSell)).to.be.true
  
        expect(await orderBook.mkrBalance()).to.eq(mkr("1"))
      })
    })
  })
})
