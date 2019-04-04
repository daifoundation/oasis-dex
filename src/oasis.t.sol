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
    uint256 public DUST = (1 ether) / 10;
    uint256 public TIC = (1 ether) / 100;

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
            address(mkr),
            address(dai),
            DUST,
            TIC
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

    function daiDelta(Tester t) public view returns (int256) {
        return int256(dai.balanceOf(address(t)) - DAI_MAX);
    }

    function mkrDelta(Tester t) public view returns (int256) {
        return int256(mkr.balanceOf(address(t)) - MKR_MAX);
    }

    function oasisDaiBalance() public view returns (uint256) {
        return dai.balanceOf(address(oasis));
    }

    function oasisMkrBalance() public view returns (uint256) {
        return mkr.balanceOf(address(oasis));
    }

    function debug() public {
        emit log_named_uint("tester1 dai: ", dai.balanceOf(address(tester1)));
        emit log_named_uint("tester1 mkr: ", mkr.balanceOf(address(tester1)));
        emit log_named_uint("tester2 dai: ", dai.balanceOf(address(tester2)));
        emit log_named_uint("tester2 mkr: ", mkr.balanceOf(address(tester2)));
        emit log_named_uint("tester3 dai: ", dai.balanceOf(address(tester3)));
        emit log_named_uint("tester3 mkr: ", mkr.balanceOf(address(tester3)));
        emit log_named_uint("oasis dai delta: ", oasisDaiBalance());
        emit log_named_uint("oasis mkr delta: ", oasisMkrBalance());
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

contract DustTest is OasisTest, DSMath {
    function testFailDustControl() public {
        (,,uint256 dust,) = oasis.markets(mkrDaiMarketId);
        tester1.sell(dust - 1, 1 ether, 0);
    }

    function testDustControl() public {
        (,,uint256 dust,) = oasis.markets(mkrDaiMarketId);
        tester1.sell(dust, 1 ether, 0);
    }

    function testSellDustLeft1() public {
        tester1.buy(1 ether, 600 ether, 0);
        tester1.buy(1 ether, 500 ether, 0);

        uint256 o3 = tester2.sell(1.99999999 ether, 500 ether, 0);

        assertEq(o3, 0);

        assertEq(oasisDaiBalance(), 0 ether);
        assertEq(oasisMkrBalance(), 0 ether);
    }

    function testSellDustLeft2() public {
        tester1.buy(1 ether, 600 ether, 0);
        tester1.buy(1 ether, 500 ether, 0);

        uint256 o3 = tester2.sell(2.00000001 ether, 500 ether, 0);

        assertEq(o3, 0);

        assertEq(oasisDaiBalance(), 0 ether);
        assertEq(oasisMkrBalance(), 0 ether);
    }

    function testBuyDustLeft1() public {
        tester1.sell(1 ether, 500 ether, 0);
        tester1.sell(1 ether, 600 ether, 0);

        uint256 o3 = tester2.buy(1.99999999 ether, 600 ether, 0);

        assertEq(o3, 0);

        assertEq(oasisDaiBalance(), 0 ether);
        assertEq(oasisMkrBalance(), 0 ether);
    }

    function testBuyDustLeft2() public {
        tester1.sell(1 ether, 500 ether, 0);
        tester1.sell(1 ether, 600 ether, 0);

        uint256 o3 = tester2.buy(2.00000001 ether, 600 ether, 0);

        assertEq(o3, 0);

        assertEq(oasisDaiBalance(), 0 ether);
        assertEq(oasisMkrBalance(), 0 ether);
    }
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

        assertEq(oasisDaiBalance(), 0 ether);
        assertEq(oasisMkrBalance(), 5 ether);

        assertEq(daiDelta(tester1), 0);
        assertEq(mkrDelta(tester1), - 5 ether);
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

        assertEq(oasisDaiBalance(), 0 ether);
        assertEq(oasisMkrBalance(), 5 ether);

        assertEq(daiDelta(tester1), 0);
        assertEq(mkrDelta(tester1), -5 ether);
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

        assertEq(oasisDaiBalance(), 0 ether);
        assertEq(oasisMkrBalance(), 4 ether);

        assertEq(daiDelta(tester1), 0);
        assertEq(mkrDelta(tester1), - 4 ether);
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

        assertEq(oasisDaiBalance(), 2750 ether);
        assertEq(oasisMkrBalance(), 0 ether);

        assertEq(daiDelta(tester1), -2750 ether);
        assertEq(mkrDelta(tester1), 0);
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

        assertEq(oasisDaiBalance(), 2750 ether);
        assertEq(oasisMkrBalance(), 0 ether);

        assertEq(daiDelta(tester1), - 2750 ether);
        assertEq(mkrDelta(tester1), 0);
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

        assertEq(oasisDaiBalance(), 2200 ether);
        assertEq(oasisMkrBalance(), 0 ether);

        assertEq(daiDelta(tester1), - 2200 ether);
        assertEq(mkrDelta(tester1), 0);
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

        assertEq(oasisDaiBalance(), 500 ether);
        assertEq(oasisMkrBalance(), 0 ether);

        assertEq(daiDelta(tester1), -1100 ether);
        assertEq(mkrDelta(tester1), 1 ether);

        assertEq(daiDelta(tester2), 600 ether);
        assertEq(mkr.balanceOf(address(tester2)), MKR_MAX - 1 ether);
    }

    function testMultiSellComplete() public {
        tester1.buy(1 ether, 600 ether, 0);
        tester1.buy(1 ether, 500 ether, 0);

        uint256 o3 = tester2.sell(2 ether, 500 ether, 0);

        assertEq(o3, 0);

        assertEq(sellDepth(), 0);
        assertEq(buyDepth(), 0);

        assertEq(oasisDaiBalance(), 0 ether);
        assertEq(oasisMkrBalance(), 0 ether);

        assertEq(daiDelta(tester1), -1100 ether);
        assertEq(mkrDelta(tester1), 2 ether);

        assertEq(daiDelta(tester2), 1100 ether);
        assertEq(mkrDelta(tester2), -2 ether);
    }

    function testMultiSellCompleteThenMake() public {
        tester1.buy(1 ether, 600 ether, 0);
        tester1.buy(1 ether, 500 ether, 0);

        uint256 o3 = tester2.sell(3 ether, 500 ether, 0);

        assertTrue(o3 != 0);

        assertEq(sellDepth(), 1);
        assertEq(buyDepth(), 0);

        assertEq(oasisDaiBalance(), 0 ether);
        assertEq(oasisMkrBalance(), 1 ether);

        assertEq(daiDelta(tester1), -1100 ether);
        assertEq(mkrDelta(tester1), 2 ether);

        assertEq(daiDelta(tester2), 1100 ether);
        assertEq(mkrDelta(tester2), -3 ether);
    }

    function testSingleSellIncomplete() public {
        uint256 o1 = tester1.buy(1 ether, 600 ether, 0);
        tester1.buy(1 ether, 500 ether, 0);

        assertEq(oasisDaiBalance(), 1100 ether);

        uint256 o3 = tester2.sell(0.5 ether, 600 ether, 0);

        assertEq(o3, 0);

        assertEq(sellDepth(), 0);
        assertEq(buyDepth(), 2);

        (uint256 baseAmt,,,,) = order(o1);

        assertEq(baseAmt, 0.5 ether);

        assertEq(oasisDaiBalance(), 800 ether);
        assertEq(oasisMkrBalance(), 0 ether);

        assertEq(daiDelta(tester1), -1100 ether);
        assertEq(mkrDelta(tester1), 0.5 ether);

        assertEq(daiDelta(tester2), 300 ether);
        assertEq(mkrDelta(tester2), -0.5 ether);
    }

    function testMultiSellIncomplete() public {
        tester1.buy(1 ether, 600 ether, 0);
        uint256 o2 = tester1.buy(1 ether, 500 ether, 0);

        assertEq(oasisDaiBalance(), 1100 ether);

        uint256 o3 = tester2.sell(1.5 ether, 500 ether, 0);

        assertEq(o3, 0);

        assertEq(sellDepth(), 0);
        assertEq(buyDepth(), 1);

        (uint256 baseAmt,,,,) = order(o2);

        assertEq(baseAmt, 0.5 ether);

        assertEq(oasisDaiBalance(), 250 ether);
        assertEq(oasisMkrBalance(), 0 ether);

        assertEq(daiDelta(tester1), -1100 ether);
        assertEq(mkrDelta(tester1), 1.5 ether);

        assertEq(daiDelta(tester2), 850 ether);
        assertEq(mkrDelta(tester2), -1.5 ether);
    }

    function testSingleBuyComplete() public {
        tester1.sell(1 ether, 500 ether, 0);
        tester1.sell(1 ether, 600 ether, 0);

        assertEq(sellDepth(), 2);
        assertEq(buyDepth(), 0);

        uint256 o3 = tester2.buy(1 ether, 500 ether, 0);

        assertEq(o3, 0);

        assertEq(sellDepth(), 1);
        assertEq(buyDepth(), 0);

        assertEq(oasisDaiBalance(), 0 ether);
        assertEq(oasisMkrBalance(), 1 ether);

        assertEq(daiDelta(tester1), 500 ether);
        assertEq(mkrDelta(tester1), -2 ether);

        assertEq(daiDelta(tester2), -500 ether);
        assertEq(mkrDelta(tester2), 1 ether);
    }

    function testMultiBuyComplete() public {
        tester1.sell(1 ether, 500 ether, 0);
        tester1.sell(1 ether, 600 ether, 0);

        uint256 o3 = tester2.buy(2 ether, 600 ether, 0);

        assertEq(o3, 0);

        assertEq(sellDepth(), 0);
        assertEq(buyDepth(), 0);

        assertEq(oasisDaiBalance(), 0 ether);
        assertEq(oasisMkrBalance(), 0 ether);

        assertEq(daiDelta(tester1), 1100 ether);
        assertEq(mkrDelta(tester1), -2 ether);

        assertEq(daiDelta(tester2), -1100 ether);
        assertEq(mkrDelta(tester2), 2 ether);
    }

    function testMultiBuyCompleteThenMake() public {
        tester1.sell(1 ether, 500 ether, 0);
        tester1.sell(1 ether, 600 ether, 0);

        uint256 o3 = tester2.buy(3 ether, 600 ether, 0);

        assertTrue(o3 != 0);

        assertEq(sellDepth(), 0);
        assertEq(buyDepth(), 1);

        assertEq(oasisDaiBalance(), 600 ether);
        assertEq(oasisMkrBalance(), 0 ether);

        assertEq(daiDelta(tester1), 1100 ether);
        assertEq(mkrDelta(tester1), -2 ether);

        assertEq(daiDelta(tester2), -1700 ether);
        assertEq(mkrDelta(tester2), 2 ether);
    }

    function testSingleBuyIncomplete() public {
        uint256 o1 = tester1.sell(1 ether, 500 ether, 0);
        tester1.sell(1 ether, 600 ether, 0);

        uint256 o3 = tester2.buy(0.5 ether, 500 ether, 0);

        assertEq(o3, 0);

        assertEq(sellDepth(), 2);
        assertEq(buyDepth(), 0);

        (uint256 baseAmt,,,,) = order(o1);

        assertEq(baseAmt, 0.5 ether);

        assertEq(oasisDaiBalance(), 0 ether);
        assertEq(oasisMkrBalance(), 1.5 ether);

        assertEq(daiDelta(tester1), 250 ether);
        assertEq(mkrDelta(tester1), -2 ether);

        assertEq(daiDelta(tester2), -250 ether);
        assertEq(mkrDelta(tester2), 0.5 ether);
    }

    function testMultiBuyIncomplete() public {

        tester1.sell(1 ether, 500 ether, 0);
        uint256 o2 = tester1.sell(1 ether, 600 ether, 0);

        uint256 o3 = tester2.buy(1.5 ether, 600 ether, 0);

        assertEq(o3, 0);

        assertEq(sellDepth(), 1);
        assertEq(buyDepth(), 0);

        (uint256 baseAmt,,,,) = order(o2);

        assertEq(baseAmt, 0.5 ether);

        assertEq(oasisDaiBalance(), 0 ether);
        assertEq(oasisMkrBalance(), 0.5 ether);

        assertEq(daiDelta(tester1), 800 ether);
        assertEq(mkrDelta(tester1), -2 ether);

        assertEq(daiDelta(tester2), -800 ether);
        assertEq(mkrDelta(tester2), 1.5 ether);
    }
}
