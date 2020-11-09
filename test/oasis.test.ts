import chai from 'chai';
import { waffle, ethers } from 'hardhat';
import OasisArtifact from '../artifacts/contracts/oasis.sol/Oasis.json';
import MockTokenArtifact from '../artifacts/contracts/mocks/MockToken.sol/MockToken.json';
import { MockToken, Oasis } from '../typechain';
import { Signer } from '@ethersproject/abstract-signer';

const { deployContract } = waffle;

describe('oasis dex', () => {

  let deployer: Signer
  let oasis: Oasis;

  beforeEach(async () => {
    [deployer] = await ethers.getSigners()
  });

  it('starts empty', async () => {
    const baseToken = await deployContract(deployer, MockTokenArtifact, ['DAI']) as MockToken;
    const quoteToken = await deployContract(deployer, MockTokenArtifact, ['MKR']) as MockToken;
    oasis = await deployContract(deployer, OasisArtifact, [baseToken.address, quoteToken.address, 100, 100]) as Oasis;

  });
});
