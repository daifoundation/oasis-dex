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

describe('escrow internal balances', () => {
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

  describe('join', () => {
    it('transfers base tokens from wallet to internal balance', async () => {
      await maker.approve(baseToken.address, oasis.address, mkr('200'))

      await maker.join(true, maker.address, mkr('200'))

      expect(await walletMkrBalance(maker.address)).to.eq(INITIAL_MKR_BALANCE.sub(mkr('200')))
      expect(await internalMkrBalance(maker.address)).to.eq(mkr('200'))
    })

    it('transfers quote tokens from wallet to internal balance', async () => {
      await maker.approve(quoteToken.address, oasis.address, dai('200'))

      await maker.join(false, maker.address, dai('200'))

      expect(await walletDaiBalance(maker.address)).to.eq(INITIAL_DAI_BALANCE.sub(dai('200')))
      expect(await internalDaiBalance(maker.address)).to.eq(dai('200'))
    })

    it('allows for zero amount', async () => {
      await maker.approve(baseToken.address, oasis.address, mkr('100'))

      await maker.join(true, maker.address, mkr('0'))

      expect(await walletMkrBalance(maker.address)).to.eq(INITIAL_MKR_BALANCE)
      expect(await internalMkrBalance(maker.address)).to.eq(mkr('0'))
    })
  })

  describe('exit', () => {
    it('transfers base tokens from internal balance to wallet', async () => {
      await maker.approve(baseToken.address, oasis.address, mkr('200'))
      await maker.join(true, maker.address, mkr('200'))

      await maker.exit(true, maker.address, mkr('200'))

      expect(await walletMkrBalance(maker.address)).to.eq(INITIAL_MKR_BALANCE)
      expect(await internalMkrBalance(maker.address)).to.eq(mkr('0'))
    })

    it('transfers quote tokens from internal balance to wallet', async () => {
      await maker.approve(quoteToken.address, oasis.address, dai('200'))
      await maker.join(false, maker.address, dai('200'))

      await maker.exit(false, maker.address, dai('200'))

      expect(await walletDaiBalance(maker.address)).to.eq(INITIAL_DAI_BALANCE)
      expect(await internalDaiBalance(maker.address)).to.eq(dai('0'))
    })

    it('reverts when not joined', async () => {
      await maker.approve(baseToken.address, oasis.address, mkr('1000'))

      await expect(maker.exit(true, maker.address, mkr('200'))).to.be.revertedWith('sub-underflow')
    })

    it('allows for zero amount', async () => {
      await maker.approve(baseToken.address, oasis.address, mkr('1000'))

      await maker.exit(true, maker.address, mkr('0'))

      expect(await walletMkrBalance(maker.address)).to.eq(INITIAL_MKR_BALANCE)
      expect(await internalMkrBalance(maker.address)).to.eq(mkr('0'))
    })

    it('with 0 base tokens after join does not change balances', async () => {
      await maker.approve(baseToken.address, oasis.address, mkr('1000'))
      await maker.join(true, maker.address, mkr('200'))

      await maker.exit(true, maker.address, mkr('0'))

      expect(await walletMkrBalance(maker.address)).to.eq(INITIAL_MKR_BALANCE.sub(mkr('200')))
      expect(await internalMkrBalance(maker.address)).to.eq(mkr('200'))
    })

    it('with 0 quote tokens after join does not change balances', async () => {
      await maker.approve(quoteToken.address, oasis.address, dai('1000'))
      await maker.join(false, maker.address, dai('200'))

      await maker.exit(false, maker.address, dai('0'))

      expect(await walletDaiBalance(maker.address)).to.eq(INITIAL_DAI_BALANCE.sub(dai('200')))
      expect(await internalDaiBalance(maker.address)).to.eq(dai('200'))
    })

    it('withdraws swapped tokens', async () => {
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
      expect(await walletMkrBalance(maker.address)).to.eq(INITIAL_MKR_BALANCE.sub(mkr('100')))

      expect(await internalMkrBalance(taker.address)).to.eq(mkr('0'))
      expect(await walletMkrBalance(taker.address)).to.eq(INITIAL_MKR_BALANCE.add(mkr('100')))

      expect(await internalDaiBalance(maker.address)).to.eq(mkr('0'))
      expect(await walletDaiBalance(maker.address)).to.eq(INITIAL_DAI_BALANCE.add(dai('200')))

      expect(await internalDaiBalance(taker.address)).to.eq(mkr('0'))
      expect(await walletDaiBalance(taker.address)).to.eq(INITIAL_DAI_BALANCE.sub(dai('200')))
    })

    it('withdraws base tokens after cancel', async () => {
      await maker.approve(baseToken.address, oasis.address, mkr('1000'))
      await maker.join(true, maker.address, mkr('200'))
      await maker.limit(mkr('100'), dai('2'), false, 0)

      await maker.cancel(false, ID_OF_FIRST_ORDER)
      await maker.exit(true, maker.address, mkr('200'))

      expect(await walletMkrBalance(maker.address)).to.eq(INITIAL_MKR_BALANCE)
      expect(await internalMkrBalance(maker.address)).to.eq(mkr('0'))
    })

    it('withdraws quote tokens after cancel', async () => {
      await maker.approve(quoteToken.address, oasis.address, dai('1000'))
      await maker.join(false, maker.address, dai('200'))
      await maker.limit(dai('100'), dai('2'), true, 0)

      await maker.cancel(true, ID_OF_FIRST_ORDER)
      await maker.exit(false, maker.address, dai('200'))

      expect(await walletDaiBalance(maker.address)).to.eq(INITIAL_DAI_BALANCE)
      expect(await internalDaiBalance(maker.address)).to.eq(dai('0'))
    })

    it('allows to transfer base tokens to another wallet', async () => {
      await maker.approve(baseToken.address, oasis.address, mkr('200'))
      await maker.join(true, maker.address, mkr('200'))

      await maker.exit(true, taker.address, mkr('200'))

      expect(await walletMkrBalance(maker.address)).to.eq(INITIAL_MKR_BALANCE.sub(mkr('200')))
      expect(await internalMkrBalance(maker.address)).to.eq(mkr('0'))

      expect(await walletMkrBalance(taker.address)).to.eq(INITIAL_MKR_BALANCE.add(mkr('200')))
      expect(await internalMkrBalance(taker.address)).to.eq(mkr('0'))
    })

    it('allows to transfer quote tokens to another wallet', async () => {
      await maker.approve(quoteToken.address, oasis.address, dai('200'))
      await maker.join(false, maker.address, dai('200'))

      await maker.exit(false, taker.address, dai('200'))

      expect(await walletDaiBalance(maker.address)).to.eq(INITIAL_DAI_BALANCE.sub(dai('200')))
      expect(await internalDaiBalance(maker.address)).to.eq(dai('0'))

      expect(await walletDaiBalance(taker.address)).to.eq(INITIAL_DAI_BALANCE.add(dai('200')))
      expect(await internalDaiBalance(taker.address)).to.eq(dai('0'))
    })

    describe('after an order was placed (base tokens)', () => {
      beforeEach(async () => {
        await maker.approve(baseToken.address, oasis.address, mkr('200'))
        await maker.join(true, maker.address, mkr('200'))
        await maker.limit(mkr('100'), dai('2'), false, 0)
      })
      it('withdraws remaining tokens', async () => {
        await maker.exit(true, maker.address, mkr('100'))

        expect(await internalMkrBalance(maker.address)).to.eq(mkr('0'))
        expect(await walletMkrBalance(maker.address)).to.eq(INITIAL_MKR_BALANCE.sub(mkr('100')))
      })

      it('reverts when tokens are in open orders', async () => {
        await expect(maker.exit(true, maker.address, mkr('110'))).to.be.revertedWith('sub-underflow')
      })
    })
    describe('after an order was placed (quote tokens)', () => {
      beforeEach(async () => {
        await maker.approve(quoteToken.address, oasis.address, dai('200'))
        await maker.join(false, maker.address, dai('200'))
        await maker.limit(dai('50'), dai('2'), true, 0)
      })
      it('withdraws remaining tokens', async () => {
        await maker.exit(false, maker.address, dai('100'))

        expect(await internalDaiBalance(maker.address)).to.eq(dai('0'))
        expect(await walletDaiBalance(maker.address)).to.eq(INITIAL_DAI_BALANCE.sub(dai('100')))
      })
      it('reverts when tokens are in open orders', async () => {
        await expect(maker.exit(false, maker.address, dai('110'))).to.be.revertedWith('sub-underflow')
      })
    })
  })
})
