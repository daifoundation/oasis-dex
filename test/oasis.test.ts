import { parseEther } from 'ethers/lib/utils'
import { waffle, ethers } from 'hardhat'
import OasisNoEscrowNoAdaptersArtifact from '../artifacts/contracts/oasis.sol/OasisNoEscrowNoAdapters.json'
import MockTokenArtifact from '../artifacts/contracts/mocks/MockToken.sol/MockToken.json'
import { MockToken, OasisNoEscrowNoAdapters } from '../typechain'
import { Signer } from '@ethersproject/abstract-signer'
import { expect } from 'chai'

const { deployContract } = waffle

describe('oasis dex', () => {
  let deployer: Signer
  let oasis: OasisNoEscrowNoAdapters
  let baseToken: MockToken
  let quoteToken: MockToken

  beforeEach(async () => {
    ;[deployer] = await ethers.getSigners()
    baseToken = (await deployContract(deployer, MockTokenArtifact, ['DAI'])) as MockToken
    quoteToken = (await deployContract(deployer, MockTokenArtifact, ['MKR'])) as MockToken
    oasis = (await deployContract(deployer, OasisNoEscrowNoAdaptersArtifact, [
      baseToken.address,
      quoteToken.address,
      1,
      1,
    ])) as OasisNoEscrowNoAdapters
  })

  it('adds order to order book empty', async () => {
    await oasis.limit(parseEther('100'), '2', false, 0)
    let head = await oasis.getOrder(false, 0)
    let makeOrder = await oasis.getOrder(false, head.next)
    expect(makeOrder.baseAmt).to.eq(parseEther('100'))
    expect(makeOrder.price).to.eq(2)
  })
})
