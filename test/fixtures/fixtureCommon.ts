import { Signer } from '@ethersproject/abstract-signer'
import { waffle } from 'hardhat'

import MockTokenArtifact from '../../artifacts/contracts/mocks/MockToken.sol/MockToken.json'
import OasisTesterArtifact from '../../artifacts/contracts/mocks/OasisTester.sol/OasisTester.json'
import { MockToken, OasisTester } from '../../typechain'
import { OasisBase } from '../../typechain/OasisBase'
import { OasisCustomerBase } from '../exchange/oasisCustomer'
import { OrderBook } from '../exchange/orderBook'
import { dai, mkr } from '../utils/units'

export const INITIAL_MKR_BALANCE = mkr('10000')
export const INITIAL_DAI_BALANCE = dai('10000')
const { deployContract } = waffle

export interface OasisFixture {
  baseToken: MockToken
  quoteToken: MockToken
  oasis: OasisBase
  maker: OasisTester
  taker: OasisTester
  alice: OasisCustomerBase
  bob: OasisCustomerBase
  orderBook: OrderBook
}

export async function deployOasisWithTesters(deployer: Signer, OasisArtifact: any) {
  const baseToken = (await deployContract(deployer, MockTokenArtifact, ['MKR', 18])) as MockToken
  const quoteToken = (await deployContract(deployer, MockTokenArtifact, ['DAI', 18])) as MockToken
  const oasis = (await deployContract(deployer, OasisArtifact, [
    baseToken.address,
    quoteToken.address,   
    dai('1').div(100),
    dai('1').div(10),
  ])) as OasisBase

  const orderBook = new OrderBook(oasis)

  const maker = (await deployContract(deployer, OasisTesterArtifact, [oasis.address])) as OasisTester
  const taker = (await deployContract(deployer, OasisTesterArtifact, [oasis.address])) as OasisTester
  const makerAddress = maker.address
  const takerAddress = taker.address

  await baseToken.transfer(makerAddress, INITIAL_MKR_BALANCE)
  await baseToken.transfer(takerAddress, INITIAL_MKR_BALANCE)
  await quoteToken.transfer(makerAddress, INITIAL_DAI_BALANCE)
  await quoteToken.transfer(takerAddress, INITIAL_DAI_BALANCE)
  return { maker, baseToken, quoteToken, taker, makerAddress, takerAddress, oasis, orderBook }
}
