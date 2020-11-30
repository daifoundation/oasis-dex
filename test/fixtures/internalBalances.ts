import { Signer } from '@ethersproject/abstract-signer'

import OasisEscrowInternalBalancesArtifact from '../../artifacts/contracts/OasisEscrowInternalBalances.sol/OasisEscrowInternalBalances.json'
import { OasisCustomerInternalBalances } from '../exchange/oasisCustomerInternalBalances'
import { deployMkrDaiOasisWithTesters, INITIAL_DAI_BALANCE, INITIAL_MKR_BALANCE, OasisFixture } from './fixtureCommon'

export async function internalBalancesFixture([w1, w2, w3]: Signer[]): Promise<OasisFixture> {
  const [deployer] = [w1, w2, w3]
  const { maker, baseToken, quoteToken, taker, oasis, orderBook } = await deployMkrDaiOasisWithTesters(
    deployer,
    OasisEscrowInternalBalancesArtifact,
  )

  const alice = new OasisCustomerInternalBalances(maker, baseToken, quoteToken)
  const bob = new OasisCustomerInternalBalances(taker, baseToken, quoteToken)

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
