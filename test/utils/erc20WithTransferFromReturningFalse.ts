import { Signer } from 'ethers'
import { waffle } from 'hardhat'

const { deployMockContract } = waffle

import ERC20LikeArtifact from '../../artifacts/contracts/ERC20Like.sol/ERC20Like.json'
import { Erc20Like } from '../../typechain/Erc20Like'
import { eth } from './units'

async function mockErc20Like(deployer: Signer) {
  const baseToken = await deployMockContract(deployer, ERC20LikeArtifact.abi)
  await baseToken.mock.decimals.returns(18)
  await baseToken.mock.transfer.returns(true)
  await baseToken.mock.balanceOf.returns(eth('1000000'))
  await baseToken.mock.allowance.returns(eth('1000000'))
  return baseToken
}

export async function erc20WithTransferFromReturningFalse(deployer: Signer) {
  const baseToken = await mockErc20Like(deployer)
  await baseToken.mock.transferFrom.returns(false)
  return (baseToken as unknown) as Erc20Like
}

export async function erc20WithRevertingTransfer(deployer: Signer) {
  const baseToken = await mockErc20Like(deployer)
  await baseToken.mock.transferFrom.revertsWithReason('mock - always reverts')
  return (baseToken as unknown) as Erc20Like
}
