import { expect } from 'chai'
import { ethers } from 'hardhat'

import { Erc20, OasisNoEscrowNoAdapters, OasisTester } from '../typechain'
import { OasisCustomer } from './exchange/oasisCustomer'
import { OrderBook } from './exchange/orderBook'
import { loadFixtureAdapter } from './fixtures/loadFixture'
import { noEscrowNoAdapterMkrDaiFixtureForTests } from './fixtures/noEscrowNoAdapter'
import { dai, mkr } from './utils/units'

context('no escrow, erc20 MKR/DAI market / OVERFLOW PROTECTION TEST', () => {
  let oasis: OasisNoEscrowNoAdapters
  let maker: OasisTester
  let taker: OasisTester
  let mkrToken: Erc20
  let daiToken: Erc20
  let orderBook: OrderBook
  let alice: OasisCustomer
  let bob: OasisCustomer
  beforeEach(async () => {
    ;({ baseToken: mkrToken, quoteToken: daiToken, oasis, maker, taker } = await loadFixtureAdapter(
      await ethers.getSigners(),
    )(noEscrowNoAdapterMkrDaiFixtureForTests))
    orderBook = new OrderBook(oasis)
    alice = new OasisCustomer(maker, mkrToken, daiToken)
    bob = new OasisCustomer(taker, mkrToken, daiToken)
  })

  it('testFailMakeOverflow(passesInOurImplementation)', async () => {
    await alice.joinMkr(mkr(1))

    await alice.sell(mkr(0.99999999999999999), dai(500.01), 0)

    expect(await orderBook.sellDepth()).to.be.eql(1)
  })

  it('testFailTakeOverflow(passesInOurImplementation)', async () => {
    await alice.joinMkr(mkr(1))

    await alice.sell(mkr(1), dai(500), 0)

    await bob.joinDai(dai(601))
    await bob.buy(mkr(0.99999999999999999), dai(600.01), 0)

    expect(await bob.mkrDelta()).to.be.eql(mkr(1))
    expect(await alice.daiDelta()).to.be.eql(dai(500))
  })
})
