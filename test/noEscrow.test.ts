import { expect } from 'chai'
import { constants, Signer } from 'ethers'
import { ethers, waffle } from 'hardhat'

import ERC20AdapterArtifact from '../artifacts/contracts/ERC20Adapter.sol/ERC20Adapter.json'
import MockSTAdapterArtifact from '../artifacts/contracts/mocks/MockSTAdapter.sol/MockSTAdapter.json'
import OasisNoEscrowArtifact from '../artifacts/contracts/OasisNoEscrow.sol/OasisNoEscrow.json'
import {
  Erc20Adapter,
  Erc20AdapterFactory,
  MockStAdapter,
  MockStWhitelistAdapterFactory,
  MockTokenFactory,
  MockWhitelistToken,
  MockWhitelistTokenFactory,
} from '../typechain'
import { Erc20Like } from '../typechain/Erc20Like'
import { OasisCustomerNoEscrow } from './exchange/oasisCustomerNoEscrow'
import { deployOasisWithTestersAndInitialBalances } from './fixtures/fixtureCommon'
import { erc20WithRevertingTransferFrom, erc20WithTransferFromReturningFalse } from './utils/erc20WithFailingTransfers'
import { dai, mkr } from './utils/units'

const { deployContract } = waffle

function withFailingTransfers(deployMockedToken: (deployer: Signer) => Promise<Erc20Like>) {
  return async function ({ failingSide }: { failingSide: 'base' | 'quote' }) {
    const [deployer] = await ethers.getSigners()
    const baseToken =
      failingSide === 'base'
        ? await deployMockedToken(deployer)
        : await new MockTokenFactory(deployer).deploy('DAI', 18)
    const quoteToken =
      failingSide === 'quote'
        ? await deployMockedToken(deployer)
        : await new MockTokenFactory(deployer).deploy('MKR', 18)

    const baseAdapter = (await deployContract(deployer, MockSTAdapterArtifact)) as MockStAdapter
    const quoteAdapter = (await deployContract(deployer, ERC20AdapterArtifact)) as Erc20Adapter

    const { maker, taker, oasis, orderBook } = await deployOasisWithTestersAndInitialBalances(
      deployer,
      OasisNoEscrowArtifact,
      baseToken,
      quoteToken,
      baseAdapter,
      quoteAdapter,
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
}

const forNonRevertingTransfers = withFailingTransfers(erc20WithTransferFromReturningFalse)
const forRevertingTransfers = withFailingTransfers(erc20WithRevertingTransferFrom)

describe('no escrow oasis dex', () => {
  describe('handles failing transfers', () => {
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
  describe('with whitelist', () => {
    let alice: OasisCustomerNoEscrow
    let bob: OasisCustomerNoEscrow
    let baseToken: MockWhitelistToken

    beforeEach(async () => {
      const [deployer] = await ethers.getSigners()
      baseToken = await new MockWhitelistTokenFactory(deployer).deploy('DAI', 18)
      const quoteToken = await new MockTokenFactory(deployer).deploy('MKR', 18)
      const baseAdapter = await new MockStWhitelistAdapterFactory(deployer).deploy()
      const quoteAdapter = await new Erc20AdapterFactory(deployer).deploy()

      const { maker, taker } = await deployOasisWithTestersAndInitialBalances(
        deployer,
        OasisNoEscrowArtifact,
        baseToken,
        quoteToken,
        baseAdapter,
        quoteAdapter,
      )

      alice = new OasisCustomerNoEscrow(maker, baseToken, quoteToken)
      bob = new OasisCustomerNoEscrow(taker, baseToken, quoteToken)
    })

    it('does not allow make when not whitelisted', async () => {
      await expect(alice.buy(mkr('100'), dai('2'))).to.be.revertedWith('taker-not-whitelisted')
    })

    it('does not allow take when not whitelisted', async () => {
      await baseToken.addToWhitelist(alice.address)
      await alice.joinDai(dai('200'))
      await alice.buy(mkr('100'), dai('2'))

      await expect(bob.sell(mkr('100'), dai('2'))).to.be.revertedWith('taker-not-whitelisted')
    })
  })
})
