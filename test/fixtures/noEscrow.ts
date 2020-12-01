import { Signer } from '@ethersproject/abstract-signer'

import OasisNoEscrowArtifact from '../../artifacts/contracts/OasisNoEscrow.sol/OasisNoEscrow.json'
import { OasisCustomerNoEscrow } from '../exchange/oasisCustomerNoEscrow'
import { deployMkrDaiOasisWithTesters, INITIAL_DAI_BALANCE, INITIAL_MKR_BALANCE, OasisFixture } from './fixtureCommon'

export async function noEscrowFixture([w1, w2, w3]: Signer[]): Promise<OasisFixture> {
  const [deployer] = [w1, w2, w3]
  const { maker, baseToken, quoteToken, taker, oasis, orderBook } = await deployMkrDaiOasisWithTesters(
    deployer,
    OasisNoEscrowArtifact,
  )

  const alice = new OasisCustomerNoEscrow(maker, baseToken, quoteToken)
  const bob = new OasisCustomerNoEscrow(taker, baseToken, quoteToken)

  await alice.joinDai(INITIAL_DAI_BALANCE)
  await alice.joinMkr(INITIAL_MKR_BALANCE)
  await bob.joinDai(INITIAL_DAI_BALANCE)
  await bob.joinMkr(INITIAL_MKR_BALANCE)

  return {
    baseToken,
    quoteToken,
    oasis,
    maker,
    taker,
    alice,
    bob,
    orderBook,
  }
}

export async function noEscrowWithoutJoinFixture([w1, w2, w3]: Signer[]): Promise<OasisFixture> {
  const [deployer] = [w1, w2, w3]
  const { maker, baseToken, quoteToken, taker, oasis, orderBook } = await deployMkrDaiOasisWithTesters(
    deployer,
    OasisNoEscrowArtifact,
  )

  const alice = new OasisCustomerNoEscrow(maker, baseToken, quoteToken)
  const bob = new OasisCustomerNoEscrow(taker, baseToken, quoteToken)

  return {
    baseToken,
    quoteToken,
    oasis,
    maker,
    taker,
    alice,
    bob,
    orderBook,
  }
}
