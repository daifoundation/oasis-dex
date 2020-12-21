import { expect } from 'chai'
import { BigNumber, Signer } from 'ethers'
import { ethers } from 'hardhat'

import {
  Erc20AdapterFactory,
  MockStAdapterFactory,
  MockTokenFactory,
  OasisNoEscrowFactory,
  OasisTesterFactory,
} from '../typechain'
import { OasisCustomerNoEscrow } from './exchange/oasisCustomerNoEscrow'
import { OrderBook } from './exchange/orderBook'
import { decn } from './utils/units'

const precisionCases = [
  { basePrecision: 18, quotePrecision: 18 },
  { basePrecision: 18, quotePrecision: 6 },
  { basePrecision: 0, quotePrecision: 18 },
  { basePrecision: 0, quotePrecision: 6 },
  { basePrecision: 6, quotePrecision: 18 },
  { basePrecision: 20, quotePrecision: 18 },
]
describe('OasisNoEscrow precision tests', () => {
  let deployer: Signer

  beforeEach(async () => {
    ;[deployer] = await ethers.getSigners()
  })

  async function tokenWithDecimals({ token, decimals }: { token: 'MKR' | 'DAI'; decimals: number }) {
    return new MockTokenFactory(deployer).deploy(token, decimals)
  }

  async function deployOasisWithPrecisions({
    basePrecision,
    quotePrecision,
    tic,
    dust,
  }: {
    basePrecision: number
    quotePrecision: number
    tic: BigNumber
    dust: BigNumber
  }) {
    const baseToken = await tokenWithDecimals({ token: 'MKR', decimals: basePrecision })
    const quoteToken = await tokenWithDecimals({ token: 'DAI', decimals: quotePrecision })
    const baseAdapter = await new MockStAdapterFactory(deployer).deploy()
    const quoteAdapter = await new Erc20AdapterFactory(deployer).deploy()
    const oasis = await new OasisNoEscrowFactory(deployer).deploy(
      baseToken.address,
      quoteToken.address,
      baseAdapter.address,
      quoteAdapter.address,
      tic,
      dust,
    )
    const orderBook = new OrderBook(oasis) as OrderBook

    const maker = await new OasisTesterFactory(deployer).deploy(oasis.address)
    const taker = await new OasisTesterFactory(deployer).deploy(oasis.address)

    const alice = new OasisCustomerNoEscrow(maker, baseToken, quoteToken)
    const bob = new OasisCustomerNoEscrow(taker, baseToken, quoteToken)

    await baseToken.transfer(alice.address, decn('1000000', basePrecision))
    await quoteToken.transfer(bob.address, decn('1000000', quotePrecision))

    await alice.joinMkr(decn('1000000', basePrecision))
    await bob.joinDai(decn('1000000', quotePrecision))

    return { baseToken, quoteToken, oasis, orderBook, alice, bob }
  }
  precisionCases.forEach(({ basePrecision, quotePrecision }) => {
    it(`matches orders for basePrecision ${basePrecision} and quotePrecision ${quotePrecision}`, async () => {
      const baseAmt = '2'
      const makerQuoteAmt = '2.567'
      const takerQuoteAmt = '3.123'

      const { baseToken, quoteToken, orderBook, alice, bob } = await deployOasisWithPrecisions({
        basePrecision,
        quotePrecision,
        tic: decn('0.001', quotePrecision),
        dust: decn('1', quotePrecision),
      })

      await alice.sell(decn(baseAmt, basePrecision), decn(makerQuoteAmt, quotePrecision), 0)
      const { total } = await bob.buy(decn(baseAmt, basePrecision), decn(takerQuoteAmt, quotePrecision), 0)

      expect(await orderBook.isEmpty()).to.be.true
      expect(total).to.eq(decn(makerQuoteAmt, quotePrecision).mul(baseAmt))
      expect(await baseToken.balanceOf(bob.address)).to.eq(decn(baseAmt, basePrecision))
      expect(await quoteToken.balanceOf(alice.address)).to.eq(decn(makerQuoteAmt, quotePrecision).mul(baseAmt))
    })

    it(`matches orders incompletely for basePrecision ${basePrecision} and quotePrecision ${quotePrecision}`, async () => {
      const makerBaseAmt = '2'
      const quoteAmt = '5.123'

      const { baseToken, quoteToken, orderBook, alice, bob } = await deployOasisWithPrecisions({
        basePrecision,
        quotePrecision,
        tic: decn('0.001', quotePrecision),
        dust: decn('1', quotePrecision),
      })

      await alice.sell(decn(makerBaseAmt, basePrecision), decn(quoteAmt, quotePrecision), 0)
      const { total } = await bob.buy(decn('3', basePrecision), decn(quoteAmt, quotePrecision), 0)

      expect(await orderBook.buyDepth()).to.eq(1)
      expect(total).to.eq(decn(quoteAmt, quotePrecision).mul(makerBaseAmt))
      expect(await baseToken.balanceOf(bob.address)).to.eq(decn(makerBaseAmt, basePrecision))
      expect(await quoteToken.balanceOf(alice.address)).to.eq(decn(quoteAmt, quotePrecision).mul(makerBaseAmt))
    })
  })

  it('matches orders for basePrecision 18 and quotePrecision 0', async () => {
    const basePrecision = 18
    const quotePrecision = 0

    const { baseToken, quoteToken, orderBook, alice, bob } = await deployOasisWithPrecisions({
      basePrecision,
      quotePrecision,
      tic: decn('1', quotePrecision),
      dust: decn('1', quotePrecision),
    })

    await alice.sell(decn('1000', basePrecision), decn('500', quotePrecision), 0)
    const { total } = await bob.buy(decn('1000', basePrecision), decn('500', quotePrecision), 0)

    expect(await orderBook.isEmpty()).to.be.true
    expect(total).to.eq(decn('500000', quotePrecision))
    expect(await baseToken.balanceOf(bob.address)).to.eq(decn('1000', basePrecision))
    expect(await quoteToken.balanceOf(alice.address)).to.eq(decn('500000', quotePrecision))
  })

  it('matches orders for basePrecision 0 and quotePrecision 0', async () => {
    const basePrecision = 0
    const quotePrecision = 0

    const { baseToken, quoteToken, orderBook, alice, bob } = await deployOasisWithPrecisions({
      basePrecision,
      quotePrecision,
      tic: decn('1', quotePrecision),
      dust: decn('1', quotePrecision),
    })

    await alice.sell(decn('10', basePrecision), decn('50', quotePrecision), 0)
    const { total } = await bob.buy(decn('10', basePrecision), decn('50', quotePrecision), 0)

    expect(await orderBook.isEmpty()).to.be.true
    expect(total).to.eq(decn('500', quotePrecision))
    expect(await baseToken.balanceOf(bob.address)).to.eq(decn('10', basePrecision))
    expect(await quoteToken.balanceOf(alice.address)).to.eq(decn('500', quotePrecision))
  })
})
