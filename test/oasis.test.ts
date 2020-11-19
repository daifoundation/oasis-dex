import { expect } from 'chai'
import { constants } from 'ethers'
import { ethers } from 'hardhat'

import { MockToken, OasisNoEscrowNoAdapters, OasisTester } from '../typechain'
import { OrderBook } from './exchange/orderBook'
import { loadFixtureAdapter } from './fixtures/loadFixture'
import { noEscrowNoAdapterMkrDaiFixture } from './fixtures/noEscrowNoAdapter'
import { bn, eth } from './utils/units'

describe('oasis dex', () => {
  let maker: OasisTester
  let taker: OasisTester
  let oasis: OasisNoEscrowNoAdapters
  let quoteToken: MockToken
  let orderBook: OrderBook

  beforeEach(async () => {
    ;({ maker, taker, quoteToken, oasis } = await loadFixtureAdapter(await ethers.getSigners())(
      noEscrowNoAdapterMkrDaiFixture,
    ))
    orderBook = new OrderBook(oasis)
  })

  it('adds order to an empty order book', async () => {
    await maker.limit(eth(100), 2, false, 0)
    const headOrder = await orderBook.sellOrder(0)
    const makeOrder = await orderBook.sellOrder(2)
    expect(headOrder).to.deep.include({ prev: bn(2), next: bn(2) })
    expect(makeOrder).to.deep.include({ baseAmt: eth(100), prev: bn(0), next: bn(0) })
  })

  it('removes maker order when maker has no allowance', async () => {
    await maker.limit(eth(100), 2, false, 0)
    await taker.approve(quoteToken.address, oasis.address, constants.MaxUint256)
    await taker.limit(eth(100), 2, true, 0)
    expect(await orderBook.sellDepth()).to.eq(0)
    expect(await orderBook.buyDepth()).to.eq(1)
  })

  it('reverts when taker has no allowance', async () => {
    await maker.limit(eth(100), 2, false, 0)
    await expect(taker.limit(eth(100), 2, true, 0)).to.be.revertedWith('taker-fault')
  })
})
