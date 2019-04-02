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

    uint256 public DAI_MAX = 100000 ether;
    uint256 public MKR_MAX = 100000 ether;

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
            address(mkr),    // baseTkn,
            address(dai),    // quoteTkn,
            (1 ether) / 10,  // dust,
            (1 ether) / 100  // tic
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

    function order(uint id) public view returns (
        uint256 baseAmt,
        uint256 price,
        address owner,
        uint256 prev,
        uint256 next
    ) {
        (baseAmt, price, owner, prev, next) =
            oasis.getOrderPublic(mkrDaiMarketId, true, id);

        if(baseAmt == 0) {
            (baseAmt, price, owner, prev, next) = oasis.getOrderPublic(mkrDaiMarketId, false, id);
            require(baseAmt > 0);
        }
    }

    // test helpers
    function isSorted() public view returns (bool) {
        // buys descending?
        (,,,, uint256 next) = oasis.getOrderPublic(mkrDaiMarketId, true, 0);
        while(next != 0) {
            (, uint256 price,,,) = oasis.getOrderPublic(mkrDaiMarketId, true, next);
            uint256 nextPrice;
            (, nextPrice,,, next) = oasis.getOrderPublic(mkrDaiMarketId, true, next);
            if(next != 0 && nextPrice > price) {
                return false;
            }
        }

        // sells descending?
        (,,,, next) = oasis.getOrderPublic(mkrDaiMarketId, false, 0);
        while(next != 0) {
            (, uint256 price,,,) = oasis.getOrderPublic(mkrDaiMarketId, false, next);
            uint256 nextPrice;
            (, nextPrice,,, next) = oasis.getOrderPublic(mkrDaiMarketId, false, next);
            if(next != 0 && nextPrice < price) {
                return false;
            }
        }
        return true;
    }

    function sellDepth() public view returns (uint256 length) {
        (,,,, uint256 next) = oasis.getOrderPublic(mkrDaiMarketId, false, 0);
        while(next != 0) {
            length++;
            (,,,, next) = oasis.getOrderPublic(mkrDaiMarketId, false, next);
        }
    }

    function buyDepth() public view returns (uint256 length) {
        (,,,, uint256 next) = oasis.getOrderPublic(mkrDaiMarketId, true, 0);
        while(next != 0) {
            length++;
            (,,,, next) = oasis.getOrderPublic(mkrDaiMarketId, true, next);
        }
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
        emit log_named_uint("oasis sellDepth: ", sellDepth());
        emit log_named_uint("oasis buyDepth: ", buyDepth());
        assertTrue(false);
    }
}

contract MarketTest is OasisTest {
    function testCreateMarket() public {
        (ERC20 baseTkn,,,) = oasis.markets(mkrDaiMarketId);
        assertTrue(baseTkn == mkr);
    }
}

contract DustTest is OasisTest {
    function testFailDustControl() public {
        (,,uint256 dust,) = oasis.markets(mkrDaiMarketId);
        tester1.sell(dust - 1, 1 ether, 0);
    }

    function testDustControl() public {
        (,,uint256 dust,) = oasis.markets(mkrDaiMarketId);
        tester1.sell(dust, 1 ether, 0);
    }

    // TODO: not complete!
}

contract TicTest is OasisTest {
    function testTicControl() public {
        (,,, uint256 tic) = oasis.markets(mkrDaiMarketId);
        tester1.sell(1 ether, 1 ether + tic, 0);
    }

    function testFailTicControl() public {
        (,,, uint256 tic) = oasis.markets(mkrDaiMarketId);
        tester1.sell(1 ether, 1 ether + tic - 1, 0);
    }
}

