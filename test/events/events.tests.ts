import { Provider } from '@ethersproject/abstract-provider'
import { expect } from 'chai'
import { constants, ContractTransaction } from 'ethers'
import { ethers } from 'hardhat'

import OasisNoEscrowArtifact from '../../artifacts/contracts/OasisNoEscrow.sol/OasisNoEscrow.json'
import { MockToken, OasisTester } from '../../typechain'
import { OasisBase } from '../../typechain/OasisBase'
import { deployMkrDaiOasisWithTesters } from '../fixtures/fixtureCommon'
import { internalBalancesMkrDaiFixtureWithoutJoin } from '../fixtures/internalBalances'
import { loadFixtureAdapter } from '../fixtures/loadFixture'
import { dai, mkr } from '../utils/units'

const ID_OF_FIRST_ORDER = 2

describe('Event tests', () => {
  let maker: OasisTester
  let taker: OasisTester
  let baseToken: MockToken
  let quoteToken: MockToken
  let oasis: OasisBase
  let provider: Provider | undefined

  beforeEach(async () => {
    ; ({ maker, taker, baseToken, quoteToken, oasis, provider } = await loadFixtureAdapter(await ethers.getSigners())(
      internalBalancesMkrDaiFixtureWithoutJoin
    ))
  })

  const getTimestamp = async (transaction: ContractTransaction) => {
    const { blockHash } = await transaction.wait()
    return await provider!.getBlock(blockHash)
  }

  it('Join event is emitted when customer successfully joins', async () => {
    await taker.approve(baseToken.address, oasis.address, mkr('200'))

    await expect(taker.join(true, maker.address, mkr('200'))).to.emit(oasis, 'Join')
      .withArgs(true, taker.address, maker.address, mkr('200'))
  })

  it('Make event is emitted when new order is put into orderbook', async () => {
    await maker.approve(baseToken.address, oasis.address, mkr('200'))
    await maker.join(true, maker.address, mkr('200'))

    const transaction = await maker.limit(mkr('100'), dai('2'), false, 0)
    const { timestamp } = await getTimestamp(transaction)
    await expect(Promise.resolve(transaction)).to.emit(oasis, 'Make')
      .withArgs(ID_OF_FIRST_ORDER, timestamp, maker.address, false, mkr('100'), dai('2'))
  })

  it('Cancel event is emitted when customer successfully cancels an order', async () => {
    await maker.approve(baseToken.address, oasis.address, mkr('200'))
    await maker.join(true, maker.address, mkr('200'))
    await maker.limit(mkr('100'), dai('2'), false, 0)

    const transaction = await maker.cancel(false, ID_OF_FIRST_ORDER)
    const { timestamp } = await getTimestamp(transaction)

    await expect(Promise.resolve(transaction)).to.emit(oasis, 'Cancel')
      .withArgs(ID_OF_FIRST_ORDER, timestamp)
  })

  it('Exit event is emitted when customer exits tokens', async () => {
    await maker.approve(baseToken.address, oasis.address, mkr('200'))
    await maker.join(true, maker.address, mkr('200'))

    await taker.approve(baseToken.address, oasis.address, mkr('200'))
    await taker.join(true, taker.address, mkr('200'))

    await expect(taker.exit(true, maker.address, mkr('200'))).to.emit(oasis, 'Exit')
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
    await expect(Promise.resolve(transaction)).to.emit(oasis, 'Take')
      .withArgs(ID_OF_FIRST_ORDER, timestamp, taker.address, true, mkr('100'), dai('2'))
  })

  it('SwapFailed event is emitted when swap fails, e.g. when maker has no allowance - NoEscrow', async () => {
    const [deployer] = await ethers.getSigners()
    const { oasis, maker, taker, baseToken } = await deployMkrDaiOasisWithTesters(deployer, OasisNoEscrowArtifact)
    await taker.approve(baseToken.address, oasis.address, constants.MaxUint256)
    await maker.approve(baseToken.address, oasis.address, constants.MaxUint256)
    await maker.limit(mkr('100'), dai('2'), true, 0)

    const transaction = await taker.limit(mkr('100'), dai('2'), false, 0)
    const { timestamp } = await getTimestamp(transaction)
    await expect(Promise.resolve(transaction)).to.emit(oasis, 'SwapFailed')
      .withArgs(ID_OF_FIRST_ORDER, timestamp, taker.address, false, mkr('100'), dai('2'))
  })  
})
