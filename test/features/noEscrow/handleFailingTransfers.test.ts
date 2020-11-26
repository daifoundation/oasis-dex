import { expect } from 'chai'
import { constants } from 'ethers'
import { ethers } from 'hardhat'

import { MockToken, MockTokenFactory, OasisNoEscrowFactory, OasisTester, OasisTesterFactory } from '../../../typechain'
import { OasisBase } from '../../../typechain/OasisBase'
import { OrderBook } from '../../exchange/orderBook'
import { loadFixtureAdapter } from '../../fixtures/loadFixture'
import { noEscrowMkrDaiFixtureWithoutJoin } from '../../fixtures/noEscrow'
import { erc20WithTransferFromReturningFalse } from '../../utils/mockERC20'
import { dai, eth, mkr } from '../../utils/units'

describe('handle failing transfers in no escrow oasis dex',() => {
  describe('with reverting transfers', () => {
    let maker: OasisTester
    let taker: OasisTester
    let oasis: OasisBase
    let baseToken: MockToken
    let quoteToken: MockToken
    let orderBook: OrderBook

    beforeEach(async () => {
      ; ({ orderBook, maker, taker, baseToken, quoteToken, oasis } = await loadFixtureAdapter(await ethers.getSigners())(
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

  describe('with transfers returning false', () => {
    const withFailingTransfers = async ({ failingSide }: { failingSide: 'base' | 'quote' }) => {
      const [deployer] = await ethers.getSigners()
      let baseToken, quoteToken
      if (failingSide === 'quote') {
        baseToken = await (new MockTokenFactory(deployer).deploy('MKRmkr', 18))
        quoteToken = await erc20WithTransferFromReturningFalse(deployer)
      }
      else {
        baseToken = await erc20WithTransferFromReturningFalse(deployer)
        quoteToken = await (new MockTokenFactory(deployer).deploy('DAI', 18))
      }
      const oasis = await new OasisNoEscrowFactory(deployer).deploy(baseToken.address, quoteToken.address, dai('1').div(100), 1)
      const orderBook = new OrderBook(oasis)
      const maker = await new OasisTesterFactory(deployer).deploy(oasis.address)
      const taker = await new OasisTesterFactory(deployer).deploy(oasis.address)

      if (failingSide === 'base') {
        await quoteToken.transfer(taker.address, dai('10000'))
        await quoteToken.transfer(maker.address, dai('10000'))
      } else {
        await baseToken.transfer(taker.address, mkr('10000'))
        await baseToken.transfer(maker.address, mkr('10000'))
      }
      return { maker, taker, orderBook, quoteToken, baseToken, oasis }
    }

    it('removes maker order when maker has no allowance - selling', async () => {
      const { maker, taker, orderBook, quoteToken, oasis } = await withFailingTransfers({ failingSide: 'base' })

      await maker.limit(eth('100'), dai('2'), false, 0)

      await taker.approve(quoteToken.address, oasis.address, constants.MaxUint256)
      await taker.limit(eth('100'), dai('2'), true, 0)

      expect(await orderBook.sellDepth()).to.eq(0)
      expect(await orderBook.buyDepth()).to.eq(1)
    })

    it('removes maker order when maker has no allowance - buying', async () => {
      const { maker, taker, orderBook, baseToken, oasis } = await withFailingTransfers({ failingSide: 'quote' })

      await maker.limit(eth('100'), dai('2'), true, 0)

      await taker.approve(baseToken.address, oasis.address, constants.MaxUint256)
      await taker.limit(eth('100'), dai('2'), false, 0)

      expect(await orderBook.sellDepth()).to.eq(1)
      expect(await orderBook.buyDepth()).to.eq(0)
    })

    it('reverts when taker has no allowance - buying', async () => {
      const { maker, taker, baseToken, oasis } = await withFailingTransfers({ failingSide: 'quote' })

      await maker.approve(baseToken.address, oasis.address, constants.MaxUint256)
      await maker.limit(eth('100'), dai('2'), false, 0)

      await expect(taker.limit(eth('100'), dai('2'), true, 0)).to.be.revertedWith('taker-fault')
    })

    it('reverts when taker has no allowance - selling', async () => {
      const { maker, taker, quoteToken, oasis } = await withFailingTransfers({ failingSide: 'base' })

      await maker.approve(quoteToken.address, oasis.address, constants.MaxUint256)
      await maker.limit(eth('100'), dai('2'), true, 0)

      await expect(taker.limit(eth('100'), dai('2'), false, 0)).to.be.revertedWith('taker-fault')
    })
  })
})
