import { expect } from 'chai'
import { ethers } from 'hardhat'

import { OasisBase } from '../typechain/OasisBase'
import { OasisCustomerBase } from './exchange/oasisCustomer'
import { OrderBook } from './exchange/orderBook'
import { loadFixtureAdapter } from './fixtures/loadFixture'
import { noEscrowMkrDaiFixture } from './fixtures/noEscrow'
import { dai, mkr } from './utils/units'

context('no escrow, erc20 MKR/DAI market / DUST TESTS', () => {
  let oasis: OasisBase
  let orderBook: OrderBook
  let alice: OasisCustomerBase
  let bob: OasisCustomerBase
  beforeEach(async () => {
    ;({ oasis, alice, bob } = await loadFixtureAdapter(await ethers.getSigners())(noEscrowMkrDaiFixture))
    orderBook = new OrderBook(oasis)
  })

  it('testFailDustControl', async () => {
    await alice.joinMkr(mkr('1'))
    const dust = await oasis.dust()
    const tic = await oasis.tic()
    await alice.sell(dust.sub(tic), dai('1'), 0)

    expect(await orderBook.daiBalance()).to.eq(dai('0'))
    expect(await orderBook.mkrBalance()).to.eq(mkr('0'))

    expect(await orderBook.sellDepth()).to.eq(0)
    expect(await orderBook.buyDepth()).to.eq(0)
  })

  it('testDustControl', async () => {
    await alice.joinMkr(mkr('1'))
    const dust = await oasis.dust()
    await alice.sell(dust, dai('1'), 0)

    expect(await orderBook.daiBalance()).to.eq(dai('0'))
    expect(await orderBook.mkrBalance()).to.eq(mkr('0.1'))

    expect(await orderBook.sellDepth()).to.eq(1)
    expect(await orderBook.buyDepth()).to.eq(0)
  })

  it('testSellDustLeft1', async () => {
    await alice.joinDai(dai('1100'))
    await alice.buy(mkr('1'), dai('600'), 0)
    await alice.buy(mkr('1'), dai('500'), 0)

    await bob.joinMkr(mkr('2'))
    const { position } = await bob.sell(mkr('1.99999999'), dai('500'), 0)

    expect(position).to.eq('0')

    expect(await orderBook.daiBalance()).to.eq(dai('0'))
    expect(await orderBook.mkrBalance()).to.eq(mkr('0'))
  })

  it('testSellDustLeft2', async () => {
    await alice.joinDai(dai('1100'))
    await alice.buy(mkr('1'), dai('600'), 0)
    await alice.buy(mkr('1'), dai('500'), 0)

    await bob.joinMkr(mkr('2.1'))
    const { position } = await bob.sell(mkr('2.00000001'), dai('500'), 0)

    expect(position).to.eq('0')

    expect(await orderBook.daiBalance()).to.eq(dai('0'))
    expect(await orderBook.mkrBalance()).to.eq(mkr('0'))
  })

  it('testBuyDustLeft1', async () => {
    await alice.joinMkr(mkr('2'))
    await alice.sell(mkr('1'), dai('500'), 0)
    await alice.sell(mkr('1'), dai('600'), 0)

    await bob.joinDai(dai('1100'))
    const { position } = await bob.buy(mkr('1.99999999'), dai('600'), 0)

    expect(position).to.eq('0')

    expect(await orderBook.daiBalance()).to.eq(dai('0'))
    expect(await orderBook.mkrBalance()).to.eq(mkr('0'))
  })

  it('testBuyDustLeft2', async () => {
    await alice.joinMkr(mkr('2.1'))
    await alice.sell(mkr('1'), dai('500'), 0)
    await alice.sell(mkr('1'), dai('600'), 0)

    await bob.joinDai(dai('1200'))
    const { position } = await bob.buy(mkr('2.00000001'), dai('600'), 0)

    expect(position).to.eq('0')

    expect(await orderBook.daiBalance()).to.eq(dai('0'))
    expect(await orderBook.mkrBalance()).to.eq(mkr('0'))
  })
})
