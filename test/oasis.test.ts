import { expect } from 'chai'
import { constants } from 'ethers'
import { ethers } from 'hardhat'

import { MockToken, OasisNoEscrow, OasisTester } from '../typechain'
import { OasisCustomer } from './exchange/oasisCustomer'
import { OrderBook } from './exchange/orderBook'
import { loadFixtureAdapter } from './fixtures/loadFixture'
import { noEscrowMkrDaiFixture } from './fixtures/noEscrow'
import { bn, dai, eth, mkr } from './utils/units'

describe('oasis dex', () => {
  let maker: OasisTester
  let taker: OasisTester
  let oasis: OasisNoEscrow
  let baseToken: MockToken
  let quoteToken: MockToken
  let orderBook: OrderBook
  let customer: OasisCustomer

  beforeEach(async () => {
    ;({ maker, taker, baseToken, quoteToken, oasis } = await loadFixtureAdapter(await ethers.getSigners())(
      noEscrowMkrDaiFixture,
    ))
    orderBook = new OrderBook(oasis)
    customer = new OasisCustomer(maker, baseToken, quoteToken)
  })

  it('adds order to an empty order book', async () => {
    await maker.limit(eth(100), dai(2), false, 0)
    const headOrder = await orderBook.sellOrder(0)
    const makeOrder = await orderBook.sellOrder(2)
    expect(headOrder).to.deep.include({ prev: bn(2), next: bn(2) })
    expect(makeOrder).to.deep.include({ baseAmt: eth(100), prev: bn(0), next: bn(0) })
  })

  it('sorts buy orders desc', async () => {
    await customer.buy(mkr(1), dai(400), 0)
    await customer.buy(mkr(1), dai(500), 0)
    expect((await orderBook.buyOrderAtIndex(0)).price).to.eql(dai(500))
    expect((await orderBook.buyOrderAtIndex(1)).price).to.eql(dai(400))
  })

  it('sorts sell orders asc', async () => {
    await customer.sell(mkr(1), dai(500), 0)
    await customer.sell(mkr(1), dai(400), 0)
    expect((await orderBook.sellOrderAtIndex(0)).price).to.eql(dai(400))
    expect((await orderBook.sellOrderAtIndex(1)).price).to.eql(dai(500))
  })

  it('removes maker order when maker has no allowance', async () => {
    await maker.limit(eth(100), dai(2), false, 0)
    await taker.approve(quoteToken.address, oasis.address, constants.MaxUint256)
    await taker.limit(eth(100), dai(2), true, 0)
    expect(await orderBook.sellDepth()).to.eq(0)
    expect(await orderBook.buyDepth()).to.eq(1)
  })

  it('reverts when taker has no allowance', async () => {
    await maker.limit(eth(100), dai(2), false, 0)
    await expect(taker.limit(eth(100), dai(2), true, 0)).to.be.revertedWith('taker-fault')
  })
})
