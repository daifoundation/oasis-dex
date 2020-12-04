import { expect } from 'chai'
import { constants } from 'ethers'
import { ethers } from 'hardhat'

import OasisNoEscrowArtifact from '../artifacts/contracts/OasisNoEscrow.sol/OasisNoEscrow.json'
import { MockTokenFactory } from '../typechain'
import { deployMkrDaiOasisWithTesters, deployOasisWithTestersAndInitialBalances } from './fixtures/fixtureCommon'
import { erc20WithTransferFromReturningFalse } from './utils/erc20WithTransferFromReturningFalse'
import { dai, mkr } from './utils/units'

async function forNonRevertingTransfers({ failingSide }: { failingSide: 'base' | 'quote' }) {
  const [deployer] = await ethers.getSigners()
  const baseToken =
    failingSide === 'base'
      ? await erc20WithTransferFromReturningFalse(deployer)
      : await new MockTokenFactory(deployer).deploy('DAI', 18)
  const quoteToken =
    failingSide === 'quote'
      ? await erc20WithTransferFromReturningFalse(deployer)
      : await new MockTokenFactory(deployer).deploy('MKR', 18)

  const { maker, taker, oasis, orderBook } = await deployOasisWithTestersAndInitialBalances(
    deployer,
    OasisNoEscrowArtifact,
    baseToken,
    quoteToken,
  )

  if (failingSide === 'base') {
    await taker.approve(quoteToken.address, oasis.address, constants.MaxUint256)
    await maker.approve(quoteToken.address, oasis.address, constants.MaxUint256)
  } else {
    await taker.approve(baseToken.address, oasis.address, constants.MaxUint256)
    await maker.approve(baseToken.address, oasis.address, constants.MaxUint256)
  }

  return { maker, taker, orderBook }
}

async function forRevertingTransfers({ failingSide }: { failingSide: 'base' | 'quote' }) {
  const [deployer] = await ethers.getSigners()
  const { oasis, orderBook, maker, taker, baseToken, quoteToken } = await deployMkrDaiOasisWithTesters(
    deployer,
    OasisNoEscrowArtifact,
  )
  await taker.approve(baseToken.address, oasis.address, failingSide === 'base' ? 0 : constants.MaxUint256)
  await taker.approve(quoteToken.address, oasis.address, failingSide === 'quote' ? 0 : constants.MaxUint256)
  await maker.approve(baseToken.address, oasis.address, failingSide === 'base' ? 0 : constants.MaxUint256)
  await maker.approve(quoteToken.address, oasis.address, failingSide === 'quote' ? 0 : constants.MaxUint256)
  return { maker, taker, orderBook }
}

describe('handle failing transfers in no escrow oasis dex', () => {
  ;[forNonRevertingTransfers, forRevertingTransfers].forEach((withFailingTransfers) => {
    describe(`${withFailingTransfers.name}`, () => {
      it('removes maker order when maker has no allowance - selling', async () => {
        const { maker, taker, orderBook } = await withFailingTransfers({ failingSide: 'base' })

        await maker.limit(mkr('100'), dai('2'), false, 0)
        await taker.limit(mkr('100'), dai('2'), true, 0)

        expect(await orderBook.sellDepth()).to.eq(0)
        expect(await orderBook.buyDepth()).to.eq(1)
      })

      it('removes maker order when maker has no allowance - buying', async () => {
        const { maker, taker, orderBook } = await withFailingTransfers({ failingSide: 'quote' })

        await maker.limit(mkr('100'), dai('2'), true, 0)
        await taker.limit(mkr('100'), dai('2'), false, 0)

        expect(await orderBook.sellDepth()).to.eq(1)
        expect(await orderBook.buyDepth()).to.eq(0)
      })

      it('reverts when taker has no allowance - buying', async () => {
        const { maker, taker } = await withFailingTransfers({ failingSide: 'quote' })

        await maker.limit(mkr('100'), dai('2'), false, 0)
        await expect(taker.limit(mkr('100'), dai('2'), true, 0)).to.be.revertedWith('taker-fault')
      })

      it('reverts when taker has no allowance - selling', async () => {
        const { maker, taker } = await withFailingTransfers({ failingSide: 'base' })

        await maker.limit(mkr('100'), dai('2'), true, 0)
        await expect(taker.limit(mkr('100'), dai('2'), false, 0)).to.be.revertedWith('taker-fault')
      })
    })
  })
})
