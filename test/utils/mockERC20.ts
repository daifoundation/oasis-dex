import { deployMockContract } from '@ethereum-waffle/mock-contract'
import { Signer } from 'ethers'

import ERC20LikeArtifact from '../../artifacts/contracts/ERC20Like.sol/ERC20Like.json'

export async function erc20WithTransferFromReturningFalse(deployer: Signer) {
  const baseToken = await deployMockContract(deployer, ERC20LikeArtifact.abi)
  await baseToken.mock.transferFrom.returns(false)
  await baseToken.mock.decimals.returns(18)
  return baseToken
}