contract MakeTest is OasisTest {
    function testSellNoPos() public {

        uint256 o1 = tester1.sell(1 ether, 500 ether, 0);
        uint256 o2 = tester1.sell(1 ether, 600 ether, 0);

        // mid price
        uint256 o3 = tester1.sell(1 ether, 550 ether, 0);
        (,,, uint256 prev, uint256 next) = order(o3);
        assertEq(prev, o1);
        assertEq(next, o2);
        assertTrue(isSorted());

        // best price
        uint256 o4 = tester1.sell(1 ether, 450 ether, 0);
        (,,, prev, next) = order(o4);
        assertEq(prev, 0);
        assertEq(next, o1);
        assertTrue(isSorted());

        // worst price
        uint256 s5 = tester1.sell(1 ether, 650 ether, 0);
        (,,, prev, next) = order(s5);
        assertEq(prev, o2);
        assertEq(next, 0);
        assertTrue(isSorted());

        assertEq(sellDepth(), 5);
        assertEq(buyDepth(), 0);

        assertEq(dai.balanceOf(address(oasis)), 0 ether);
        assertEq(mkr.balanceOf(address(oasis)), 5 ether);
        
        assertEq(dai.balanceOf(address(tester1)), DAI_MAX);
        assertEq(mkr.balanceOf(address(tester1)), MKR_MAX - 5 ether);
    }

    function testSellPosOk() public {

        uint256 o1 = tester1.sell(1 ether, 500 ether, 0);
        uint256 o2 = tester1.sell(1 ether, 600 ether, 0);

        // mid price
        uint256 o3 = tester1.sell(1 ether, 550 ether, o2);
        (,,, uint256 prev, uint256 next) = order(o3);
        assertEq(prev, o1);
        assertEq(next, o2);
        assertTrue(isSorted());

        // best price
        uint256 o4 = tester1.sell(1 ether, 450 ether, o1);
        (,,, prev, next) = order(o4);
        assertEq(prev, 0);
        assertEq(next, o1);
        assertTrue(isSorted());

        // worst price
        uint256 s5 = tester1.sell(1 ether, 650 ether, o2);
        (,,, prev, next) = order(s5);
        assertEq(prev, o2);
        assertEq(next, 0);
        assertTrue(isSorted());

        assertEq(sellDepth(), 5);
        assertEq(buyDepth(), 0);

        assertEq(dai.balanceOf(address(oasis)), 0 ether);
        assertEq(mkr.balanceOf(address(oasis)), 5 ether);
        
        assertEq(dai.balanceOf(address(tester1)), DAI_MAX);
        assertEq(mkr.balanceOf(address(tester1)), MKR_MAX - 5 ether);        
    }

    function testSellPosWrong() public {

        tester1.sell(1 ether, 500 ether, 0);
        uint256 o2 = tester1.sell(1 ether, 600 ether, 0);

        // price after pos
        uint256 o3 = tester1.sell(1 ether, 650 ether, o2);
        (,,, uint256 prev, uint256 next) = order(o3);
        assertEq(prev, o2);
        assertEq(next, 0);
        assertTrue(isSorted());

        // price much before pos
        uint256 o4 = tester1.sell(1 ether, 450 ether, o2);
        (,,, prev, next) = order(o4);
        assertEq(prev, 0);
        assertEq(next, 1);
        assertTrue(isSorted());

        assertEq(sellDepth(), 4);
        assertEq(buyDepth(), 0);

        assertEq(dai.balanceOf(address(oasis)), 0 ether);
        assertEq(mkr.balanceOf(address(oasis)), 4 ether);
        
        assertEq(dai.balanceOf(address(tester1)), DAI_MAX);
        assertEq(mkr.balanceOf(address(tester1)), MKR_MAX - 4 ether);        
    }

    function testBuyNoPos() public {

        uint256 o1 = tester1.buy(1 ether, 500 ether, 0);
        uint256 o2 = tester1.buy(1 ether, 600 ether, 0);

        // mid price
        uint256 o3 = tester1.buy(1 ether, 550 ether, 0);
        (,,, uint256 prev, uint256 next) = order(o3);
        assertEq(prev, o2);
        assertEq(next, o1);
        assertTrue(isSorted());

        // best price
        uint256 o4 = tester1.buy(1 ether, 450 ether, 0);
        (,,, prev, next) = order(o4);
        assertEq(prev, o1);
        assertEq(next, 0);
        assertTrue(isSorted());

        // worst price
        uint256 s5 = tester1.buy(1 ether, 650 ether, 0);
        (,,, prev, next) = order(s5);
        assertEq(prev, 0);
        assertEq(next, o2);
        assertTrue(isSorted());

        assertEq(sellDepth(), 0);
        assertEq(buyDepth(), 5);

        assertEq(dai.balanceOf(address(oasis)), 2750 ether);
        assertEq(mkr.balanceOf(address(oasis)), 0 ether);
        
        assertEq(dai.balanceOf(address(tester1)), DAI_MAX - 2750 ether);
        assertEq(mkr.balanceOf(address(tester1)), MKR_MAX);
    }

    function testBuyPosOk() public {

        uint256 o1 = tester1.buy(1 ether, 500 ether, 0);
        uint256 o2 = tester1.buy(1 ether, 600 ether, 0);

        // mid price
        uint256 o3 = tester1.buy(1 ether, 550 ether, o2);
        (,,, uint256 prev, uint256 next) = order(o3);
        assertEq(prev, o2);
        assertEq(next, o1);
        assertTrue(isSorted());

        // best price
        uint256 o4 = tester1.buy(1 ether, 650 ether, 0);
        (,,, prev, next) = order(o4);
        assertEq(prev, 0);
        assertEq(next, o2);
        assertTrue(isSorted());

        // worst price
        uint256 s5 = tester1.buy(1 ether, 450 ether, 0);
        (,,, prev, next) = order(s5);
        assertEq(prev, o1);
        assertEq(next, 0);
        assertTrue(isSorted());

        assertEq(sellDepth(), 0);
        assertEq(buyDepth(), 5);

        assertEq(dai.balanceOf(address(oasis)), 2750 ether);
        assertEq(mkr.balanceOf(address(oasis)), 0 ether);
        
        assertEq(dai.balanceOf(address(tester1)), DAI_MAX - 2750 ether);
        assertEq(mkr.balanceOf(address(tester1)), MKR_MAX);        
    }

    function testBuyPosWrong() public {
        
        uint256 o1 = tester1.buy(1 ether, 500 ether, 0);
        uint256 o2 = tester1.buy(1 ether, 600 ether, 0);

        // price after pos
        uint256 o3 = tester1.buy(1 ether, 650 ether, o2);
        (,,, uint256 prev, uint256 next) = order(o3);
        assertEq(prev, 0);
        assertEq(next, o2);
        assertTrue(isSorted());

        // price much before pos
        uint256 o4 = tester1.buy(1 ether, 450 ether, o2);
        (,,, prev, next) = order(o4);
        assertEq(prev, o1);
        assertEq(next, 0);
        assertTrue(isSorted());

        assertEq(sellDepth(), 0);
        assertEq(buyDepth(), 4);

        assertEq(dai.balanceOf(address(oasis)), 2200 ether);
        assertEq(mkr.balanceOf(address(oasis)), 0 ether);

        assertEq(dai.balanceOf(address(tester1)), DAI_MAX - 2200 ether);
        assertEq(mkr.balanceOf(address(tester1)), MKR_MAX);        
    }
}

contract TakeTest is OasisTest {
    function testSingleSellComplete() public {
        tester1.buy(1 ether, 600 ether, 0);
        tester1.buy(1 ether, 500 ether, 0);

        assertEq(sellDepth(), 0);
        assertEq(buyDepth(), 2);

        uint256 o3 = tester2.sell(1 ether, 600 ether, 0);

        assertEq(o3, 0);

        assertEq(sellDepth(), 0);
        assertEq(buyDepth(), 1);

        assertEq(dai.balanceOf(address(oasis)), 500 ether);
        assertEq(mkr.balanceOf(address(oasis)), 0 ether);
        
        assertEq(dai.balanceOf(address(tester1)), DAI_MAX - 1100 ether);
        assertEq(mkr.balanceOf(address(tester1)), MKR_MAX + 1 ether);

        assertEq(dai.balanceOf(address(tester2)), DAI_MAX + 600 ether);
        assertEq(mkr.balanceOf(address(tester2)), MKR_MAX - 1 ether);
    }
}

