import { Provider } from '@ethersproject/abstract-provider'
import { expect } from 'chai'
import { deployContract } from 'ethereum-waffle'
import { constants, ContractTransaction } from 'ethers'
import { ethers } from 'hardhat'

import ERC20AdapterArtifact from '../artifacts/contracts/ERC20Adapter.sol/ERC20Adapter.json'
import MockSTAdapterArtifact from '../artifacts/contracts/mocks/MockSTAdapter.sol/MockSTAdapter.json'
import OasisNoEscrowArtifact from '../artifacts/contracts/OasisNoEscrow.sol/OasisNoEscrow.json'
import { Erc20Adapter, MockStAdapter, MockToken, MockTokenFactory, OasisTester } from '../typechain'
import { OasisBase } from '../typechain/OasisBase'
import { deployOasisWithTestersAndInitialBalances } from './fixtures/fixtureCommon'
import { internalBalancesMkrDaiFixtureWithoutJoin } from './fixtures/internalBalances'
import { loadFixtureAdapter } from './fixtures/loadFixture'
import { erc20WithRevertingTransfer } from './utils/erc20WithTransferFromReturningFalse'
import { dai, mkr } from './utils/units'

const ID_OF_FIRST_ORDER = 2

describe('Event tests', () => {
  let maker: OasisTester
  let taker: OasisTester
  let baseToken: MockToken
  let quoteToken: MockToken
  let oasis: OasisBase
  let provider: Provider

  beforeEach(async () => {
    ;({ maker, taker, baseToken, quoteToken, oasis, provider } = await loadFixtureAdapter(await ethers.getSigners())(
      internalBalancesMkrDaiFixtureWithoutJoin,
    ))
  })

  const getTimestamp = async (transaction: ContractTransaction) => {
    const { blockHash } = await transaction.wait()
    return await provider!.getBlock(blockHash)
  }

  it('Join event is emitted when customer successfully joins', async () => {
    await taker.approve(baseToken.address, oasis.address, mkr('200'))

    await expect(taker.join(true, maker.address, mkr('200')))
      .to.emit(oasis, 'Join')
      .withArgs(true, taker.address, maker.address, mkr('200'))
  })

  it('Make event is emitted when new order is put into orderbook', async () => {
    await maker.approve(baseToken.address, oasis.address, mkr('200'))
    await maker.join(true, maker.address, mkr('200'))

    const transaction = await maker.limit(mkr('100'), dai('2'), false, 0)
    const { timestamp } = await getTimestamp(transaction)
    await expect(Promise.resolve(transaction))
      .to.emit(oasis, 'Make')
      .withArgs(ID_OF_FIRST_ORDER, timestamp, maker.address, false, mkr('100'), dai('2'))
  })

  it('Cancel event is emitted when customer successfully cancels an order', async () => {
    await maker.approve(baseToken.address, oasis.address, mkr('200'))
    await maker.join(true, maker.address, mkr('200'))
    await maker.limit(mkr('100'), dai('2'), false, 0)

    const transaction = await maker.cancel(false, ID_OF_FIRST_ORDER)
    const { timestamp } = await getTimestamp(transaction)

    await expect(Promise.resolve(transaction)).to.emit(oasis, 'Cancel').withArgs(ID_OF_FIRST_ORDER, timestamp)
  })

  it('Exit event is emitted when customer exits tokens', async () => {
    await maker.approve(baseToken.address, oasis.address, mkr('200'))
    await maker.join(true, maker.address, mkr('200'))

    await taker.approve(baseToken.address, oasis.address, mkr('200'))
    await taker.join(true, taker.address, mkr('200'))

    await expect(taker.exit(true, maker.address, mkr('200')))
      .to.emit(oasis, 'Exit')
      .withArgs(true, taker.address, maker.address, mkr('200'))
  })

  it('Take event is emitted when order is matched and removed from orderbook', async () => {
    await maker.approve(baseToken.address, oasis.address, mkr('200'))
    await maker.join(true, maker.address, mkr('200'))
    await maker.limit(mkr('100'), dai('2'), false, 0)

    await taker.approve(quoteToken.address, oasis.address, dai('200'))
    await taker.join(false, taker.address, dai('200'))

    const transaction = await taker.limit(mkr('100'), dai('2'), true, 0)
    const { timestamp } = await getTimestamp(transaction)
    await expect(Promise.resolve(transaction))
      .to.emit(oasis, 'Take')
      .withArgs(ID_OF_FIRST_ORDER, timestamp, taker.address, true, mkr('100'), dai('2'))
  })

  it('SwapFailed event is emitted when swap fails, e.g. when maker has no allowance - NoEscrow', async () => {
    const [deployer] = await ethers.getSigners()
    const baseToken = await erc20WithRevertingTransfer(deployer)
    const quoteToken = await new MockTokenFactory(deployer).deploy('MKR', 18)

    const baseAdapter = (await deployContract(deployer, MockSTAdapterArtifact)) as MockStAdapter
    const quoteAdapter = (await deployContract(deployer, ERC20AdapterArtifact)) as Erc20Adapter

    const { maker, taker, oasis } = await deployOasisWithTestersAndInitialBalances(
      deployer,
      OasisNoEscrowArtifact,
      baseToken,
      quoteToken,
      baseAdapter,
      quoteAdapter,
    )

    await taker.approve(quoteToken.address, oasis.address, constants.MaxUint256)
    const t1 = await maker.limit(mkr('100'), dai('2'), false, 0)
    await expect(Promise.resolve(t1)).not.to.be.reverted

    const transaction = await taker.limit(mkr('100'), dai('2'), true, 0)
    const { timestamp } = await getTimestamp(transaction)
    await expect(Promise.resolve(transaction))
      .to.emit(oasis, 'SwapFailed')
      .withArgs(ID_OF_FIRST_ORDER, timestamp, taker.address, true, mkr('100'), dai('2'))
  })
})
