pragma solidity ^0.5.4;

import "ds-test/test.sol";
import "ds-token/base.sol";

import "./oasis.sol";

contract Tester {
    Oasis oasis;
    uint mkrDaiMarketId;

    constructor(Oasis oasis_, uint mkrDaiMarketId_) public {
        oasis = oasis_;
        mkrDaiMarketId = mkrDaiMarketId_;
    }

    function sell(uint baseAmt, uint quoteAmt) public returns (uint256) {
        return oasis.sell(mkrDaiMarketId, baseAmt, quoteAmt);
    }

    function buy(uint baseAmt, uint quoteAmt) public returns (uint256) {
        return oasis.buy(mkrDaiMarketId, baseAmt, quoteAmt);
    }

    function cancel(uint offerId) public {
        oasis.cancel(mkrDaiMarketId, offerId);
    }

    function approve(ERC20 tkn) public {
        tkn.approve(address(oasis), 10000000000000000);
    }
}

contract OasisTest is DSTest {

    uint DAI_MAX = 10000;
    uint MKR_MAX = 10000;

    ERC20 dai;
    ERC20 mkr;

    Oasis oasis;

    uint mkrDaiMarketId;

    Tester tester1;
    Tester tester2;
    Tester tester3;
    Tester tester4;

    function setUp() public {
        dai = new DSTokenBase(10 ** 9);
        mkr = new DSTokenBase(10 ** 6);
        oasis = new Oasis();

        mkrDaiMarketId = oasis.createMarket(
            address(mkr), // baseTkn,
            address(dai), // quoteTkn,
            1,            // quoteDust,
            1             // quoteTick
        );

        tester1 = setUpTester();
        tester2 = setUpTester();
        tester3 = setUpTester();
        tester4 = setUpTester();
    }

    function setUpTester() private returns (Tester tester) {
        tester = new Tester(oasis, mkrDaiMarketId);

        dai.transfer(address(tester), DAI_MAX);
        tester.approve(dai);

        mkr.transfer(address(tester), MKR_MAX);
        tester.approve(mkr);
    }

    function testCreateMarket() public {
        (ERC20 baseTkn,,,) = oasis.markets(mkrDaiMarketId);
        assertTrue(baseTkn == mkr);
    }

    function testSellToEmptyOrderBook() public {

        tester1.sell(1, 500);

        assertTrue(oasis.isSorted(mkrDaiMarketId));

        assertTrue(dai.balanceOf(address(oasis)) == 0);
        assertTrue(dai.balanceOf(address(tester1)) == DAI_MAX);

        assertTrue(mkr.balanceOf(address(oasis)) == 1);
        assertTrue(mkr.balanceOf(address(tester1)) == (MKR_MAX - 1));
    }

    function testMultipleSells() public {

        tester1.sell(1, 500);
        assertTrue(oasis.isSorted(mkrDaiMarketId));

        tester2.sell(1, 600);
        assertTrue(oasis.isSorted(mkrDaiMarketId));

        tester2.sell(1, 400);
        assertTrue(oasis.isSorted(mkrDaiMarketId));

        assertTrue(dai.balanceOf(address(oasis)) == 0);
        assertTrue(dai.balanceOf(address(tester1)) == DAI_MAX);
        assertTrue(dai.balanceOf(address(tester2)) == DAI_MAX);

        assertTrue(mkr.balanceOf(address(oasis)) == 3);
        assertTrue(mkr.balanceOf(address(tester1)) == (MKR_MAX - 1));
        assertTrue(mkr.balanceOf(address(tester2)) == (MKR_MAX - 2));
    }

    function testCancelSell() public {

        uint offerId = tester1.sell(1, 500);
        assertTrue(mkr.balanceOf(address(oasis)) != 0);
        tester1.cancel(offerId);
        assertTrue(mkr.balanceOf(address(oasis)) == 0);
    }

    function testCancelBuy() public {

        uint offerId = tester1.buy(1, 500);
        assertTrue(dai.balanceOf(address(oasis)) != 0);
        assertEq(oasis.buyDepth(mkrDaiMarketId), 1);
        assertEq(oasis.sellDepth(mkrDaiMarketId), 0);

        tester1.cancel(offerId);
        assertTrue(dai.balanceOf(address(oasis)) == 0);
        assertEq(oasis.buyDepth(mkrDaiMarketId), 0);
        assertEq(oasis.sellDepth(mkrDaiMarketId), 0);
    }

    function testBuy() public {
        uint offerId = tester1.sell(1, 500);
        assertTrue(offerId != 0);
        assertTrue(oasis.isSorted(mkrDaiMarketId));

        uint offer2Id = tester2.buy(1, 500);
        assertTrue(offer2Id == 0);
        assertTrue(oasis.isSorted(mkrDaiMarketId));
        assertTrue(dai.balanceOf(address(oasis)) == 0);
        assertTrue(dai.balanceOf(address(tester1)) == DAI_MAX + 500);
        assertTrue(dai.balanceOf(address(tester2)) == DAI_MAX - 500);
        assertTrue(mkr.balanceOf(address(oasis)) == 0);
        assertTrue(mkr.balanceOf(address(tester1)) == (MKR_MAX - 1));
        assertTrue(mkr.balanceOf(address(tester2)) == (MKR_MAX + 1));
    }

    function testSell() public {
        uint offerId = tester1.buy(1, 500);
        assertTrue(offerId != 0);

        uint offer2Id = tester2.sell(1, 500);
        assertTrue(offer2Id == 0);

        assertTrue(dai.balanceOf(address(oasis)) == 0);
        assertTrue(dai.balanceOf(address(tester1)) == DAI_MAX - 500);
        assertTrue(dai.balanceOf(address(tester2)) == DAI_MAX + 500);
        assertTrue(mkr.balanceOf(address(oasis)) == 0);
        assertTrue(mkr.balanceOf(address(tester1)) == (MKR_MAX + 1));
        assertTrue(mkr.balanceOf(address(tester2)) == (MKR_MAX - 1));
    }

    function testMultipleTrades() public {

        tester1.sell(1, 500);
        assertTrue(oasis.isSorted(mkrDaiMarketId));
        assertEq(oasis.buyDepth(mkrDaiMarketId), 0);
        assertEq(oasis.sellDepth(mkrDaiMarketId), 1);

        tester2.sell(1, 600);
        assertTrue(oasis.isSorted(mkrDaiMarketId));
        assertEq(oasis.buyDepth(mkrDaiMarketId), 0);
        assertEq(oasis.sellDepth(mkrDaiMarketId), 2);

        assertTrue(dai.balanceOf(address(oasis)) == 0);
        assertEq(dai.balanceOf(address(tester1)), DAI_MAX);
        assertEq(dai.balanceOf(address(tester2)), DAI_MAX);

        assertEq(mkr.balanceOf(address(oasis)), 2);
        assertEq(mkr.balanceOf(address(tester1)), MKR_MAX - 1);
        assertEq(mkr.balanceOf(address(tester2)), MKR_MAX - 1);

        tester3.buy(3, 500);
        assertTrue(oasis.isSorted(mkrDaiMarketId));
        assertEq(dai.balanceOf(address(oasis)), 1000);
        assertEq(mkr.balanceOf(address(oasis)), 1);
        assertEq(oasis.buyDepth(mkrDaiMarketId), 1);
        assertEq(oasis.sellDepth(mkrDaiMarketId), 1);

        assertEq(dai.balanceOf(address(tester1)), DAI_MAX + 500);
        assertEq(mkr.balanceOf(address(tester3)), MKR_MAX + 1);
        assertEq(mkr.balanceOf(address(tester3)), MKR_MAX + 1);

        tester1.sell(1, 500);

        assertTrue(oasis.isSorted(mkrDaiMarketId));
        assertEq(dai.balanceOf(address(oasis)), 500);
        assertEq(mkr.balanceOf(address(oasis)), 1);
        assertEq(oasis.buyDepth(mkrDaiMarketId), 1);
        assertEq(oasis.sellDepth(mkrDaiMarketId), 1);

        assertEq(dai.balanceOf(address(tester1)), DAI_MAX + 1000);
        assertEq(mkr.balanceOf(address(tester3)), MKR_MAX + 2);
    }


    function debug() public {
        emit log_named_uint("tester1 dai: ", dai.balanceOf(address(tester1)));
        emit log_named_uint("tester1 mkr: ", mkr.balanceOf(address(tester1)));
        emit log_named_uint("tester2 dai: ", dai.balanceOf(address(tester2)));
        emit log_named_uint("tester2 mkr: ", mkr.balanceOf(address(tester2)));
        emit log_named_uint("tester3 dai: ", dai.balanceOf(address(tester3)));
        emit log_named_uint("tester3 mkr: ", mkr.balanceOf(address(tester3)));
        emit log_named_uint("oasis dai: ", dai.balanceOf(address(oasis)));
        emit log_named_uint("oasis mkr: ", mkr.balanceOf(address(oasis)));
        emit log_named_uint("oasis sellDepth: ", oasis.sellDepth(mkrDaiMarketId));
        emit log_named_uint("oasis buyDepth: ", oasis.buyDepth(mkrDaiMarketId));
        assertTrue(false);
    }



}
