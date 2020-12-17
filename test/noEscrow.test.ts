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
  OasisTester,
} from '../typechain'
import { Erc20Like } from '../typechain/Erc20Like'
import { OasisCustomerNoEscrow } from './exchange/oasisCustomerNoEscrow'
import { OrderBook } from './exchange/orderBook'
import { deployOasisWithTestersAndInitialBalances } from './fixtures/fixtureCommon'
import { loadFixtureAdapter } from './fixtures/loadFixture'
import { noEscrowWithoutJoinFixture } from './fixtures/noEscrow'
import { erc20WithRevertingTransferFrom, erc20WithTransferFromReturningFalse } from './utils/erc20WithFailingTransfers'
import { dai, mkr } from './utils/units'

const { AddressZero } = ethers.constants
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

const forNonRevertingTransfers = {
  fixture: withFailingTransfers(erc20WithTransferFromReturningFalse),
  description: 'for transfers returning false',
}
const forRevertingTransfers = {
  fixture: withFailingTransfers(erc20WithRevertingTransferFrom),
  description: 'for reverting transfers',
}

describe('no escrow oasis dex', () => {
  describe('handles failing transfers', () => {
    ;[forNonRevertingTransfers, forRevertingTransfers].forEach(({ fixture, description }) => {
      describe(description, () => {
        it('removes maker order when maker has no allowance - selling', async () => {
          const { maker, taker, orderBook } = await fixture({ failingSide: 'base' })

          await maker.limit(mkr('100'), dai('2'), false, 0)
          await taker.limit(mkr('100'), dai('2'), true, 0)

          expect(await orderBook.sellDepth()).to.eq(0)
          expect(await orderBook.buyDepth()).to.eq(1)
        })

        it('removes maker order when maker has no allowance - buying', async () => {
          const { maker, taker, orderBook } = await fixture({ failingSide: 'quote' })

          await maker.limit(mkr('100'), dai('2'), true, 0)
          await taker.limit(mkr('100'), dai('2'), false, 0)

          expect(await orderBook.sellDepth()).to.eq(1)
          expect(await orderBook.buyDepth()).to.eq(0)
        })

        it('reverts when taker has no allowance - buying', async () => {
          const { maker, taker } = await fixture({ failingSide: 'quote' })

          await maker.limit(mkr('100'), dai('2'), false, 0)
          await expect(taker.limit(mkr('100'), dai('2'), true, 0)).to.be.revertedWith('taker-fault')
        })

        it('reverts when taker has no allowance - selling', async () => {
          const { maker, taker } = await fixture({ failingSide: 'base' })

          await maker.limit(mkr('100'), dai('2'), true, 0)
          await expect(taker.limit(mkr('100'), dai('2'), false, 0)).to.be.revertedWith('taker-fault')
        })
      })
    })
  })

  describe('with whitelist', () => {
    let alice: OasisCustomerNoEscrow
    let bob: OasisCustomerNoEscrow
    let baseToken: MockWhitelistToken
    let orderBook: OrderBook

    beforeEach(async () => {
      const [deployer] = await ethers.getSigners()
      baseToken = await new MockWhitelistTokenFactory(deployer).deploy('DAI', 18)
      const quoteToken = await new MockTokenFactory(deployer).deploy('MKR', 18)
      const baseAdapter = await new MockStWhitelistAdapterFactory(deployer).deploy()
      const quoteAdapter = await new Erc20AdapterFactory(deployer).deploy()
      let maker: OasisTester, taker: OasisTester
      ;({ maker, taker, orderBook } = await deployOasisWithTestersAndInitialBalances(
        deployer,
        OasisNoEscrowArtifact,
        baseToken,
        quoteToken,
        baseAdapter,
        quoteAdapter,
      ))

      alice = new OasisCustomerNoEscrow(maker, baseToken, quoteToken)
      bob = new OasisCustomerNoEscrow(taker, baseToken, quoteToken)
    })

    it('does not allow make when maker not whitelisted', async () => {
      // There is a check in `make` that fails with `maker-not-whitelisted`, but before make there is an attempt to match in `ioc`.
      // Thus we get `taker-not-whitelisted` from there.
      await expect(alice.buy(mkr('100'), dai('2'))).to.be.revertedWith('taker-not-whitelisted')
    })

    it('does not allow take when taker not whitelisted', async () => {
      await baseToken.addToWhitelist(alice.address)
      await alice.joinDai(dai('200'))
      await alice.buy(mkr('100'), dai('2'))

      await expect(bob.sell(mkr('100'), dai('2'))).to.be.revertedWith('taker-not-whitelisted')
    })

    it('removes maker order on take when maker is no longer whitelisted', async () => {
      await baseToken.addToWhitelist(alice.address)
      await alice.joinDai(dai('200'))
      const { position: alicesOrderPosition } = await alice.buy(mkr('100'), dai('2'))
      await baseToken.removeFromWhitelist(alice.address)

      await baseToken.addToWhitelist(bob.address)
      await bob.joinMkr(mkr('100'))
      const { position: bobsOrderPosition } = await bob.sell(mkr('100'), dai('2'))

      expect(await orderBook.orderExists(bobsOrderPosition)).to.be.true // bob's order didn't match and was inserted into order book
      expect(await orderBook.orderExists(alicesOrderPosition)).to.be.false // alice's order was removed
    })
  })

  it('does not allow to call atomicSwap externally', async () => {
    const { oasis } = await loadFixtureAdapter(await ethers.getSigners())(noEscrowWithoutJoinFixture)

    await expect(oasis.atomicSwap(AddressZero, AddressZero, false, 0, 0)).to.be.revertedWith('swap-not-internal')
  })
})
