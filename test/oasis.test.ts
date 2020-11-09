import { waffle, ethers } from 'hardhat';
import OasisArtifact from '../artifacts/contracts/oasis.sol/Oasis.json';
import { Oasis } from '../typechain';

const { deployContract } = waffle;

describe('oasis dex', async () => {
  const [deployer] = await ethers.getSigners()
  let oasis: Oasis;

  it('starts empty', async () => {
    oasis = await deployContract(deployer, OasisArtifact, ) as Oasis;
  });
});
