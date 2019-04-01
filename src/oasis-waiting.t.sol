pragma solidity ^0.5.4;

import "./oasis.t.sol";

contract OasisWaitingTest is OasisTest {

    // function testCreateMarket() public {
    //     (ERC20 baseTkn,,,) = oasis.markets(mkrDaiMarketId);
    //     assertTrue(baseTkn == mkr);
    // }

    // function testFailDustControl() public {
    //     (,,uint256 dust,) = oasis.markets(mkrDaiMarketId);
    //     tester1.sell(dust - 1, 1, 0);
    // }

    // function testDustControl() public {
    //     (,,uint256 dust,) = oasis.markets(mkrDaiMarketId);
    //     tester1.sell(dust, 5, 0);
    // }

    // function testFailTicControl() public {
    //     (,,uint256 dust, uint256 tic) = oasis.markets(mkrDaiMarketId);
    //     tester1.sell(dust + tic - 1, 1, 0);
    // }

    // function testTicControl() public {
    //     (,,uint256 dust, uint256 tic) = oasis.markets(mkrDaiMarketId);
    //     tester1.sell(dust + tic, 5, 0);
    // }

    // // non systematic tests
    // function testSellToEmptyOrderBook() public {

    //     tester1.sell(1, 500, 0);

    //     assertTrue(isSorted());

    //     assertTrue(dai.balanceOf(address(oasis)) == 0);
    //     assertTrue(dai.balanceOf(address(tester1)) == DAI_MAX);

    //     assertTrue(mkr.balanceOf(address(oasis)) == 1);
    //     assertTrue(mkr.balanceOf(address(tester1)) == (MKR_MAX - 1));
    // }

    // function testMultipleSells() public {

    //     tester1.sell(1, 500, 0);
    //     assertTrue(isSorted());

    //     tester2.sell(1, 600, 0);
    //     assertTrue(isSorted());

    //     tester2.sell(1, 400, 0);
    //     assertTrue(isSorted());

    //     assertTrue(dai.balanceOf(address(oasis)) == 0);
    //     assertTrue(dai.balanceOf(address(tester1)) == DAI_MAX);
    //     assertTrue(dai.balanceOf(address(tester2)) == DAI_MAX);

    //     assertTrue(mkr.balanceOf(address(oasis)) == 3);
    //     assertTrue(mkr.balanceOf(address(tester1)) == (MKR_MAX - 1));
    //     assertTrue(mkr.balanceOf(address(tester2)) == (MKR_MAX - 2));
    // }

    // function testCancelSell() public {

    //     uint offerId = tester1.sell(1, 500, 0);
    //     assertTrue(mkr.balanceOf(address(oasis)) != 0);
    //     tester1.cancel(offerId);
    //     assertTrue(mkr.balanceOf(address(oasis)) == 0);
    // }

    // function testCancelBuy() public {

    //     uint offerId = tester1.buy(1, 500, 0);
    //     assertTrue(dai.balanceOf(address(oasis)) != 0);
    //     assertEq(oasis.buyDepth(mkrDaiMarketId), 1);
    //     assertEq(oasis.sellDepth(mkrDaiMarketId), 0);

    //     tester1.cancel(offerId);
    //     assertTrue(dai.balanceOf(address(oasis)) == 0);
    //     assertEq(oasis.buyDepth(mkrDaiMarketId), 0);
    //     assertEq(oasis.sellDepth(mkrDaiMarketId), 0);
    // }

    // function testBuy() public {
    //     uint offerId = tester1.sell(1, 500, 0);
    //     assertTrue(offerId != 0);
    //     assertTrue(isSorted());

    //     uint offer2Id = tester2.buy(1, 500, 0);
    //     assertTrue(offer2Id == 0);
    //     assertTrue(isSorted());
    //     assertTrue(dai.balanceOf(address(oasis)) == 0);
    //     assertTrue(dai.balanceOf(address(tester1)) == DAI_MAX + 500);
    //     assertTrue(dai.balanceOf(address(tester2)) == DAI_MAX - 500);
    //     assertTrue(mkr.balanceOf(address(oasis)) == 0);
    //     assertTrue(mkr.balanceOf(address(tester1)) == (MKR_MAX - 1));
    //     assertTrue(mkr.balanceOf(address(tester2)) == (MKR_MAX + 1));
    // }

    // function testSell() public {
    //     uint offerId = tester1.buy(1, 500, 0);
    //     assertTrue(offerId != 0);

    //     uint offer2Id = tester2.sell(1, 500, 0);
    //     assertTrue(offer2Id == 0);

    //     assertTrue(dai.balanceOf(address(oasis)) == 0);
    //     assertTrue(dai.balanceOf(address(tester1)) == DAI_MAX - 500);
    //     assertTrue(dai.balanceOf(address(tester2)) == DAI_MAX + 500);
    //     assertTrue(mkr.balanceOf(address(oasis)) == 0);
    //     assertTrue(mkr.balanceOf(address(tester1)) == (MKR_MAX + 1));
    //     assertTrue(mkr.balanceOf(address(tester2)) == (MKR_MAX - 1));
    // }

    // function testMultipleTrades() public {

    //     tester1.sell(1, 500, 0);
    //     assertTrue(isSorted());
    //     assertEq(oasis.buyDepth(mkrDaiMarketId), 0);
    //     assertEq(oasis.sellDepth(mkrDaiMarketId), 1);

    //     tester2.sell(1, 600, 0);
    //     assertTrue(isSorted());
    //     assertEq(oasis.buyDepth(mkrDaiMarketId), 0);
    //     assertEq(oasis.sellDepth(mkrDaiMarketId), 2);

    //     assertTrue(dai.balanceOf(address(oasis)) == 0);
    //     assertEq(dai.balanceOf(address(tester1)), DAI_MAX);
    //     assertEq(dai.balanceOf(address(tester2)), DAI_MAX);

    //     assertEq(mkr.balanceOf(address(oasis)), 2);
    //     assertEq(mkr.balanceOf(address(tester1)), MKR_MAX - 1);
    //     assertEq(mkr.balanceOf(address(tester2)), MKR_MAX - 1);

    //     tester3.buy(3, 500, 0);
    //     assertTrue(isSorted());
    //     assertEq(dai.balanceOf(address(oasis)), 1000);
    //     assertEq(mkr.balanceOf(address(oasis)), 1);
    //     assertEq(oasis.buyDepth(mkrDaiMarketId), 1);
    //     assertEq(oasis.sellDepth(mkrDaiMarketId), 1);

    //     assertEq(dai.balanceOf(address(tester1)), DAI_MAX + 500);
    //     assertEq(mkr.balanceOf(address(tester3)), MKR_MAX + 1);
    //     assertEq(mkr.balanceOf(address(tester3)), MKR_MAX + 1);

    //     tester1.sell(1, 500, 0);

    //     assertTrue(isSorted());
    //     assertEq(dai.balanceOf(address(oasis)), 500);
    //     assertEq(mkr.balanceOf(address(oasis)), 1);
    //     assertEq(oasis.buyDepth(mkrDaiMarketId), 1);
    //     assertEq(oasis.sellDepth(mkrDaiMarketId), 1);

    //     assertEq(dai.balanceOf(address(tester1)), DAI_MAX + 1000);
    //     assertEq(mkr.balanceOf(address(tester3)), MKR_MAX + 2);
    // }
}