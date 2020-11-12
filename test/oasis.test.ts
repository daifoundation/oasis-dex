import { Signer } from '@ethersproject/abstract-signer'
import { expect } from 'chai'
import { constants } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import { ethers } from 'hardhat'
import { MockToken, OasisNoEscrowNoAdapters } from '../typechain'
import { loadFixtureAdapter } from './fixtures/loadFixture'
import { noEscrowNoAdapterMkrDaiFixture } from './fixtures/noEscrowNoAdapter'

describe('oasis dex', () => {
  let deployer: Signer
  let makerSigner: Signer
  let takerSigner: Signer
  let makerAddress: string
  let takerAddress: string
  let oasis: OasisNoEscrowNoAdapters
  let baseToken: MockToken
  let quoteToken: MockToken
  let asMaker: OasisNoEscrowNoAdapters
  let asTaker: OasisNoEscrowNoAdapters

  beforeEach(async () => {
    ;({ makerSigner, makerAddress, takerSigner, takerAddress, baseToken, quoteToken, oasis } = await loadFixtureAdapter(
      await ethers.getSigners(),
    )(noEscrowNoAdapterMkrDaiFixture))
    asMaker = oasis.connect(makerSigner)
    asTaker = oasis.connect(takerSigner)
  })

  it('adds order to order book empty', async () => {
    await asMaker.limit(parseEther('100'), 2, false, 0)
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
    await asMaker.limit(parseEther('100'), 2, false, 0)
    await quoteToken.connect(takerSigner).approve(oasis.address, constants.MaxUint256)
    await asTaker.limit(parseEther('100'), 2, true, 0)
    let head = await oasis.getOrder(false, 0)
    expect(head.next).to.eq(0)
    let buyingHead = await oasis.getOrder(true, 0)
    expect(buyingHead.next).to.eq(3)
  })

  it('matches an order', async () => {
    await quoteToken.connect(takerSigner).approve(oasis.address, constants.MaxUint256)
    await baseToken.connect(makerSigner).approve(oasis.address, constants.MaxUint256)
    await asMaker.limit(parseEther('100'), parseEther('2'), false, 0)
    await asTaker.limit(parseEther('100'), parseEther('2'), true, 0)
    let head = await oasis.getOrder(false, 0)
    expect(head.next).to.eq(0)
    let buyingHead = await oasis.getOrder(true, 0)
    expect(buyingHead.next).to.eq(0)
    expect(await baseToken.balanceOf(takerAddress)).to.eq(parseEther('1100'))
    expect(await quoteToken.balanceOf(takerAddress)).to.eq(parseEther('800'))
    expect(await baseToken.balanceOf(makerAddress)).to.eq(parseEther('900'))
    expect(await quoteToken.balanceOf(makerAddress)).to.eq(parseEther('1200'))
  })
})
