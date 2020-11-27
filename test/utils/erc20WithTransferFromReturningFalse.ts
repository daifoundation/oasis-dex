import { Signer } from 'ethers'
import { waffle } from 'hardhat'

const { deployMockContract } = waffle

import ERC20LikeArtifact from '../../artifacts/contracts/ERC20Like.sol/ERC20Like.json'
import { Erc20Like } from '../../typechain/Erc20Like'

export async function erc20WithTransferFromReturningFalse(deployer: Signer) {
  const baseToken = await deployMockContract(deployer, ERC20LikeArtifact.abi)
  await baseToken.mock.transferFrom.returns(false)
  await baseToken.mock.decimals.returns(18)
  await baseToken.mock.transfer.returns(true)
  return (baseToken as unknown) as Erc20Like
}
