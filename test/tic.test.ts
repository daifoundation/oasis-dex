import { expect } from 'chai'
import { ethers } from 'hardhat'

import { Erc20, OasisNoEscrowNoAdapters, OasisTester } from '../typechain'
import { OasisCustomer } from './exchange/oasisCustomer'
import { OrderBook } from './exchange/orderBook'
import { loadFixtureAdapter } from './fixtures/loadFixture'
import { noEscrowNoAdapterMkrDaiFixtureForTests } from './fixtures/noEscrowNoAdapter'
import { dai, mkr } from './utils/units'

context('no escrow, erc20 MKR/DAI market / TIC TESTS', () => {
  let oasis: OasisNoEscrowNoAdapters
  let maker: OasisTester
  let mkrToken: Erc20
  let daiToken: Erc20
  let orderBook: OrderBook
  let alice: OasisCustomer
  beforeEach(async () => {
    ;({ baseToken: mkrToken, quoteToken: daiToken, oasis, maker } = await loadFixtureAdapter(await ethers.getSigners())(
      noEscrowNoAdapterMkrDaiFixtureForTests,
    ))
    orderBook = new OrderBook(oasis)
    alice = new OasisCustomer(maker, mkrToken, daiToken)
  })

  it('testTicControl', async () => {
    await alice.joinMkr(mkr(1))

    const tic = await oasis.tic()
    const transaction = alice.sell(mkr(1), dai(1).add(tic), 0)

    await expect(transaction).to.not.be.reverted

    expect(await orderBook.daiBalance()).to.eq(dai(0))
    expect(await orderBook.mkrBalance()).to.eq(mkr(1))

    expect(await orderBook.sellDepth()).to.eq(1)
    expect(await orderBook.buyDepth()).to.eq(0)
  })

  it('testFailTicControl', async () => {
    await alice.joinMkr(mkr(1))
    const tic = await oasis.tic()
    const transaction = alice.sell(mkr(1), dai(1).add(tic).sub(1), 0)

    await expect(transaction).to.be.revertedWith('tic')
  })
})
