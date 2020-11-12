import { Signer } from '@ethersproject/abstract-signer'
import { parseEther } from 'ethers/lib/utils'
import { waffle } from 'hardhat'
import MockTokenArtifact from '../../artifacts/contracts/mocks/MockToken.sol/MockToken.json'
import OasisNoEscrowNoAdaptersArtifact from '../../artifacts/contracts/oasis.sol/OasisNoEscrowNoAdapters.json'
import { MockToken, OasisNoEscrowNoAdapters } from '../../typechain'

const { deployContract } = waffle

export async function noEscrowNoAdapterMkrDaiFixture([w1, w2, w3]: Signer[]) {
  const [deployer, makerSigner, takerSigner] = [w1, w2, w3]
  const makerAddress = await makerSigner.getAddress()
  const takerAddress = await takerSigner.getAddress()

  const baseToken = (await deployContract(deployer, MockTokenArtifact, ['MKR'])) as MockToken
  const quoteToken = (await deployContract(deployer, MockTokenArtifact, ['DAI'])) as MockToken
  await baseToken.transfer(makerAddress, parseEther('1000'))
  await baseToken.transfer(takerAddress, parseEther('1000'))
  await quoteToken.transfer(makerAddress, parseEther('1000'))
  await quoteToken.transfer(takerAddress, parseEther('1000'))
  const oasis = (await deployContract(deployer, OasisNoEscrowNoAdaptersArtifact, [
    baseToken.address,
    quoteToken.address,
    1,
    1,
  ])) as OasisNoEscrowNoAdapters
  return {
    makerSigner,
    makerAddress,
    takerSigner,
    takerAddress,
    baseToken,
    quoteToken,
    oasis,
  }
}
