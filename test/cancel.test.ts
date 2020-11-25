import { expect } from 'chai'
import { ethers } from 'hardhat'

import { Erc20, OasisTester } from '../typechain'
import { OasisBase } from '../typechain/OasisBase'
import { OasisCustomerNoEscrow } from './exchange/oasisCustomerNoEscrow'
import { OrderBook } from './exchange/orderBook'
import { loadFixtureAdapter } from './fixtures/loadFixture'
import { noEscrowMkrDaiFixture } from './fixtures/noEscrow'
import { dai, mkr } from './utils/units'

context('no escrow, erc20 MKR/DAI market / CANCEL TESTS', () => {
  let oasis: OasisBase
  let maker: OasisTester
  let mkrToken: Erc20
  let daiToken: Erc20
  let orderBook: OrderBook
  let alice: OasisCustomerNoEscrow

  beforeEach(async () => {
    ({ baseToken: mkrToken, quoteToken: daiToken, oasis, maker } = await loadFixtureAdapter(
      await ethers.getSigners(),
    )(noEscrowMkrDaiFixture))
    orderBook = new OrderBook(oasis)
    alice = new OasisCustomerNoEscrow(maker, mkrToken, daiToken)
  })

  it('testFailCancelBuy', async () => {

    await alice.joinDai(dai('5000'))

    await alice.buy(mkr('1'), dai('500'), 0)
    const { position: secondBuyPosition } = await alice.buy(mkr('1'), dai('550'), 0)
    await alice.buy(mkr('1'), dai('600'), 0)

    await alice.cancelBuy(secondBuyPosition)

    expect(await orderBook.isSorted()).to.be.true

    expect(await orderBook.orderExists(secondBuyPosition)).to.be.false
  })

  it('testFailCancelSell', async () => {

    await alice.joinDai(dai('5000'))

    await alice.sell(mkr('1'), dai('500'), 0)
    const { position: secondSellPosition } = await alice.sell(mkr('1'), dai('550'), 0)
    await alice.sell(mkr('1'), dai('600'), 0)

    await alice.cancelSell(secondSellPosition)

    expect(await orderBook.isSorted()).to.be.true

    expect(await orderBook.orderExists(secondSellPosition)).to.be.false
  })
})
