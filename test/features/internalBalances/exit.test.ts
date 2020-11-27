import { expect } from 'chai'
import { ethers } from 'hardhat'

import { MockToken, OasisTester } from '../../../typechain'
import { OasisBase } from '../../../typechain/OasisBase'
import { OrderBook } from '../../exchange/orderBook'
import { internalBalancesMkrDaiFixtureWithoutJoin } from '../../fixtures/internalBalances'
import { loadFixtureAdapter } from '../../fixtures/loadFixture'
import { dai, mkr } from '../../utils/units'
describe('test exit in initial balances oasis dex', () => {
  let maker: OasisTester
  let taker: OasisTester
  let oasis: OasisBase
  let baseToken: MockToken
  let quoteToken: MockToken
  let orderBook: OrderBook

  beforeEach(async () => {
    ;({ orderBook, maker, taker, baseToken, quoteToken, oasis } = await loadFixtureAdapter(await ethers.getSigners())(
      internalBalancesMkrDaiFixtureWithoutJoin,
    ))
  })

  it('correctly exits after join', async () => {
    await maker.approve(baseToken.address, oasis.address, (mkr('1000')))
    await maker.join(true, maker.address, mkr('200'))
    
    await expect(maker.exit(true, maker.address, mkr('200'))).to.not.be.reverted
  })

  it('cannot exit when not joined', async () => {
    await maker.approve(baseToken.address, oasis.address, (mkr('1000')))
    
    await expect(maker.exit(true, maker.address, mkr('200'))).to.be.revertedWith('sub-underflow')
  })

  it('can exit with 0 tokens', async () => {
    await maker.approve(baseToken.address, oasis.address, (mkr('1000')))
    
    await expect(maker.exit(true, maker.address, mkr('0'))).to.not.be.reverted
  })
  
  it('correctly exits with remaining tokens after creating order', async () => {
    await maker.approve(baseToken.address, oasis.address, (mkr('1000')))
    await maker.join(true, maker.address, mkr('200'))
    await maker.limit(mkr('100'), dai('2'), false, 0)

    expect(await orderBook.sellDepth()).to.eq(1)
    await expect(maker.exit(true, maker.address, mkr('100'))).to.not.be.reverted
  })
  
  it('cannot exit tokens from pending orders', async () => {
    await maker.approve(baseToken.address, oasis.address, (mkr('1000')))
    await maker.join(true, maker.address, mkr('200'))
    await maker.limit(mkr('100'), dai('2'), false, 0)

    expect(await orderBook.sellDepth()).to.eq(1)
    await expect(maker.exit(true, maker.address, mkr('110'))).to.be.revertedWith('sub-underflow')
  })

  it('correctly exits after swap', async () => {
    await maker.approve(baseToken.address, oasis.address, (mkr('1000')))
    await maker.join(true, maker.address, mkr('100'))
    await maker.limit(mkr('100'), dai('2'), false, 0)

    expect(await orderBook.sellDepth()).to.eq(1)

    await taker.approve(quoteToken.address, oasis.address, (dai('1000')))
    await taker.join(false, taker.address, dai('200'))
    await taker.limit(mkr('100'), dai('2'), true, 0)

    expect(await orderBook.sellDepth()).to.eq(0)
    expect(await orderBook.buyDepth()).to.eq(0)

    await expect(maker.exit(false, maker.address, dai('2'))).to.not.be.reverted
    await expect(taker.exit(true, taker.address, mkr('100'))).to.not.be.reverted
  })

  it('exits after cancel', async () => {
    await maker.approve(baseToken.address, oasis.address, (mkr('1000')))
    await maker.join(true, maker.address, mkr('200'))
    await maker.limit(mkr('100'), dai('2'), false, 0)

    expect(await orderBook.sellDepth()).to.eq(1)
    await maker.cancel(false, 2)

    await expect(maker.exit(true, maker.address, mkr('200'))).to.not.be.reverted
  })

  it('exits after cancel - can exit someone elses tokens', async () => {
    await maker.approve(baseToken.address, oasis.address, (mkr('1000')))
    await maker.join(true, maker.address, mkr('200'))
    await maker.limit(mkr('100'), dai('2'), false, 0)

    expect(await orderBook.sellDepth()).to.eq(1)
    await maker.cancel(false, 2)

    await expect(taker.exit(true, maker.address, mkr('200'))).to.not.be.reverted
  })
})
