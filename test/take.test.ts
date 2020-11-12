import { expect } from 'chai'
import { BigNumber, Signer } from 'ethers'
import { ethers } from 'hardhat'
import { ERC20, OasisNoEscrowNoAdapters, OasisTester } from '../typechain'
import { OasisBase } from '../typechain/OasisBase'
import { loadFixtureAdapter } from './fixtures/loadFixture'
import { INITIAL_DAI_BALANCE, INITIAL_MKR_BALANCE, noEscrowNoAdapterMkrDaiFixture } from './fixtures/noEscrowNoAdapter'
import { dai, mkr } from './utils/units'

class OasisCustomer {
  private oasisTester: OasisTester
  private mkrToken: ERC20
  private daiToken: ERC20

  constructor(signer: Signer, oasis: OasisTester, mkrToken: ERC20, daiToken: ERC20) {
    this.oasisTester = oasis.connect(signer)
    this.mkrToken = mkrToken.connect(signer)
    this.daiToken = daiToken.connect(signer)
  }

  async buy(amount: BigNumber, price: BigNumber, position: number) {
    return this.oasisTester.limit(amount, price, true, position)
  }

  async sell(amount: BigNumber, price: BigNumber, position: number) {
    const transaction = await this.oasisTester.limit(amount, price, false, position)
    const receipt = await transaction.wait()
    const event1 = this.oasisTester.interface.getEvent('LimitResult')
    const topic = this.oasisTester.interface.getEventTopic(event1)
    const log = receipt.logs.find((log) => log.topics.includes(topic))
    if (!log) {
      throw new Error('no event emitted')
    }
    const event = this.oasisTester.interface.parseLog(log)
    return {
      position: event.args[0],
      left: event.args[1],
      total: event.args[2],
    }
  }

  async daiDelta() {
    return (await this.daiToken.balanceOf(this.oasisTester.address)).sub(INITIAL_DAI_BALANCE)
  }

  async mkrDelta() {
    return (await this.mkrToken.balanceOf(this.oasisTester.address)).sub(INITIAL_MKR_BALANCE)
  }

  async joinDai(amount: BigNumber) {
    return this.oasisTester.approve(this.daiToken.address, await this.oasisAddress(), amount)
  }

  private async oasisAddress() {
    return this.oasisTester.oasis()
  }

  async joinMkr(amount: BigNumber) {
    return this.oasisTester.approve(this.mkrToken.address, await this.oasisAddress(), amount)
  }
}

class OrderBook {
  constructor(private oasis: OasisBase) {}

  async sellDepth(): Promise<number> {
    return (await this.sellOrders()).length
  }

  async buyDepth(): Promise<number> {
    return (await this.buyOrders()).length
  }

  private async sellOrders() {
    return await this.orders(false)
  }

  private buyOrders() {
    return this.orders(true)
  }

  private async orders(buying: boolean) {
    let next = 0
    const result = []
    let order = await this.oasis.getOrder(buying, next)
    while (order.next.toNumber() != 0) {
      next = order.next.toNumber()
      order = await this.oasis.getOrder(buying, next)
      result.push(order)
    }
    return result
  }

  async daiBalance() {
    return this.balance(true)
  }

  async mkrBalance() {
    return this.balance(false)
  }

  private async balance(buying: boolean): Promise<BigNumber> {
    const sum = (a: BigNumber, b: BigNumber) => a.add(b)
    const orders = await this.orders(buying)
    return orders
      .map((order) => order.baseAmt.mul(order.price).div(BigNumber.from(10).pow(18)))
      .reduce(sum, BigNumber.from(0))
  }
}

context('no escrow, erc20 MKR/DAI market', () => {
  let aliceSinger: Signer
  let bobSigner: Signer
  let aliceAddress: string
  let bobAddress: string
  let oasis: OasisNoEscrowNoAdapters
  let maker: OasisTester
  let taker: OasisTester
  let mkrToken: ERC20
  let daiToken: ERC20
  let orderBook: OrderBook

  beforeEach(async () => {
    ;({
      makerSigner: aliceSinger,
      makerAddress: aliceAddress,
      takerSigner: bobSigner,
      takerAddress: bobAddress,
      baseToken: mkrToken,
      quoteToken: daiToken,
      oasis,
      maker,
      taker,
    } = await loadFixtureAdapter(await ethers.getSigners())(noEscrowNoAdapterMkrDaiFixture))
    orderBook = new OrderBook(oasis)
  })

  it('single complete sell', async () => {
    const alice = new OasisCustomer(aliceSinger, maker, mkrToken, daiToken)
    const bob = new OasisCustomer(bobSigner, taker, mkrToken, daiToken)
    await alice.joinDai(dai(1100))

    await alice.buy(mkr(1), dai(600), 0)
    await alice.buy(mkr(1), dai(500), 0)

    expect(await orderBook.sellDepth()).to.eq(0)
    expect(await orderBook.buyDepth()).to.eq(2)

    await bob.joinMkr(mkr(1))
    expect(await mkrToken.allowance(taker.address, oasis.address), 'allowance').to.eq(mkr(1))
    const { position } = await bob.sell(mkr(1), dai(600), 0)
    expect(position).to.eq(0) // order immediately filled

    expect(await orderBook.sellDepth()).to.eq(0)
    expect(await orderBook.buyDepth()).to.eq(1)

    expect(await orderBook.daiBalance()).to.eq(dai(500))
    expect(await orderBook.mkrBalance()).to.eq(mkr(0))
    expect(await alice.daiDelta()).to.eq(dai(-600))
    expect(await alice.mkrDelta()).to.eq(mkr(1))
    expect(await bob.daiDelta()).to.eq(dai(600))
    expect(await bob.mkrDelta()).to.eq(mkr(-1))
  })
})

//
// function testSingleSellComplete() public {
//
//   tester1.joinDai(1100 ether);
//   tester1.buy(1 ether, 600 ether, 0);
//   tester1.buy(1 ether, 500 ether, 0);
//
//   assertEq(sellDepth(), 0);
//   assertEq(buyDepth(), 2);
//
//   tester2.joinMkr(1 ether);
//   uint o3 = tester2.sell(1 ether, 600 ether, 0);
//
//   assertEq(o3, 0);
//
//   assertEq(sellDepth(), 0);
//   assertEq(buyDepth(), 1);
//
//   // debug();
//
//   assertEq(orderbookDaiBalance(), 500 ether);
//   assertEq(orderbookMkrBalance(), 0 ether);
//
//   assertEq(daiDelta(tester1), -1100 ether);
//   assertEq(daiBalance(tester1), 0 ether);
//   assertEq(mkrBalance(tester1), 1 ether);
//
//   assertEq(daiBalance(tester2), 600 ether);
//   assertEq(mkrBalance(tester2), 0 ether);
//   assertEq(mkrDelta(tester2), -1 ether);
// }
