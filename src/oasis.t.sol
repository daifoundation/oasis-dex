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

    function sell(uint baseAmt, uint price, uint pos) public returns (uint256) {
        return oasis.sell(mkrDaiMarketId, baseAmt, price, pos);
    }
    
    function buy(uint baseAmt, uint price, uint pos) public returns (uint256) {
        return oasis.buy(mkrDaiMarketId, baseAmt, price, pos);
    }

    function cancel(uint offerId) public {
        oasis.cancel(mkrDaiMarketId, offerId);
    }

    function approve(ERC20 tkn) public {
        tkn.approve(address(oasis), uint(-1));
    }
}

contract OasisTest is DSTest {

    uint DAI_MAX = 100000 ether;
    uint MKR_MAX = 100000 ether;

    ERC20 dai;
    ERC20 mkr;

    Oasis oasis;

    uint mkrDaiMarketId;

    Tester tester1;
    Tester tester2;
    Tester tester3;
    Tester tester4;

    function setUp() public {
        dai = new DSTokenBase(1000000 ether);
        mkr = new DSTokenBase(1000000 ether);
        oasis = new Oasis();

        mkrDaiMarketId = oasis.createMarket(
            address(mkr), // baseTkn,
            address(dai), // quoteTkn,
            10,           // dust,
            5             // tic
        );

        tester1 = setUpTester();
        tester2 = setUpTester();
        tester3 = setUpTester();
        tester4 = setUpTester();
    }

    function setUpTester() private returns (Tester tester) {
        tester = new Tester(oasis, mkrDaiMarketId);

        dai.transfer(address(tester), 10000 ether);
        tester.approve(dai);

        mkr.transfer(address(tester), 10000 ether);
        tester.approve(mkr);
    }

    function isSorted() public view returns (bool) {
        return oasis.isSorted(mkrDaiMarketId);
    }

    function order(uint id) public view returns (
        uint256 baseAmt,
        uint256 price,
        address owner,
        uint256 prev,
        uint256 next
    ) {
        return oasis.getOrderPublic(mkrDaiMarketId, id);
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

contract MarketTest is OasisTest {
    function stestCreateMarket() public {
        (ERC20 baseTkn,,,) = oasis.markets(mkrDaiMarketId);
        assertTrue(baseTkn == mkr);
    }
}

contract DustTest is OasisTest {
    function testFailDustControl() public {
        (,,uint256 dust,) = oasis.markets(mkrDaiMarketId);
        tester1.sell(dust - 1, 1, 0);
    }

    function testDustControl() public {
        (,,uint256 dust,) = oasis.markets(mkrDaiMarketId);
        tester1.sell(dust, 5, 0);
    }
}

contract TicTest is OasisTest {
    function testFailTicControl() public {
        (,,uint256 dust, uint256 tic) = oasis.markets(mkrDaiMarketId);
        tester1.sell(dust + tic - 1, 1, 0);
    }

    function testTicControl() public {
        (,,uint256 dust, uint256 tic) = oasis.markets(mkrDaiMarketId);
        tester1.sell(dust + tic, 5, 0);
    }
}

contract MakeTest is OasisTest {
    function testMakeSellNoPos() public {
        
        uint256 s1 = tester1.sell(1 ether, 500 ether, 0);
        uint256 s2 = tester1.sell(1 ether, 600 ether, 0);

        // mid price
        uint256 s3 = tester1.sell(1 ether, 550 ether, 0);
        (,,, uint256 prev, uint256 next) = order(s3);
        assertEq(prev, s1);
        assertEq(next, s2);
        assertTrue(isSorted());

        // best price
        uint256 s4 = tester1.sell(1 ether, 450 ether, 0);
        (,,, prev, next) = order(s4);
        assertEq(prev, 0);
        assertEq(next, s1);
        assertTrue(isSorted());

        // worst price
        uint256 s5 = tester1.sell(1 ether, 650 ether, 0);
        (,,, prev, next) = order(s5);
        assertEq(prev, s2);
        assertEq(next, 0);
        assertTrue(isSorted());
    }

    function testMakeSellPosOk() public {
        
        uint256 s1 = tester1.sell(1 ether, 500 ether, 0);
        uint256 s2 = tester1.sell(1 ether, 600 ether, 0);

        uint256 s3 = tester1.sell(1 ether, 550 ether, s2);

        (,,, uint256 prev, uint256 next) = order(s3);

        assertEq(prev, s1);
        assertEq(next, s2);
        assertTrue(isSorted());
    }

    function testMakeSellPosWrong() public {
        
        tester1.sell(1 ether, 500 ether, 0);
        uint256 s2 = tester1.sell(1 ether, 600 ether, 0);

        // price after pos
        uint256 s3 = tester1.sell(1 ether, 650 ether, s2);
        (,,, uint256 prev, uint256 next) = order(s3);
        assertEq(prev, s2);
        assertEq(next, 0);
        assertTrue(isSorted());

        // price much before pos
        uint256 s4 = tester1.sell(1 ether, 450 ether, s2);
        (,,, prev, next) = order(s4);
        assertEq(prev, 0);
        assertEq(next, 1);
        assertTrue(isSorted());        
    }

    function testMakeBuyPosOk() public {

        uint256 s1 = tester1.buy(1, 500 ether, 0);
        uint256 s2 = tester1.buy(1, 600 ether, 0);

        uint256 s3 = tester1.buy(1, 550 ether, s1);

        (,,, uint256 prev, uint256 next) = order(s3);

        assertEq(prev, s2);
        assertEq(next, s1);
        assertTrue(isSorted());
    }
}

