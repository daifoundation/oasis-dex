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

    function approve(ERC20 tkn) public {
        tkn.approve(address(oasis), 10000000000000000);
    }
}

contract OasisTest is DSTest {

    ERC20 dai;
    ERC20 mkr;

    Oasis oasis;

    uint mkrDaiMarketId;

    Tester tester1;
    Tester tester2;

    function setUp() public {
        dai = new DSTokenBase(10 ** 9);
        mkr = new DSTokenBase(10 ** 6);
        oasis = new Oasis();

        mkrDaiMarketId = oasis.createMarket(
            address(mkr), // baseTkn, 
            address(dai), // quoteTkn, 
            1 finney,     // quoteDust, 
            1 finney      // quoteTick
        );

        tester1 = new Tester(oasis, mkrDaiMarketId);
        tester2 = new Tester(oasis, mkrDaiMarketId);

        dai.transfer(address(tester1), 10000);
        tester1.approve(dai);

        mkr.transfer(address(tester1), 1000);
        tester1.approve(mkr);

        dai.transfer(address(tester2), 10000);
        tester2.approve(dai);

        mkr.transfer(address(tester2), 1000);
        tester2.approve(mkr);

    }

    // function testCreateMarket() public {
    //     (ERC20 baseTkn,,,) = oasis.markets(mkrDaiMarketId);
    //     assertTrue(baseTkn == mkr);
    // }

    function testSellToEmptyOrderBook() public {

        tester1.sell(1, 500);

        assertTrue(dai.balanceOf(address(oasis)) == 0);
        assertTrue(dai.balanceOf(address(tester1)) == 10000);

        assertTrue(mkr.balanceOf(address(oasis)) == 1);
        assertTrue(mkr.balanceOf(address(tester1)) == (1000 - 1));
    }

    function testBuy() public {
        uint offerId = tester1.sell(1, 500);
        assertTrue(offerId != 0);

        uint offer2Id = tester2.buy(1, 500);
        assertTrue(offer2Id == 0);

        assertTrue(dai.balanceOf(address(oasis)) == 0);
        assertTrue(dai.balanceOf(address(tester1)) == 10000 + 500);
        assertTrue(dai.balanceOf(address(tester2)) == 10000 - 500);
        assertTrue(mkr.balanceOf(address(oasis)) == 0);
        assertTrue(mkr.balanceOf(address(tester1)) == (1000 - 1));
        assertTrue(mkr.balanceOf(address(tester2)) == (1000 + 1));
    }

    function testSell() public {
        uint offerId = tester1.buy(1, 500);
        assertTrue(offerId != 0);

        uint offer2Id = tester2.sell(1, 500);
        assertTrue(offer2Id == 0);

        assertTrue(dai.balanceOf(address(oasis)) == 0);
        assertTrue(dai.balanceOf(address(tester1)) == 10000 - 500);
        assertTrue(dai.balanceOf(address(tester2)) == 10000 + 500);
        assertTrue(mkr.balanceOf(address(oasis)) == 0);
        assertTrue(mkr.balanceOf(address(tester1)) == (1000 + 1));
        assertTrue(mkr.balanceOf(address(tester2)) == (1000 - 1));
    }

    function debug() public {
        emit log_named_uint("tester1 dai: ", dai.balanceOf(address(tester1)));
        emit log_named_uint("tester1 mkr: ", mkr.balanceOf(address(tester1)));
        emit log_named_uint("tester2 dai: ", dai.balanceOf(address(tester2)));
        emit log_named_uint("tester2 mkr: ", mkr.balanceOf(address(tester2)));
        emit log_named_uint("oasis dai: ", dai.balanceOf(address(oasis)));
        emit log_named_uint("oasis mkr: ", mkr.balanceOf(address(oasis)));
    }
}
