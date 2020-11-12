import { expect } from 'chai'
import { constants } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import { ethers } from 'hardhat'
import { MockToken, OasisNoEscrowNoAdapters, OasisTester } from '../typechain'
import { loadFixtureAdapter } from './fixtures/loadFixture'
import { noEscrowNoAdapterMkrDaiFixture } from './fixtures/noEscrowNoAdapter'

describe('oasis dex', () => {
  let maker: OasisTester
  let taker: OasisTester
  let oasis: OasisNoEscrowNoAdapters
  let baseToken: MockToken
  let quoteToken: MockToken

  beforeEach(async () => {
    ;({ maker, taker, baseToken, quoteToken, oasis } = await loadFixtureAdapter(await ethers.getSigners())(
      noEscrowNoAdapterMkrDaiFixture,
    ))
  })

  it('adds order to an empty order book', async () => {
    await maker.limit(parseEther('100'), 2, false, 0)
    let head = await oasis.getOrder(false, 0)
    expect(head.prev, 'head prev').to.eq(2)
    expect(head.next, 'head next').to.eq(2)
    let makeOrder = await oasis.getOrder(false, head.next)
    expect(makeOrder.baseAmt).to.eq(parseEther('100'))
    expect(makeOrder.price).to.eq(2)
    expect(makeOrder.prev).to.eq(0)
    expect(makeOrder.next).to.eq(0)
  })

  it('fails to fill order when maker has no allowance', async () => {
    await maker.limit(parseEther('100'), 2, false, 0)
    await taker.approve(quoteToken.address, oasis.address, constants.MaxUint256)
    await taker.limit(parseEther('100'), 2, true, 0)
    let head = await oasis.getOrder(false, 0)
    expect(head.next).to.eq(0)
    let buyingHead = await oasis.getOrder(true, 0)
    expect(buyingHead.next).to.eq(3)
  })

  it('matches an order', async () => {
    await taker.approve(quoteToken.address, oasis.address, constants.MaxUint256)
    await maker.approve(baseToken.address, oasis.address, constants.MaxUint256)
    await maker.limit(parseEther('100'), parseEther('2'), false, 0)
    await taker.limit(parseEther('100'), parseEther('2'), true, 0)
    let head = await oasis.getOrder(false, 0)
    expect(head.next).to.eq(0)
    let buyingHead = await oasis.getOrder(true, 0)
    expect(buyingHead.next).to.eq(0)
    expect(await baseToken.balanceOf(taker.address)).to.eq(parseEther('1100'))
    expect(await quoteToken.balanceOf(taker.address)).to.eq(parseEther('800'))
    expect(await baseToken.balanceOf(maker.address)).to.eq(parseEther('900'))
    expect(await quoteToken.balanceOf(maker.address)).to.eq(parseEther('1200'))
  })
})
