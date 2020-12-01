import { expect } from 'chai'
import { ethers } from 'hardhat'

import { OasisCustomerBase } from '../exchange/oasisCustomer'
import { OrderBook } from '../exchange/orderBook'
import { internalBalancesFixture } from '../fixtures/internalBalances'
import { loadFixtureAdapter } from '../fixtures/loadFixture'
import { noEscrowFixture } from '../fixtures/noEscrow'
import { dai, mkr } from '../utils/units'
;[noEscrowFixture, internalBalancesFixture].forEach((fixture) => {
  context(`Take return values / ${fixture.name}`, () => {
    let alice: OasisCustomerBase
    let bob: OasisCustomerBase
    let orderBook: OrderBook

    beforeEach(async () => {
      ;({ orderBook, alice, bob } = await loadFixtureAdapter(await ethers.getSigners())(fixture))
    })

    it('total is the amount of quote token filled on take', async () => {
      await alice.buy(mkr('1'), dai('600'), 0)

      const { left, total } = await bob.sell(mkr('0.3'), dai('600'), 0)

      expect(left).to.eq(mkr('0'))
      expect(total).to.eq(dai('180'))
    })

    it('left is the amount of base token that has not been matched', async () => {
      await alice.buy(mkr('0.3'), dai('600'), 0)

      const { left, total } = await bob.sell(mkr('1'), dai('600'), 0)

      expect(left).to.eq(mkr('0.7'))
      expect(total).to.eq(dai('180'))
    })

    it('left and total are returned also when order was removed due to dust condition', async () => {
      await alice.buy(mkr('0.3001'), dai('600'), 0)

      const { left, total } = await bob.sell(mkr('0.3'), dai('600'), 0)

      expect(await orderBook.isEmpty()).to.be.true
      expect(left).to.eq(mkr('0'))
      expect(total).to.eq(dai('180'))
    })
  })
})
