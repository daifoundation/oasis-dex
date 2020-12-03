import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'

import { MockToken, OasisTester } from '../typechain'
import { OasisBase } from '../typechain/OasisBase'
import { OrderBook } from './exchange/orderBook'
import { INITIAL_DAI_BALANCE, INITIAL_MKR_BALANCE } from './fixtures/fixtureCommon'
import { internalBalancesMkrDaiFixtureWithoutJoin } from './fixtures/internalBalances'
import { loadFixtureAdapter } from './fixtures/loadFixture'
import { dai, mkr } from './utils/units'

const ID_OF_FIRST_ORDER = 2

describe('test exit in initial balances oasis dex', () => {
  let maker: OasisTester
  let taker: OasisTester
  let oasis: OasisBase
  let baseToken: MockToken
  let quoteToken: MockToken
  let orderBook: OrderBook

  const internalMkrBalance = async (address: string): Promise<BigNumber> => oasis.baseBal(address)
  const internalDaiBalance = async (address: string): Promise<BigNumber> => oasis.quoteBal(address)

  const walletMkrBalance = async (address: string): Promise<BigNumber> => baseToken.balanceOf(address)
  const walletDaiBalance = async (address: string): Promise<BigNumber> => quoteToken.balanceOf(address)

  beforeEach(async () => {
    ;({ orderBook, maker, taker, baseToken, quoteToken, oasis } = await loadFixtureAdapter(await ethers.getSigners())(
      internalBalancesMkrDaiFixtureWithoutJoin,
    ))
  })

  it('join transfers base tokens from wallet to internal balance', async () => {
    await maker.approve(baseToken.address, oasis.address, mkr('200'))

    await maker.join(true, maker.address, mkr('200'))

    expect(await walletMkrBalance(maker.address)).to.eql(INITIAL_MKR_BALANCE.sub(mkr('200')))
    expect(await internalMkrBalance(maker.address)).to.eql(mkr('200'))
  })

  it('join transfers quote tokens from wallet to internal balance', async () => {
    await maker.approve(quoteToken.address, oasis.address, dai('200'))

    await maker.join(false, maker.address, dai('200'))

    expect(await walletDaiBalance(maker.address)).to.eql(INITIAL_DAI_BALANCE.sub(dai('200')))
    expect(await internalDaiBalance(maker.address)).to.eql(dai('200'))
  })

  it('exit transfers base tokens from internal balance to wallet', async () => {
    await maker.approve(baseToken.address, oasis.address, mkr('200'))
    await maker.join(true, maker.address, mkr('200'))

    await maker.exit(true, maker.address, mkr('200'))

    expect(await walletMkrBalance(maker.address)).to.eql(INITIAL_MKR_BALANCE)
    expect(await internalMkrBalance(maker.address)).to.eq(mkr('0'))
  })

  it('exit transfers quote tokens from internal balance to wallet', async () => {
    await maker.approve(quoteToken.address, oasis.address, dai('200'))
    await maker.join(false, maker.address, dai('200'))

    await maker.exit(false, maker.address, dai('200'))

    expect(await walletDaiBalance(maker.address)).to.eql(INITIAL_DAI_BALANCE)
    expect(await internalDaiBalance(maker.address)).to.eq(dai('0'))
  })

  it('cannot exit when not joined', async () => {
    await maker.approve(baseToken.address, oasis.address, mkr('1000'))

    await expect(maker.exit(true, maker.address, mkr('200'))).to.be.revertedWith('sub-underflow')
  })

  it('joins with 0 tokens', async () => {
    await maker.approve(baseToken.address, oasis.address, mkr('100'))

    await maker.join(true, maker.address, mkr('0'))

    expect(await walletMkrBalance(maker.address)).to.eql(INITIAL_MKR_BALANCE)
    expect(await internalMkrBalance(maker.address)).to.eq(mkr('0'))
  })

  it('can exit with 0 tokens', async () => {
    await maker.approve(baseToken.address, oasis.address, mkr('1000'))

    await maker.exit(true, maker.address, mkr('0'))

    expect(await walletMkrBalance(maker.address)).to.eql(INITIAL_MKR_BALANCE)
    expect(await internalMkrBalance(maker.address)).to.eq(mkr('0'))
  })

  it('exit with 0 base tokens after join does not change balances', async () => {
    await maker.approve(baseToken.address, oasis.address, mkr('1000'))
    await maker.join(true, maker.address, mkr('200'))

    await maker.exit(true, maker.address, mkr('0'))

    expect(await walletMkrBalance(maker.address)).to.eql(INITIAL_MKR_BALANCE.sub(mkr('200')))
    expect(await internalMkrBalance(maker.address)).to.eql(mkr('200'))
  })

  it('exit with 0 quote tokens after join does not change balances', async () => {
    await maker.approve(quoteToken.address, oasis.address, dai('1000'))
    await maker.join(false, maker.address, dai('200'))

    await maker.exit(false, maker.address, dai('0'))

    expect(await walletDaiBalance(maker.address)).to.eql(INITIAL_DAI_BALANCE.sub(dai('200')))
    expect(await internalDaiBalance(maker.address)).to.eql(dai('200'))
  })

  it('exits with remaining base tokens after creating order', async () => {
    await maker.approve(baseToken.address, oasis.address, mkr('200'))
    await maker.join(true, maker.address, mkr('200'))
    await maker.limit(mkr('100'), dai('2'), false, 0)

    await maker.exit(true, maker.address, mkr('100'))

    expect(await internalMkrBalance(maker.address)).to.eq(mkr('0'))
    expect(await walletMkrBalance(maker.address)).to.eql(INITIAL_MKR_BALANCE.sub(mkr('100')))
  })

  it('exits with remaining quote tokens after creating order', async () => {
    await maker.approve(quoteToken.address, oasis.address, dai('200'))
    await maker.join(false, maker.address, dai('200'))
    await maker.limit(dai('50'), dai('2'), true, 0)

    await maker.exit(false, maker.address, dai('100'))

    expect(await internalDaiBalance(maker.address)).to.eq(dai('0'))
    expect(await walletDaiBalance(maker.address)).to.eql(INITIAL_DAI_BALANCE.sub(dai('100')))
  })

  it('cannot exit base tokens from pending orders', async () => {
    await maker.approve(baseToken.address, oasis.address, mkr('200'))
    await maker.join(true, maker.address, mkr('200'))
    await maker.limit(mkr('100'), dai('2'), false, 0)

    await expect(maker.exit(true, maker.address, mkr('110'))).to.be.revertedWith('sub-underflow')
  })

  it('cannot exit quote tokens from pending orders', async () => {
    await maker.approve(quoteToken.address, oasis.address, dai('200'))
    await maker.join(false, maker.address, dai('200'))
    await maker.limit(dai('50'), dai('2'), true, 0)

    await expect(maker.exit(false, maker.address, dai('110'))).to.be.revertedWith('sub-underflow')
  })

  it('correctly exits after swap', async () => {
    await maker.approve(baseToken.address, oasis.address, mkr('100'))
    await maker.join(true, maker.address, mkr('100'))
    await maker.limit(mkr('100'), dai('2'), false, 0)

    await taker.approve(quoteToken.address, oasis.address, dai('200'))
    await taker.join(false, taker.address, dai('200'))
    await taker.limit(mkr('100'), dai('2'), true, 0)

    expect(await orderBook.sellDepth()).to.eq(0)
    expect(await orderBook.buyDepth()).to.eq(0)

    await maker.exit(false, maker.address, dai('200'))
    await taker.exit(true, taker.address, mkr('100'))

    expect(await internalMkrBalance(maker.address)).to.eq(mkr('0'))
    expect(await walletMkrBalance(maker.address)).to.eql(INITIAL_MKR_BALANCE.sub(mkr('100')))

    expect(await internalMkrBalance(taker.address)).to.eq(mkr('0'))
    expect(await walletMkrBalance(taker.address)).to.eql(INITIAL_MKR_BALANCE.add(mkr('100')))

    expect(await internalDaiBalance(maker.address)).to.eq(mkr('0'))
    expect(await walletDaiBalance(maker.address)).to.eql(INITIAL_DAI_BALANCE.add(dai('200')))

    expect(await internalDaiBalance(taker.address)).to.eq(mkr('0'))
    expect(await walletDaiBalance(taker.address)).to.eql(INITIAL_DAI_BALANCE.sub(dai('200')))
  })

  it('exits base tokens after cancel', async () => {
    await maker.approve(baseToken.address, oasis.address, mkr('1000'))
    await maker.join(true, maker.address, mkr('200'))
    await maker.limit(mkr('100'), dai('2'), false, 0)

    await maker.cancel(false, ID_OF_FIRST_ORDER)
    await maker.exit(true, maker.address, mkr('200'))

    expect(await walletMkrBalance(maker.address)).to.eql(INITIAL_MKR_BALANCE)
    expect(await internalMkrBalance(maker.address)).to.eq(mkr('0'))
  })

  it('exits quote tokens after cancel', async () => {
    await maker.approve(quoteToken.address, oasis.address, dai('1000'))
    await maker.join(false, maker.address, dai('200'))
    await maker.limit(dai('100'), dai('2'), true, 0)

    await maker.cancel(true, ID_OF_FIRST_ORDER)
    await maker.exit(false, maker.address, dai('200'))

    expect(await walletDaiBalance(maker.address)).to.eql(INITIAL_DAI_BALANCE)
    expect(await internalDaiBalance(maker.address)).to.eq(dai('0'))
  })

  it('exits with transfering base tokens to other wallet', async () => {
    await maker.approve(baseToken.address, oasis.address, mkr('200'))
    await maker.join(true, maker.address, mkr('200'))

    await maker.exit(true, taker.address, mkr('200'))

    expect(await walletMkrBalance(maker.address)).to.eql(INITIAL_MKR_BALANCE.sub(mkr('200')))
    expect(await internalMkrBalance(maker.address)).to.eq(mkr('0'))

    expect(await walletMkrBalance(taker.address)).to.eql(INITIAL_MKR_BALANCE.add(mkr('200')))
    expect(await internalMkrBalance(taker.address)).to.eq(mkr('0'))
  })

  it('exits with transfering quote tokens to other wallet', async () => {
    await maker.approve(quoteToken.address, oasis.address, dai('200'))
    await maker.join(false, maker.address, dai('200'))

    await maker.exit(false, taker.address, dai('200'))

    expect(await walletDaiBalance(maker.address)).to.eql(INITIAL_DAI_BALANCE.sub(dai('200')))
    expect(await internalDaiBalance(maker.address)).to.eq(dai('0'))

    expect(await walletDaiBalance(taker.address)).to.eql(INITIAL_DAI_BALANCE.add(dai('200')))
    expect(await internalDaiBalance(taker.address)).to.eq(dai('0'))
  })
})
