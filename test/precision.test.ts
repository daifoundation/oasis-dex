import { expect } from "chai"
import { deployContract } from "ethereum-waffle"
import { BigNumber, Signer } from "ethers"
import { ethers } from 'hardhat'

import OasisTesterArtifact from '../artifacts/contracts/mocks/OasisTester.sol/OasisTester.json'
import OasisNoEscrowArtifact from '../artifacts/contracts/OasisNoEscrow.sol/OasisNoEscrow.json'
import { MockTokenFactory, OasisTester } from "../typechain"
import { OasisBase } from "../typechain/OasisBase"
import { OasisCustomerNoEscrow } from "./exchange/oasisCustomerNoEscrow"
import { OrderBook } from './exchange/orderBook'
import { decn } from "./utils/units"

describe('OasisNoEscrow precision tests', () => {
  let deployer: Signer

  beforeEach(async () => {
    ;[deployer] = await ethers.getSigners()
  })

  async function tokenWithDecimals({ token, decimals }: { token: 'MKR' | 'DAI'; decimals: number }) {
    return new MockTokenFactory(deployer).deploy(token, decimals)
  }

  async function deployOasisWithPrecisions({ basePrecision, quotePrecision, tic, dust }: { basePrecision: number; quotePrecision: number; tic: BigNumber; dust: BigNumber }) {
    const baseToken = await tokenWithDecimals({ token: 'MKR', decimals: basePrecision })
    const quoteToken = await tokenWithDecimals({ token: 'DAI', decimals: quotePrecision })
    const oasis = (await deployContract(deployer, OasisNoEscrowArtifact, [baseToken.address, quoteToken.address, tic, dust,])) as OasisBase
    const orderBook = new OrderBook(oasis) as OrderBook

    const maker = (await deployContract(deployer, OasisTesterArtifact, [oasis.address])) as OasisTester
    const taker = (await deployContract(deployer, OasisTesterArtifact, [oasis.address])) as OasisTester

    const alice = new OasisCustomerNoEscrow(maker, baseToken, quoteToken)
    const bob = new OasisCustomerNoEscrow(taker, baseToken, quoteToken)

    await baseToken.transfer(await alice.address(), decn('1000000', basePrecision))
    await quoteToken.transfer(await bob.address(), decn('1000000', quotePrecision))

    await alice.joinMkr(decn('1000000', basePrecision))
    await bob.joinDai(decn('1000000', quotePrecision))

    return { baseToken, quoteToken, oasis, orderBook, alice, bob }
  }

  it('matches orders for maximal basePrecision and quotePrecision equal to 1', async () => {
    const basePrecision = 18
    const quotePrecision = 1

    const { baseToken, quoteToken, orderBook, alice, bob } = await deployOasisWithPrecisions(
      { basePrecision, quotePrecision, tic: decn('0.1', quotePrecision), dust: decn('0.1', quotePrecision) })

    await alice.sell(decn('1000', basePrecision), decn('500.5', quotePrecision), 0)
    const { total } = await bob.buy(decn('1000', basePrecision), decn('500.5', quotePrecision), 0)

    expect(await orderBook.isEmpty()).to.be.true
    expect(total).to.eq(decn('500500', quotePrecision))
    expect(await baseToken.balanceOf(await bob.address())).to.eq(decn('1000', basePrecision))
    expect(await quoteToken.balanceOf(await alice.address())).to.eq(decn('500500', quotePrecision))

  })

  it('matches orders incompletely for maximal basePrecision and quotePrecision equal to 1', async () => {
    const basePrecision = 18
    const quotePrecision = 1

    const { baseToken, quoteToken, orderBook, alice, bob } = await deployOasisWithPrecisions(
      { basePrecision, quotePrecision, tic: decn('0.1', quotePrecision), dust: decn('0.1', quotePrecision) })

    await alice.sell(decn('2', basePrecision), decn('5.6', quotePrecision), 0)
    const { total, left } = await bob.buy(decn('3', basePrecision), decn('5.6', quotePrecision), 0)

    expect(await orderBook.buyDepth()).to.eq(1)
    expect(total).to.eq(decn('11.2', quotePrecision))
    expect(left).to.eq(decn('1', basePrecision))
    expect(await baseToken.balanceOf(await bob.address())).to.eq(decn('2', basePrecision))
    expect(await quoteToken.balanceOf(await alice.address())).to.eq(decn('11.2', quotePrecision))
  })

  it('matches orders for maximal basePrecision and minimal quotePrecision', async () => {
    const basePrecision = 18
    const quotePrecision = 0

    const { baseToken, quoteToken, orderBook, alice, bob } = await deployOasisWithPrecisions(
      { basePrecision, quotePrecision, tic: decn('1', quotePrecision), dust: decn('1', quotePrecision) })

    await alice.sell(decn('1000', basePrecision), decn('500', quotePrecision), 0)
    const { total } = await bob.buy(decn('1000', basePrecision), decn('500', quotePrecision), 0)

    expect(await orderBook.isEmpty()).to.be.true
    expect(total).to.eq(decn('500000', quotePrecision))
    expect(await baseToken.balanceOf(await bob.address())).to.eq(decn('1000', basePrecision))
    expect(await quoteToken.balanceOf(await alice.address())).to.eq(decn('500000', quotePrecision))
  })

  it('matches orders for minimal basePrecision and maximal quotePrecision', async () => {
    const basePrecision = 0
    const quotePrecision = 18

    const { baseToken, quoteToken, orderBook, alice, bob } = await deployOasisWithPrecisions(
      { basePrecision, quotePrecision, tic: decn('0.01', quotePrecision), dust: decn('1', quotePrecision) })

    await alice.sell(decn('999', basePrecision), decn('500.55', quotePrecision), 0)
    const { total } = await bob.buy(decn('999', basePrecision), decn('600', quotePrecision), 0)

    expect(await orderBook.isEmpty()).to.be.true
    expect(total).to.eq(decn((500.55 * 999).toString(), quotePrecision))
    expect(await baseToken.balanceOf(await bob.address())).to.eq(decn('999', basePrecision))
    expect(await quoteToken.balanceOf(await alice.address())).to.eq(decn((500.55 * 999).toString(), quotePrecision))
  })

  it('matches orders for basePrecision and quotePrecision equal to 1', async () => {
    const basePrecision = 1
    const quotePrecision = 1

    const { baseToken, quoteToken, orderBook, alice, bob } = await deployOasisWithPrecisions(
      { basePrecision, quotePrecision, tic: decn('0.1', quotePrecision), dust: decn('0.1', quotePrecision) })

    await alice.sell(decn('10', basePrecision), decn('50.5', quotePrecision), 0)
    const { total } = await bob.buy(decn('10', basePrecision), decn('50.5', quotePrecision), 0)

    expect(await orderBook.isEmpty()).to.be.true
    expect(total).to.eq(decn('505', quotePrecision))
    expect(await baseToken.balanceOf(await bob.address())).to.eq(decn('10', basePrecision))
    expect(await quoteToken.balanceOf(await alice.address())).to.eq(decn('505', quotePrecision))
  })

  it('matches orders for basePrecision and quotePrecision equal to 3', async () => {
    const basePrecision = 3
    const quotePrecision = 3

    const { baseToken, quoteToken, orderBook, alice, bob } = await deployOasisWithPrecisions(
      { basePrecision, quotePrecision, tic: decn('0.1', quotePrecision), dust: decn('0.1', quotePrecision) })

    await alice.sell(decn('10.53', basePrecision), decn('50.5', quotePrecision), 0)
    const { total } = await bob.buy(decn('10.5', basePrecision), decn('50.5', quotePrecision), 0)

    expect(total).to.eq(decn('530.25', quotePrecision))
    expect(await baseToken.balanceOf(await bob.address())).to.eq(decn('10.5', basePrecision))
    expect(await quoteToken.balanceOf(await alice.address())).to.eq(decn('530.25', quotePrecision))
    expect(await orderBook.mkrBalance()).to.eq(decn('0.03', basePrecision))
  })

  it('matches orders for minimal basePrecision and minimal quotePrecision', async () => {
    const basePrecision = 0
    const quotePrecision = 0

    const { baseToken, quoteToken, orderBook, alice, bob } = await deployOasisWithPrecisions(
      { basePrecision, quotePrecision, tic: decn('1', quotePrecision), dust: decn('1', quotePrecision) })

    await alice.sell(decn('10', basePrecision), decn('50', quotePrecision), 0)
    const { total } = await bob.buy(decn('10', basePrecision), decn('50', quotePrecision), 0)

    expect(await orderBook.isEmpty()).to.be.true
    expect(total).to.eq(decn('500', quotePrecision))
    expect(await baseToken.balanceOf(await bob.address())).to.eq(decn('10', basePrecision))
    expect(await quoteToken.balanceOf(await alice.address())).to.eq(decn('500', quotePrecision))
  })
})
