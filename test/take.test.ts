import { expect } from 'chai'
import { ethers } from 'hardhat'

import { ERC20, OasisNoEscrowNoAdapters, OasisTester } from '../typechain'
import { OasisCustomer } from './exchange/oasisCustomer'
import { OrderBook } from './exchange/orderBook'
import { loadFixtureAdapter } from './fixtures/loadFixture'
import { noEscrowNoAdapterMkrDaiFixture } from './fixtures/noEscrowNoAdapter'
import { dai, mkr } from './utils/units'

context('no escrow, erc20 MKR/DAI market', () => {
  let oasis: OasisNoEscrowNoAdapters
  let maker: OasisTester
  let taker: OasisTester
  let mkrToken: ERC20
  let daiToken: ERC20
  let orderBook: OrderBook

  beforeEach(async () => {
    ;({ baseToken: mkrToken, quoteToken: daiToken, oasis, maker, taker } = await loadFixtureAdapter(
      await ethers.getSigners(),
    )(noEscrowNoAdapterMkrDaiFixture))
    orderBook = new OrderBook(oasis)
  })

  it('single complete sell', async () => {
    const alice = new OasisCustomer(maker, mkrToken, daiToken)
    const bob = new OasisCustomer(taker, mkrToken, daiToken)
    await alice.joinDai(dai(1100))

    await alice.buy(mkr(1), dai(600), 0)
    await alice.buy(mkr(1), dai(500), 0)

    expect(await orderBook.sellDepth()).to.eq(0)
    expect(await orderBook.buyDepth()).to.eq(2)

    await bob.joinMkr(mkr(1))
    expect(await mkrToken.allowance(taker.address, oasis.address), 'allowance').to.eq(mkr(1))
    const { position } = await bob.sell(mkr(1), dai(600), 0)
    expect(position).to.eq(0) // order immediately filled

    expect(await orderBook.sellDepth()).to.eq(0)
    expect(await orderBook.buyDepth()).to.eq(1)

    expect(await orderBook.daiBalance()).to.eq(dai(500))
    expect(await orderBook.mkrBalance()).to.eq(mkr(0))
    expect(await alice.daiDelta()).to.eq(dai(-600))
    expect(await alice.mkrDelta()).to.eq(mkr(1))
    expect(await bob.daiDelta()).to.eq(dai(600))
    expect(await bob.mkrDelta()).to.eq(mkr(-1))
  })
})

//
// function testSingleSellComplete() public {
//
//   tester1.joinDai(1100 ether);
//   tester1.buy(1 ether, 600 ether, 0);
//   tester1.buy(1 ether, 500 ether, 0);
//
//   assertEq(sellDepth(), 0);
//   assertEq(buyDepth(), 2);
//
//   tester2.joinMkr(1 ether);
//   uint o3 = tester2.sell(1 ether, 600 ether, 0);
//
//   assertEq(o3, 0);
//
//   assertEq(sellDepth(), 0);
//   assertEq(buyDepth(), 1);
//
//   // debug();
//
//   assertEq(orderbookDaiBalance(), 500 ether);
//   assertEq(orderbookMkrBalance(), 0 ether);
//
//   assertEq(daiDelta(tester1), -1100 ether);
//   assertEq(daiBalance(tester1), 0 ether);
//   assertEq(mkrBalance(tester1), 1 ether);
//
//   assertEq(daiBalance(tester2), 600 ether);
//   assertEq(mkrBalance(tester2), 0 ether);
//   assertEq(mkrDelta(tester2), -1 ether);
// }
