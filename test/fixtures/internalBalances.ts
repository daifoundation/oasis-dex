import { Signer } from '@ethersproject/abstract-signer'
import { waffle } from 'hardhat'

import MockTokenArtifact from '../../artifacts/contracts/mocks/MockToken.sol/MockToken.json'
import OasisTesterArtifact from '../../artifacts/contracts/mocks/OasisTester.sol/OasisTester.json'
import OasisInternalBalancesArtifact from '../../artifacts/contracts/OasisEscrowInternalBalances.sol/OasisEscrowInternalBalances.json'
import { MockToken, OasisEscrowInternalBalances, OasisTester } from '../../typechain'
import { OasisCustomerInternalBalances } from '../exchange/oasisCustomerInternalBalances'
import { dai, mkr } from '../utils/units'

const { deployContract } = waffle

export const INITIAL_MKR_BALANCE = mkr(10000)
export const INITIAL_DAI_BALANCE = dai(10000)

export async function internalBalancesMkrDaiFixture([w1, w2, w3]: Signer[]) {
  const [deployer, makerSigner, takerSigner] = [w1, w2, w3]
  const baseToken = (await deployContract(deployer, MockTokenArtifact, ['MKR'])) as MockToken
  const quoteToken = (await deployContract(deployer, MockTokenArtifact, ['DAI'])) as MockToken
  const oasis = (await deployContract(deployer, OasisInternalBalancesArtifact, [
    baseToken.address,
    quoteToken.address,
    dai(1).div(100),
    dai(1).div(10),
  ])) as OasisEscrowInternalBalances

  const maker = (await deployContract(deployer, OasisTesterArtifact, [oasis.address])) as OasisTester
  const taker = (await deployContract(deployer, OasisTesterArtifact, [oasis.address])) as OasisTester
  const makerAddress = maker.address
  const takerAddress = taker.address

  await baseToken.transfer(makerAddress, INITIAL_MKR_BALANCE)
  await baseToken.transfer(takerAddress, INITIAL_MKR_BALANCE)
  await quoteToken.transfer(makerAddress, INITIAL_DAI_BALANCE)
  await quoteToken.transfer(takerAddress, INITIAL_DAI_BALANCE)

  const alice = new OasisCustomerInternalBalances(maker, baseToken, quoteToken)
  const bob = new OasisCustomerInternalBalances(taker, baseToken, quoteToken)

  return {
    makerSigner,
    makerAddress,
    takerSigner,
    takerAddress,
    baseToken,
    quoteToken,
    oasis,
    maker,
    taker,
    alice,
    bob,
  }
}
