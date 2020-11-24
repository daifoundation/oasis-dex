import { Signer } from '@ethersproject/abstract-signer'
import { waffle } from 'hardhat'

import MockTokenArtifact from '../../artifacts/contracts/mocks/MockToken.sol/MockToken.json'
import OasisTesterArtifact from '../../artifacts/contracts/mocks/OasisTester.sol/OasisTester.json'
import OasisNoEscrowArtifact from '../../artifacts/contracts/OasisNoEscrow.sol/OasisNoEscrow.json'
import { MockToken, OasisNoEscrow, OasisTester } from '../../typechain'
import { dai, mkr } from '../utils/units'

const { deployContract } = waffle

export const INITIAL_MKR_BALANCE = mkr(10000)
export const INITIAL_DAI_BALANCE = dai(10000)

export async function noEscrowMkrDaiFixture([w1, w2, w3]: Signer[]) {
  const [deployer, makerSigner, takerSigner] = [w1, w2, w3]
  const baseToken = (await deployContract(deployer, MockTokenArtifact, ['MKR', 18])) as MockToken
  const quoteToken = (await deployContract(deployer, MockTokenArtifact, ['DAI', 18])) as MockToken
  const oasis = (await deployContract(deployer, OasisNoEscrowArtifact, [
    baseToken.address,
    quoteToken.address,
    dai(1).div(100),
    dai(1).div(10),
  ])) as OasisNoEscrow

  const maker = (await deployContract(deployer, OasisTesterArtifact, [oasis.address])) as OasisTester
  const taker = (await deployContract(deployer, OasisTesterArtifact, [oasis.address])) as OasisTester
  const makerAddress = maker.address
  const takerAddress = taker.address

  await baseToken.transfer(makerAddress, INITIAL_MKR_BALANCE)
  await baseToken.transfer(takerAddress, INITIAL_MKR_BALANCE)
  await quoteToken.transfer(makerAddress, INITIAL_DAI_BALANCE)
  await quoteToken.transfer(takerAddress, INITIAL_DAI_BALANCE)
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
  }
}

export const noEscrowMkrDaiFixtureForDustTests = noEscrowMkrDaiFixture
