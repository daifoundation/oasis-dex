import { expect } from 'chai'
import { constants } from 'ethers'
import { ethers } from 'hardhat'

import { MockToken, OasisTester } from '../../../typechain'
import { OasisBase } from '../../../typechain/OasisBase'
import { OrderBook } from '../../exchange/orderBook'
import { loadFixtureAdapter } from '../../fixtures/loadFixture'
import { noEscrowMkrDaiFixtureWithoutJoin } from '../../fixtures/noEscrow'
import { dai,eth } from '../../utils/units'

describe('handle failing transfers in no escrow oasis dex', () => {
  let maker: OasisTester
  let taker: OasisTester
  let oasis: OasisBase
  let baseToken: MockToken
  let quoteToken: MockToken
  let orderBook: OrderBook

  beforeEach(async () => {
    ;({ orderBook, maker, taker, baseToken, quoteToken, oasis } = await loadFixtureAdapter(await ethers.getSigners())(
      noEscrowMkrDaiFixtureWithoutJoin,
    ))
  })

it('removes maker order when maker has no allowance - selling', async () => {
    await maker.limit(eth('100'), dai('2'), false, 0)

    await taker.approve(quoteToken.address, oasis.address, constants.MaxUint256)
    await taker.limit(eth('100'), dai('2'), true, 0)

    expect(await orderBook.sellDepth()).to.eq(0)
    expect(await orderBook.buyDepth()).to.eq(1)
  })

  it('removes maker order when maker has no allowance - buying', async () => {
    await maker.limit(eth('100'), dai('2'), true, 0)

    await taker.approve(baseToken.address, oasis.address, constants.MaxUint256)
    await taker.limit(eth('100'), dai('2'), false, 0)

    expect(await orderBook.sellDepth()).to.eq(1)
    expect(await orderBook.buyDepth()).to.eq(0)
  })

  it('reverts when taker has no allowance - buying', async () => {
    await maker.approve(baseToken.address, oasis.address, constants.MaxUint256)
    await maker.limit(eth('100'), dai('2'), false, 0)

    await expect(taker.limit(eth('100'), dai('2'), true, 0)).to.be.revertedWith('taker-fault')
  })

  it('reverts when taker has no allowance - selling', async () => {
    await maker.approve(quoteToken.address, oasis.address, constants.MaxUint256)
    await maker.limit(eth('100'), dai('2'), true, 0)

    await expect(taker.limit(eth('100'), dai('2'), false, 0)).to.be.revertedWith('taker-fault')
  })
})
