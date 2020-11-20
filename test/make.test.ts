import { expect } from 'chai'
import { ethers } from 'hardhat'

import { Erc20, OasisNoEscrowNoAdapters, OasisTester } from '../typechain'
import { OasisCustomer } from './exchange/oasisCustomer'
import { OrderBook } from './exchange/orderBook'
import { loadFixtureAdapter } from './fixtures/loadFixture'
import { noEscrowNoAdapterMkrDaiFixture } from './fixtures/noEscrowNoAdapter'
import { dai, mkr } from './utils/units'

context('no escrow, erc20 MKR/DAI market', () => {
  let oasis: OasisNoEscrowNoAdapters
  let maker: OasisTester
  let mkrToken: Erc20
  let daiToken: Erc20
  let orderBook: OrderBook
  let alice: OasisCustomer
  beforeEach(async () => {
    ({ baseToken: mkrToken, quoteToken: daiToken, oasis, maker } = await loadFixtureAdapter(
      await ethers.getSigners(),
    )(noEscrowNoAdapterMkrDaiFixture))
    orderBook = new OrderBook(oasis)
    alice = new OasisCustomer(maker, mkrToken, daiToken)
  })

  it('testSellNoPos', async () => {
    await alice.joinMkr(mkr(5));

    const {position: o1position} = await alice.sell(mkr(1), dai(500), 0);
    const {position: o2position} = await alice.sell(mkr(1), dai(600), 0);

    // mid price
    const {position: positionMid} = await alice.sell(mkr(1), dai(550), 0);
    const {prev: prevMid, next: nextMid} = await orderBook.sellOrder(positionMid)

    expect(prevMid).to.eq(o1position);
    expect(nextMid).to.eq(o2position);
    expect(await orderBook.isSorted()).to.eq(true);

    // best price
    const {position: positionBest} = await alice.sell(mkr(1), dai(450), 0);
    const {prev: prevBest, next: nextBest} = await orderBook.sellOrder(positionBest)
   
    expect(prevBest).to.eq(0);
    expect(nextBest).to.eq(o1position);
    expect(await orderBook.isSorted()).to.eq(true);

    //worst price
    const {position: positionWorst} = await alice.sell(mkr(1), dai(650), 0);
    const {prev: prevWorst, next: nextWorst} = await orderBook.sellOrder(positionWorst)
    
    expect(prevWorst).to.eq(o2position);
    expect(nextWorst).to.eq(0);
    expect(await orderBook.isSorted()).to.eq(true);

    expect(await orderBook.sellDepth()).to.eq(5)
    expect(await orderBook.buyDepth()).to.eq(0)

    expect(await orderBook.daiBalance()).to.eq(dai(0))
    expect(await orderBook.mkrBalance()).to.eq(mkr(5))

    expect(await alice.daiDelta()).to.eq(dai(0))
    expect(await alice.mkrDelta()).to.eq(mkr(0))
  });

  it('testBuyNoPos', async () => {
    await alice.joinDai(dai(2750));

    const {position: o1position} = await alice.buy(mkr(1), dai(500), 0);
    const {position: o2position} = await alice.buy(mkr(1), dai(600), 0);

    // mid price
    const {position: positionMid} = await alice.buy(mkr(1), dai(550), 0);
    const {prev: prevMid, next: nextMid} = await orderBook.buyOrder(positionMid);
 
    expect(prevMid).to.eq(o2position);
    expect(nextMid).to.eq(o1position);
    expect(await orderBook.isSorted()).to.eq(true);

    // best price
    const {position: positionBest} = await alice.buy(mkr(1), dai(450), 0);
    const {prev: prevBest, next: nextBest} = await orderBook.buyOrder(positionBest)
    
    expect(prevBest).to.eq(o1position);
    expect(nextBest).to.eq(0);
    expect(await orderBook.isSorted()).to.eq(true);

    //worst price
    const {position: positionWorst} = await alice.buy(mkr(1), dai(650), 0);
    const {prev: prevWorst, next: nextWorst} = await orderBook.buyOrder(positionWorst)
    
    expect(prevWorst).to.eq(0);
    expect(nextWorst).to.eq(o2position);
    expect(await orderBook.isSorted()).to.eq(true);

    expect(await orderBook.sellDepth()).to.eq(0)
    expect(await orderBook.buyDepth()).to.eq(5)

    expect(await orderBook.daiBalance()).to.eq(dai(2750))
    expect(await orderBook.mkrBalance()).to.eq(mkr(0))

    expect(await alice.daiDelta()).to.eq(dai(0))
    expect(await alice.mkrDelta()).to.eq(mkr(0))
  })
})