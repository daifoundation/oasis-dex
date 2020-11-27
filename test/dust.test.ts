import { expect } from 'chai'
import { ethers } from 'hardhat'

import { OasisBase } from '../typechain/OasisBase'
import { OasisCustomerBase } from './exchange/oasisCustomer'
import { OrderBook } from './exchange/orderBook'
import { internalBalancesMkrDaiFixture } from './fixtures/internalBalances'
import { loadFixtureAdapter } from './fixtures/loadFixture'
import { noEscrowMkrDaiFixture } from './fixtures/noEscrow'
import { dai, mkr } from './utils/units'

;[noEscrowMkrDaiFixture, internalBalancesMkrDaiFixture].forEach((fixture) => {
  context(`Dust / ${fixture.name}`, () => {
    let oasis: OasisBase
    let orderBook: OrderBook
    let alice: OasisCustomerBase
    let bob: OasisCustomerBase
    beforeEach(async () => {
      ;({ orderBook, alice, bob, oasis } = await loadFixtureAdapter(await ethers.getSigners())(fixture))
    })

    it('FailDustControl', async () => {
      const dust = await oasis.dust()
      const tic = await oasis.tic()
      await alice.sell(dust.sub(tic), dai('1'), 0)

      expect(await orderBook.daiBalance()).to.eq(dai('0'))
      expect(await orderBook.mkrBalance()).to.eq(mkr('0'))

      expect(await orderBook.sellDepth()).to.eq(0)
      expect(await orderBook.buyDepth()).to.eq(0)
    })

    it('DustControl', async () => {
      const dust = await oasis.dust()
      await alice.sell(dust, dai('1'), 0)

      expect(await orderBook.daiBalance()).to.eq(dai('0'))
      expect(await orderBook.mkrBalance()).to.eq(mkr('0.1'))

      expect(await orderBook.sellDepth()).to.eq(1)
      expect(await orderBook.buyDepth()).to.eq(0)
    })

    it('SellDustLeft1', async () => {
      await alice.buy(mkr('1'), dai('600'), 0)
      await alice.buy(mkr('1'), dai('500'), 0)

      const { position } = await bob.sell(mkr('1.99999999'), dai('500'), 0)

      expect(position).to.eq('0')

      expect(await orderBook.daiBalance()).to.eq(dai('0'))
      expect(await orderBook.mkrBalance()).to.eq(mkr('0'))
    })

    it('SellDustLeft2', async () => {
      await alice.buy(mkr('1'), dai('600'), 0)
      await alice.buy(mkr('1'), dai('500'), 0)

      const { position } = await bob.sell(mkr('2.00000001'), dai('500'), 0)

      expect(position).to.eq('0')

      expect(await orderBook.daiBalance()).to.eq(dai('0'))
      expect(await orderBook.mkrBalance()).to.eq(mkr('0'))
    })

    it('BuyDustLeft1', async () => {
      await alice.sell(mkr('1'), dai('500'), 0)
      await alice.sell(mkr('1'), dai('600'), 0)

      const { position } = await bob.buy(mkr('1.99999999'), dai('600'), 0)

      expect(position).to.eq('0')

      expect(await orderBook.daiBalance()).to.eq(dai('0'))
      expect(await orderBook.mkrBalance()).to.eq(mkr('0'))
    })

    it('BuyDustLeft2', async () => {
      await alice.sell(mkr('1'), dai('500'), 0)
      await alice.sell(mkr('1'), dai('600'), 0)

      const { position } = await bob.buy(mkr('2.00000001'), dai('600'), 0)

      expect(position).to.eq('0')

      expect(await orderBook.daiBalance()).to.eq(dai('0'))
      expect(await orderBook.mkrBalance()).to.eq(mkr('0'))
    })
  })
})
