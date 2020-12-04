import { expect } from 'chai'
import { ethers } from 'hardhat'

import { OasisBase } from '../typechain/OasisBase'
import { OasisCustomerBase } from './exchange/oasisCustomer'
import { OrderBook } from './exchange/orderBook'
import { internalBalancesFixture } from './fixtures/internalBalances'
import { loadFixtureAdapter } from './fixtures/loadFixture'
import { noEscrowFixture } from './fixtures/noEscrow'
import { dai, mkr } from './utils/units'
;[noEscrowFixture, internalBalancesFixture].forEach((fixture) => {
  context(`dust control / ${fixture.name}`, () => {
    let oasis: OasisBase
    let orderBook: OrderBook
    let alice: OasisCustomerBase
    let bob: OasisCustomerBase
    beforeEach(async () => {
      ;({ orderBook, alice, bob, oasis } = await loadFixtureAdapter(await ethers.getSigners())(fixture))
    })

    it('discards an order with base amount smaller than dust', async () => {
      const dust = await oasis.dust()
      const tic = await oasis.tic()
      await alice.sell(dust.sub(tic), dai('1'), 0)

      expect(await orderBook.daiBalance()).to.eq(dai('0'))
      expect(await orderBook.mkrBalance()).to.eq(mkr('0'))

      expect(await orderBook.sellDepth()).to.eq(0)
      expect(await orderBook.buyDepth()).to.eq(0)
    })

    it('accepts an order with base amount equal to dust', async () => {
      const dust = await oasis.dust()
      await alice.sell(dust, dai('1'), 0)

      expect(await orderBook.daiBalance()).to.eq(dai('0'))
      expect(await orderBook.mkrBalance()).to.eq(mkr('0.1'))

      expect(await orderBook.sellDepth()).to.eq(1)
      expect(await orderBook.buyDepth()).to.eq(0)
    })

    it('removes an order when amount left is smaller than dust (sell)', async () => {
      await alice.buy(mkr('1'), dai('600'), 0)
      await alice.buy(mkr('1'), dai('500'), 0)

      const { position } = await bob.sell(mkr('1.99999999'), dai('500'), 0)

      expect(position).to.eq('0')

      expect(await orderBook.isEmpty()).to.be.true

      expect(await orderBook.daiBalance()).to.eq(dai('0'))
      expect(await orderBook.mkrBalance()).to.eq(mkr('0'))
    })

    it('does not accept a take order that has been matched but less than dust is still left (sell)', async () => {
      await alice.buy(mkr('1'), dai('600'), 0)
      await alice.buy(mkr('1'), dai('500'), 0)

      const { position, left, total } = await bob.sell(mkr('2.00000001'), dai('500'), 0)

      expect(position).to.eq('0')
      expect(left).to.eq(mkr('0.00000001'))
      expect(total).to.eq(mkr('1100'))

      expect(await orderBook.daiBalance()).to.eq(dai('0'))
      expect(await orderBook.mkrBalance()).to.eq(mkr('0'))
    })

    it('removes an order when amount left is smaller than dust (buy)', async () => {
      await alice.sell(mkr('1'), dai('500'), 0)
      await alice.sell(mkr('1'), dai('600'), 0)

      const { position } = await bob.buy(mkr('1.99999999'), dai('600'), 0)

      expect(position).to.eq('0')

      expect(await orderBook.isEmpty()).to.be.true

      expect(await orderBook.daiBalance()).to.eq(dai('0'))
      expect(await orderBook.mkrBalance()).to.eq(mkr('0'))
    })

    it('does not accept a take order that has been matched but less than dust is still left (buy)', async () => {
      await alice.sell(mkr('1'), dai('500'), 0)
      await alice.sell(mkr('1'), dai('600'), 0)

      const { position, left, total } = await bob.buy(mkr('2.00000001'), dai('600'), 0)

      expect(position).to.eq('0')
      expect(left).to.eq(mkr('0.00000001'))
      expect(total).to.eq(mkr('1100'))

      expect(await orderBook.daiBalance()).to.eq(dai('0'))
      expect(await orderBook.mkrBalance()).to.eq(mkr('0'))
    })
  })
})
