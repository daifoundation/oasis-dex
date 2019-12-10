pragma solidity ^0.5.0;

import "ds-test/test.sol";
import "ds-token/base.sol";
import "erc20/erc20.sol";
import "./oasis.sol";
import "./join.sol";

contract Tester {
    Oasis oasis;
    GemJoin daiJoin;
    GemJoin mkrJoin;
    uint mkrDaiMarketId;

    constructor(Oasis oasis_, GemJoin mkrJoin_, GemJoin daiJoin_, uint mkrDaiMarketId_) public {
        oasis = oasis_;
        mkrJoin = mkrJoin_;
        daiJoin = daiJoin_;
        mkrDaiMarketId = mkrDaiMarketId_;
    }

    function joinDai(uint amount) public {
        daiJoin.join(address(this), amount);
    }

    function joinMkr(uint amount) public {
        mkrJoin.join(address(this), amount);
    }

    function exitDai(uint amount) public {
        daiJoin.exit(address(this), amount);
    }

    function exitMkr(uint amount) public {
        mkrJoin.exit(address(this), amount);
    }

    function sell(uint baseAmt, uint price, uint pos) public returns (uint id) {
        (id,,) = oasis.limit(mkrDaiMarketId, baseAmt, price, false, pos);
    }

    function buy(uint baseAmt, uint price, uint pos) public returns (uint id) {
        (id,,) = oasis.limit(mkrDaiMarketId, baseAmt, price, true, pos);
    }

    function cancelBuy(uint offerId) public {
        oasis.cancel(mkrDaiMarketId, true, offerId);
    }

    function cancelSell(uint offerId) public {
        oasis.cancel(mkrDaiMarketId, false, offerId);
    }

    function approve(ERC20 tkn, address adr) public {
        tkn.approve(address(adr), uint(-1));
    }

    function updateBuy(uint id, uint baseAmt, uint price, uint pos) public {
        return oasis.update(mkrDaiMarketId, true, id, baseAmt, price, pos);
    }

    function updateSell(uint id, uint baseAmt, uint price, uint pos) public {
        return oasis.update(mkrDaiMarketId, false, id, baseAmt, price, pos);
    }
}

contract OasisTest is DSTest {

    uint public DAI_MAX = 100000 ether;
    uint public MKR_MAX = 100000 ether;
    uint public DUST = (1 ether) / 10;
    uint public TIC = (1 ether) / 100;

    ERC20 dai;
    ERC20 mkr;

    GemJoin daiJoin;
    GemJoin mkrJoin;

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

        daiJoin = new GemJoin(address(oasis), address(dai));
        mkrJoin = new GemJoin(address(oasis), address(mkr));

        mkrDaiMarketId = oasis.addMarket(
            address(mkrJoin),
            address(daiJoin),
            DUST,
            TIC
        );

        tester1 = setUpTester();
        tester2 = setUpTester();
        tester3 = setUpTester();
        tester4 = setUpTester();
    }

    function setUpTester() private returns (Tester tester) {
        tester = new Tester(oasis, mkrJoin, daiJoin, mkrDaiMarketId);

        dai.transfer(address(tester), DAI_MAX);
        tester.approve(dai, address(daiJoin));

        mkr.transfer(address(tester), MKR_MAX);
        tester.approve(mkr, address(mkrJoin));
    }

    function order(uint id) public view returns (
        uint baseAmt,
        uint price,
        address owner,
        uint prev,
        uint next
    ) {
        (baseAmt, price, owner, prev, next) =
            oasis.getOrder(mkrDaiMarketId, true, id);

        if(baseAmt == 0) {
            (baseAmt, price, owner, prev, next) = oasis.getOrder(mkrDaiMarketId, false, id);
            require(baseAmt > 0);
        }
    }

    // test helpers
    function isSorted() public view returns (bool) {

        // buys descending?
        (, uint price,,, uint next) = oasis.getOrder(mkrDaiMarketId, true, 0);
        while(next != 0) {
            (, price,,, next) = oasis.getOrder(mkrDaiMarketId, true, next);
            (, uint nextPrice,,,) = oasis.getOrder(mkrDaiMarketId, true, next);
            if(next != 0 && nextPrice > price) {
                return false;
            }
        }

        // sells descending?
        (,,,, next) = oasis.getOrder(mkrDaiMarketId, false, 0);
        while(next != 0) {
            (, price,,, next) = oasis.getOrder(mkrDaiMarketId, false, next);
            (, uint nextPrice,,,) = oasis.getOrder(mkrDaiMarketId, false, next);
            if(next != 0 && nextPrice < price) {
                return false;
            }
        }
        return true;
    }

    function sellDepth() public view returns (uint length) {
        (,,,, uint next) = oasis.getOrder(mkrDaiMarketId, false, 0);
        while(next != 0) {
            length++;
            (,,,, next) = oasis.getOrder(mkrDaiMarketId, false, next);
        }
    }

    function buyDepth() public view returns (uint length) {
        (,,,, uint next) = oasis.getOrder(mkrDaiMarketId, true, 0);
        while(next != 0) {
            length++;
            (,,,, next) = oasis.getOrder(mkrDaiMarketId, true, next);
        }
    }

    function daiDelta(Tester t) public view returns (int256) {
        return int256(dai.balanceOf(address(t)) - DAI_MAX);
    }

    function mkrDelta(Tester t) public view returns (int256) {
        return int256(mkr.balanceOf(address(t)) - MKR_MAX);
    }

    function daiBalance(Tester t) public view returns (int256) {
        return int256(oasis.gems(address(daiJoin), address(t)));
    }

    function mkrBalance(Tester t) public view returns (int256) {
        return int256(oasis.gems(address(mkrJoin), address(t)));
    }

    function orderbookDaiBalance() public view returns (uint balance) {
        (uint baseAmt, uint price,,, uint next) = oasis.getOrder(mkrDaiMarketId, true, 0);
        balance = wmul(baseAmt, price);
        while(next != 0) {
            (baseAmt, price,,, next) = oasis.getOrder(mkrDaiMarketId, true, next);
            balance = add(balance, wmul(baseAmt, price));
        }
    }

    function orderbookMkrBalance() public view returns (uint balance) {
        (uint baseAmt,,,, uint next) = oasis.getOrder(mkrDaiMarketId, false, 0);
        balance = baseAmt;
        while(next != 0) {
            (baseAmt,,,, next) = oasis.getOrder(mkrDaiMarketId, false, next);
            balance = add(balance, baseAmt);
        }
    }

    function debug() public {
        emit log_named_uint("tester1 dai: ", dai.balanceOf(address(tester1)));
        emit log_named_uint("tester1 mkr: ", mkr.balanceOf(address(tester1)));
        emit log_named_uint("tester2 dai: ", dai.balanceOf(address(tester2)));
        emit log_named_uint("tester2 mkr: ", mkr.balanceOf(address(tester2)));
        emit log_named_uint("tester3 dai: ", dai.balanceOf(address(tester3)));
        emit log_named_uint("tester3 mkr: ", mkr.balanceOf(address(tester3)));
        emit log_named_uint("orderbook dai balance: ", orderbookDaiBalance());
        emit log_named_uint("orderbook mkr balance: ", orderbookMkrBalance());
        emit log_named_uint("oasis sellDepth: ", sellDepth());
        emit log_named_uint("oasis buyDepth: ", buyDepth());
        assertTrue(false);
    }

    // safe math
    uint constant WAD = 10 ** 18;

    function wmul(uint x, uint y) internal pure returns (uint z) {
        require(y == 0 || ((z = (x * y) / WAD ) * WAD) / y == x, 'wmul-overflow');
    }

    function add(uint x, uint y) internal pure returns (uint z) {
        require((z = x + y) >= x, 'add-overflow');
    }

    function sub(uint x, uint y) internal pure returns (uint z) {
        require((z = x - y) <= x, 'sub-underflow');
    }

}

contract MarketTest is OasisTest {
    function testCreateMarket() public {
        (address baseTkn,,,) = oasis.markets(mkrDaiMarketId);
        assertTrue(baseTkn == address(mkrJoin));
    }
}

contract DustTest is OasisTest, DSMath {
    function testFailDustControl() public {
        tester1.joinMkr(1 ether);
        (,,uint dust,) = oasis.markets(mkrDaiMarketId);
        tester1.sell(dust - 1, 1 ether, 0);
    }

    function testDustControl() public {
        (,,uint dust,) = oasis.markets(mkrDaiMarketId);
        tester1.joinMkr(1 ether);
        tester1.sell(dust, 1 ether, 0);
    }

    function testSellDustLeft1() public {
        tester1.joinDai(1100 ether);
        tester1.buy(1 ether, 600 ether, 0);
        tester1.buy(1 ether, 500 ether, 0);

        tester2.joinMkr(2 ether);
        uint o3 = tester2.sell(1.99999999 ether, 500 ether, 0);

        assertEq(o3, 0);

        assertEq(orderbookDaiBalance(), 0 ether);
        assertEq(orderbookMkrBalance(), 0 ether);
    }

    function testSellDustLeft2() public {
        tester1.joinDai(1100 ether);
        tester1.buy(1 ether, 600 ether, 0);
        tester1.buy(1 ether, 500 ether, 0);

        tester2.joinMkr(2.1 ether);
        uint o3 = tester2.sell(2.00000001 ether, 500 ether, 0);

        assertEq(o3, 0);

        assertEq(orderbookDaiBalance(), 0 ether);
        assertEq(orderbookMkrBalance(), 0 ether);
    }

    function testBuyDustLeft1() public {
        tester1.joinMkr(2 ether);
        tester1.sell(1 ether, 500 ether, 0);
        tester1.sell(1 ether, 600 ether, 0);

        tester2.joinDai(1100 ether);
        uint o3 = tester2.buy(1.99999999 ether, 600 ether, 0);

        assertEq(o3, 0);

        assertEq(orderbookDaiBalance(), 0 ether);
        assertEq(orderbookMkrBalance(), 0 ether);
    }

    function testBuyDustLeft2() public {
        tester1.joinMkr(2.1 ether);
        tester1.sell(1 ether, 500 ether, 0);
        tester1.sell(1 ether, 600 ether, 0);

        tester2.joinDai(1200 ether);
        uint o3 = tester2.buy(2.00000001 ether, 600 ether, 0);

        assertEq(o3, 0);

        assertEq(orderbookDaiBalance(), 0 ether);
        assertEq(orderbookMkrBalance(), 0 ether);
    }
}

contract TicTest is OasisTest {
    function testTicControl() public {
        (,,, uint tic) = oasis.markets(mkrDaiMarketId);
        tester1.joinMkr(1 ether);
        tester1.sell(1 ether, 1 ether + tic, 0);
    }

    function testFailTicControl() public {
        (,,, uint tic) = oasis.markets(mkrDaiMarketId);
        tester1.joinMkr(1 ether);
        tester1.sell(1 ether, 1 ether + tic - 1, 0);
    }
}

contract MakeTest is OasisTest {

    function testSellNoPos() public {

        tester1.joinMkr(5 ether);

        uint o1 = tester1.sell(1 ether, 500 ether, 0);
        uint o2 = tester1.sell(1 ether, 600 ether, 0);

        // mid price
        uint o3 = tester1.sell(1 ether, 550 ether, 0);
        (,,, uint prev, uint next) = order(o3);
        assertEq(prev, o1);
        assertEq(next, o2);
        assertTrue(isSorted());

        // best price
        uint o4 = tester1.sell(1 ether, 450 ether, 0);
        (,,, prev, next) = order(o4);
        assertEq(prev, 0);
        assertEq(next, o1);
        assertTrue(isSorted());

        // worst price
        uint s5 = tester1.sell(1 ether, 650 ether, 0);
        (,,, prev, next) = order(s5);
        assertEq(prev, o2);
        assertEq(next, 0);
        assertTrue(isSorted());

        assertEq(sellDepth(), 5);
        assertEq(buyDepth(), 0);

        assertEq(orderbookDaiBalance(), 0 ether);
        assertEq(orderbookMkrBalance(), 5 ether);

        assertEq(daiDelta(tester1), 0);
        assertEq(mkrDelta(tester1), - 5 ether);
    }

    function testSellPosOk() public {

        tester1.joinMkr(5 ether);

        uint o1 = tester1.sell(1 ether, 500 ether, 0);
        uint o2 = tester1.sell(1 ether, 600 ether, 0);

        // mid price
        uint o3 = tester1.sell(1 ether, 550 ether, o2);
        (,,, uint prev, uint next) = order(o3);
        assertEq(prev, o1);
        assertEq(next, o2);
        assertTrue(isSorted());

        // best price
        uint o4 = tester1.sell(1 ether, 450 ether, o1);
        (,,, prev, next) = order(o4);
        assertEq(prev, 0);
        assertEq(next, o1);
        assertTrue(isSorted());

        // worst price
        uint s5 = tester1.sell(1 ether, 650 ether, o2);
        (,,, prev, next) = order(s5);
        assertEq(prev, o2);
        assertEq(next, 0);
        assertTrue(isSorted());

        assertEq(sellDepth(), 5);
        assertEq(buyDepth(), 0);

        assertEq(orderbookDaiBalance(), 0 ether);
        assertEq(orderbookMkrBalance(), 5 ether);

        assertEq(daiDelta(tester1), 0);
        assertEq(mkrDelta(tester1), -5 ether);
    }

    function testSellPosWrong() public {

        tester1.joinMkr(4 ether);

        uint o1 = tester1.sell(1 ether, 500 ether, 0);
        uint o2 = tester1.sell(1 ether, 600 ether, 0);

        // price after pos
        uint o3 = tester1.sell(1 ether, 650 ether, o2);
        (,,, uint prev, uint next) = order(o3);
        assertEq(prev, o2);
        assertEq(next, 0);
        assertTrue(isSorted());

        // price much before pos
        uint o4 = tester1.sell(1 ether, 450 ether, o2);
        (,,, prev, next) = order(o4);
        assertEq(prev, 0);
        assertEq(next, o1);
        assertTrue(isSorted());

        assertEq(sellDepth(), 4);
        assertEq(buyDepth(), 0);

        assertEq(orderbookDaiBalance(), 0 ether);
        assertEq(orderbookMkrBalance(), 4 ether);

        assertEq(daiDelta(tester1), 0);
        assertEq(mkrDelta(tester1), - 4 ether);
    }

    function testBuyNoPos() public {

        tester1.joinDai(2750 ether);

        uint o1 = tester1.buy(1 ether, 500 ether, 0);
        uint o2 = tester1.buy(1 ether, 600 ether, 0);

        // mid price
        uint o3 = tester1.buy(1 ether, 550 ether, 0);
        (,,, uint prev, uint next) = order(o3);
        assertEq(prev, o2);
        assertEq(next, o1);
        assertTrue(isSorted());

        // best price
        uint o4 = tester1.buy(1 ether, 450 ether, 0);
        (,,, prev, next) = order(o4);
        assertEq(prev, o1);
        assertEq(next, 0);
        assertTrue(isSorted());

        // worst price
        uint s5 = tester1.buy(1 ether, 650 ether, 0);
        (,,, prev, next) = order(s5);
        assertEq(prev, 0);
        assertEq(next, o2);
        assertTrue(isSorted());

        assertEq(sellDepth(), 0);
        assertEq(buyDepth(), 5);

        assertEq(orderbookDaiBalance(), 2750 ether);
        assertEq(orderbookMkrBalance(), 0 ether);

        assertEq(daiDelta(tester1), -2750 ether);
        assertEq(mkrDelta(tester1), 0);
    }

    function testBuyPosOk() public {

       tester1.joinDai(2750 ether);

        uint o1 = tester1.buy(1 ether, 500 ether, 0);
        uint o2 = tester1.buy(1 ether, 600 ether, 0);

        // mid price
        uint o3 = tester1.buy(1 ether, 550 ether, o2);
        (,,, uint prev, uint next) = order(o3);
        assertEq(prev, o2);
        assertEq(next, o1);
        assertTrue(isSorted());

        // best price
        uint o4 = tester1.buy(1 ether, 650 ether, 0);
        (,,, prev, next) = order(o4);
        assertEq(prev, 0);
        assertEq(next, o2);
        assertTrue(isSorted());

        // worst price
        uint s5 = tester1.buy(1 ether, 450 ether, 0);
        (,,, prev, next) = order(s5);
        assertEq(prev, o1);
        assertEq(next, 0);
        assertTrue(isSorted());

        assertEq(sellDepth(), 0);
        assertEq(buyDepth(), 5);

        assertEq(orderbookDaiBalance(), 2750 ether);
        assertEq(orderbookMkrBalance(), 0 ether);

        assertEq(daiDelta(tester1), -2750 ether);
        assertEq(mkrDelta(tester1), 0);
    }

    function testBuyPosWrong() public {

       tester1.joinDai(2200 ether);

        uint o1 = tester1.buy(1 ether, 500 ether, 0);
        uint o2 = tester1.buy(1 ether, 600 ether, 0);

        // price after pos
        uint o3 = tester1.buy(1 ether, 650 ether, o2);
        (,,, uint prev, uint next) = order(o3);
        assertEq(prev, 0);
        assertEq(next, o2);
        assertTrue(isSorted());

        // price much before pos
        uint o4 = tester1.buy(1 ether, 450 ether, o2);
        (,,, prev, next) = order(o4);
        assertEq(prev, o1);
        assertEq(next, 0);
        assertTrue(isSorted());

        assertEq(sellDepth(), 0);
        assertEq(buyDepth(), 4);

        assertEq(orderbookDaiBalance(), 2200 ether);
        assertEq(orderbookMkrBalance(), 0 ether);

        assertEq(daiDelta(tester1), -2200 ether);
        assertEq(mkrDelta(tester1), 0);
    }
}

contract TakeTest is OasisTest {
    function testSingleSellComplete() public {

        tester1.joinDai(1100 ether);
        tester1.buy(1 ether, 600 ether, 0);
        tester1.buy(1 ether, 500 ether, 0);

        assertEq(sellDepth(), 0);
        assertEq(buyDepth(), 2);

        tester2.joinMkr(1 ether);
        uint o3 = tester2.sell(1 ether, 600 ether, 0);

        assertEq(o3, 0);

        assertEq(sellDepth(), 0);
        assertEq(buyDepth(), 1);

        // debug();

        assertEq(orderbookDaiBalance(), 500 ether);
        assertEq(orderbookMkrBalance(), 0 ether);

        assertEq(daiDelta(tester1), -1100 ether);
        assertEq(daiBalance(tester1), 0 ether);
        assertEq(mkrBalance(tester1), 1 ether);

        assertEq(daiBalance(tester2), 600 ether);
        assertEq(mkrBalance(tester2), 0 ether);
        assertEq(mkrDelta(tester2), -1 ether);
    }

    function testMultiSellComplete() public {

        tester1.joinDai(1100 ether);
        tester1.buy(1 ether, 600 ether, 0);
        tester1.buy(1 ether, 500 ether, 0);

        tester2.joinMkr(2 ether);
        uint o3 = tester2.sell(2 ether, 500 ether, 0);

        assertEq(o3, 0);

        assertEq(sellDepth(), 0);
        assertEq(buyDepth(), 0);

        assertEq(orderbookDaiBalance(), 0 ether);
        assertEq(orderbookMkrBalance(), 0 ether);

        assertEq(daiDelta(tester1), -1100 ether);
        assertEq(daiBalance(tester1), 0 ether);
        assertEq(mkrBalance(tester1), 2 ether);


        assertEq(daiBalance(tester2), 1100 ether);
        assertEq(mkrBalance(tester2), 0 ether);
        assertEq(mkrDelta(tester2), -2 ether);
    }

    function testMultiSellCompleteThenMake() public {

        tester1.joinDai(1100 ether);
        tester1.buy(1 ether, 600 ether, 0);
        tester1.buy(1 ether, 500 ether, 0);

        tester2.joinMkr(3 ether);
        uint o3 = tester2.sell(3 ether, 500 ether, 0);

        assertTrue(o3 != 0);

        assertEq(sellDepth(), 1);
        assertEq(buyDepth(), 0);

        assertEq(orderbookDaiBalance(), 0 ether);
        assertEq(orderbookMkrBalance(), 1 ether);

        assertEq(daiDelta(tester1), -1100 ether);
        assertEq(daiBalance(tester1), 0 ether);
        assertEq(mkrBalance(tester1), 2 ether);

        assertEq(daiBalance(tester2), 1100 ether);
        assertEq(mkrBalance(tester2), 0 ether);
        assertEq(mkrDelta(tester2), -3 ether);
    }

    function testSingleSellIncomplete() public {

        tester1.joinDai(1100 ether);
        uint o1 = tester1.buy(1 ether, 600 ether, 0);
        tester1.buy(1 ether, 500 ether, 0);

        assertEq(orderbookDaiBalance(), 1100 ether);

        tester2.joinMkr(0.5 ether);
        uint o3 = tester2.sell(0.5 ether, 600 ether, 0);

        assertEq(o3, 0);

        assertEq(sellDepth(), 0);
        assertEq(buyDepth(), 2);

        (uint baseAmt,,,,) = order(o1);

        assertEq(baseAmt, 0.5 ether);

        assertEq(orderbookDaiBalance(), 800 ether);
        assertEq(orderbookMkrBalance(), 0 ether);

        assertEq(daiDelta(tester1), -1100 ether);
        assertEq(mkrBalance(tester1), 0.5 ether);
        assertEq(daiBalance(tester1), 0 ether);

        assertEq(daiBalance(tester2), 300 ether);
        assertEq(mkrBalance(tester2), 0 ether);
        assertEq(mkrDelta(tester2), -0.5 ether);
    }

    function testMultiSellIncomplete() public {

        tester1.joinDai(1100 ether);
        tester1.buy(1 ether, 600 ether, 0);
        uint o2 = tester1.buy(1 ether, 500 ether, 0);

        assertEq(orderbookDaiBalance(), 1100 ether);

        tester2.joinMkr(1.5 ether);
        uint o3 = tester2.sell(1.5 ether, 500 ether, 0);

        assertEq(o3, 0);

        assertEq(sellDepth(), 0);
        assertEq(buyDepth(), 1);

        (uint baseAmt,,,,) = order(o2);

        assertEq(baseAmt, 0.5 ether);

        assertEq(orderbookDaiBalance(), 250 ether);
        assertEq(orderbookMkrBalance(), 0 ether);

        assertEq(daiDelta(tester1), -1100 ether);
        assertEq(daiBalance(tester1), 0 ether);
        assertEq(mkrBalance(tester1), 1.5 ether);

        assertEq(daiBalance(tester2), 850 ether);
        assertEq(mkrBalance(tester2), 0 ether);
        assertEq(mkrDelta(tester2), -1.5 ether);
    }

    function testSingleBuyComplete() public {

        tester1.joinMkr(2 ether);
        tester1.sell(1 ether, 500 ether, 0);
        tester1.sell(1 ether, 600 ether, 0);

        assertEq(sellDepth(), 2);
        assertEq(buyDepth(), 0);

        tester2.joinDai(500 ether);
        uint o3 = tester2.buy(1 ether, 500 ether, 0);

        assertEq(o3, 0);

        assertEq(sellDepth(), 1);
        assertEq(buyDepth(), 0);

        assertEq(orderbookDaiBalance(), 0 ether);
        assertEq(orderbookMkrBalance(), 1 ether);

        assertEq(daiBalance(tester1), 500 ether);
        assertEq(mkrBalance(tester1), 0 ether);
        assertEq(mkrDelta(tester1), -2 ether);

        assertEq(daiDelta(tester2), -500 ether);
        assertEq(mkrBalance(tester2), 1 ether);
        assertEq(daiBalance(tester2), 0 ether);
    }

    function testMultiBuyComplete() public {

        tester1.joinMkr(2 ether);
        tester1.sell(1 ether, 500 ether, 0);
        tester1.sell(1 ether, 600 ether, 0);

        tester2.joinDai(1200 ether);
        uint o3 = tester2.buy(2 ether, 600 ether, 0);

        assertEq(o3, 0);

        assertEq(sellDepth(), 0);
        assertEq(buyDepth(), 0);

        assertEq(orderbookDaiBalance(), 0 ether);
        assertEq(orderbookMkrBalance(), 0 ether);

        assertEq(daiBalance(tester1), 1100 ether);
        assertEq(mkrBalance(tester1), 0 ether);
        assertEq(mkrDelta(tester1), -2 ether);

        assertEq(daiDelta(tester2), -1200 ether);
        assertEq(mkrBalance(tester2), 2 ether);
        assertEq(daiBalance(tester2), 100 ether);
    }

    function testMultiBuyCompleteThenMake() public {

        tester1.joinMkr(2 ether);
        tester1.sell(1 ether, 500 ether, 0);
        tester1.sell(1 ether, 600 ether, 0);

        tester2.joinDai(1800 ether);
        uint o3 = tester2.buy(3 ether, 600 ether, 0);

        assertTrue(o3 != 0);

        assertEq(sellDepth(), 0);
        assertEq(buyDepth(), 1);

        assertEq(orderbookDaiBalance(), 600 ether);
        assertEq(orderbookMkrBalance(), 0 ether);

        assertEq(daiBalance(tester1), 1100 ether);
        assertEq(mkrBalance(tester1), 0 ether);
        assertEq(mkrDelta(tester1), -2 ether);

        assertEq(daiDelta(tester2), -1800 ether);
        assertEq(mkrBalance(tester2), 2 ether);
        assertEq(daiBalance(tester2), 100 ether);
    }

    function testSingleBuyIncomplete() public {

        tester1.joinMkr(2 ether);
        uint o1 = tester1.sell(1 ether, 500 ether, 0);
        tester1.sell(1 ether, 600 ether, 0);

        tester2.joinDai(250 ether);
        uint o3 = tester2.buy(0.5 ether, 500 ether, 0);

        assertEq(o3, 0);

        assertEq(sellDepth(), 2);
        assertEq(buyDepth(), 0);

        (uint baseAmt,,,,) = order(o1);

        assertEq(baseAmt, 0.5 ether);

        assertEq(orderbookDaiBalance(), 0 ether);
        assertEq(orderbookMkrBalance(), 1.5 ether);

        assertEq(daiBalance(tester1), 250 ether);
        assertEq(mkrBalance(tester1), 0 ether);
        assertEq(mkrDelta(tester1), -2 ether);

        assertEq(daiDelta(tester2), -250 ether);
        assertEq(mkrBalance(tester2), 0.5 ether);
        assertEq(daiBalance(tester2), 0 ether);
    }

    function testMultiBuyIncomplete() public {

        tester1.joinMkr(2 ether);

        tester1.sell(1 ether, 500 ether, 0);
        uint o2 = tester1.sell(1 ether, 600 ether, 0);

        tester2.joinDai(900 ether);
        uint o3 = tester2.buy(1.5 ether, 600 ether, 0);

        assertEq(o3, 0);

        assertEq(sellDepth(), 1);
        assertEq(buyDepth(), 0);

        (uint baseAmt,,,,) = order(o2);

        assertEq(baseAmt, 0.5 ether);

        assertEq(orderbookDaiBalance(), 0 ether);
        assertEq(orderbookMkrBalance(), 0.5 ether);

        assertEq(daiBalance(tester1), 800 ether);
        assertEq(mkrBalance(tester1), 0 ether);
        assertEq(mkrDelta(tester1), -2 ether);

        assertEq(daiDelta(tester2), -900 ether);
        assertEq(mkrBalance(tester2), 1.5 ether);
        assertEq(daiBalance(tester2), 100 ether);
    }
}

contract UpdateTest is OasisTest {

    function testBuyUpdateToFrontNoPos() public {

        tester1.joinDai(5000 ether);

        tester1.buy(1 ether, 500 ether, 0);
        uint o2 = tester1.buy(1 ether, 550 ether, 0);
        uint o3 = tester1.buy(1 ether, 600 ether, 0);

        tester1.updateBuy(o2, 2 ether, 650 ether, 0);

        (uint baseAmt, uint price, address owner, uint prev, uint next) = order(o2);

        assertTrue(isSorted());
        assertEq(baseAmt, 2 ether);
        assertEq(price, 650 ether);
        assertEq(owner, address(tester1));
        assertEq(next, o3);
        assertEq(prev, 0);
    }

    function testBuyUpdateToFrontPos() public {

        tester1.joinDai(5000 ether);

        tester1.buy(1 ether, 500 ether, 0);
        uint o2 = tester1.buy(1 ether, 550 ether, 0);
        uint o3 = tester1.buy(1 ether, 600 ether, 0);

        tester1.updateBuy(o2, 2 ether, 650 ether, o3);

        (uint baseAmt, uint price, address owner, uint prev, uint next) = order(o2);

        assertTrue(isSorted());
        assertEq(baseAmt, 2 ether);
        assertEq(price, 650 ether);
        assertEq(owner, address(tester1));
        assertEq(next, o3);
        assertEq(prev, 0);
    }

    function testBuyUpdateToBackNoPos() public {

        tester1.joinDai(5000 ether);

        uint o1 = tester1.buy(1 ether, 500 ether, 0);
        uint o2 = tester1.buy(1 ether, 550 ether, 0);
        tester1.buy(1 ether, 600 ether, 0);

        tester1.updateBuy(o2, 2 ether, 450 ether, 0);

        (uint baseAmt, uint price, address owner, uint prev, uint next) = order(o2);

        assertTrue(isSorted());
        assertEq(baseAmt, 2 ether);
        assertEq(price, 450 ether);
        assertEq(owner, address(tester1));
        assertEq(next, 0);
        assertEq(prev, o1);
    }

    function testBuyUpdateToBackPos() public {

        tester1.joinDai(5000 ether);

        uint o1 = tester1.buy(1 ether, 500 ether, 0);
        uint o2 = tester1.buy(1 ether, 550 ether, 0);
        tester1.buy(1 ether, 600 ether, 0);

        tester1.updateBuy(o2, 2 ether, 450 ether, 0);

        (uint baseAmt, uint price, address owner, uint prev, uint next) = order(o2);

        assertTrue(isSorted());
        assertEq(baseAmt, 2 ether);
        assertEq(price, 450 ether);
        assertEq(owner, address(tester1));
        assertEq(next, 0);
        assertEq(prev, o1);
    }

    function testSellUpdateToFrontNoPos() public {

        tester1.joinMkr(5 ether);

        uint o1 = tester1.sell(1 ether, 500 ether, 0);
        tester1.sell(1 ether, 600 ether, 0);
        uint o3 = tester1.sell(1 ether, 550 ether, 0);

        tester1.updateSell(o3, 2 ether, 450 ether, 0);

        (uint baseAmt, uint price, address owner, uint prev, uint next) = order(o3);

        assertTrue(isSorted());
        assertEq(baseAmt, 2 ether);
        assertEq(price, 450 ether);
        assertEq(owner, address(tester1));
        assertEq(next, o1);
        assertEq(prev, 0);
    }

    function testSellUpdateToFrontPos() public {

        tester1.joinMkr(5 ether);

        uint o1 = tester1.sell(1 ether, 500 ether, 0);
        tester1.sell(1 ether, 600 ether, 0);
        uint o3 = tester1.sell(1 ether, 550 ether, 0);

        tester1.updateSell(o3, 2 ether, 450 ether, o1);

        (uint baseAmt, uint price, address owner, uint prev, uint next) = order(o3);

        assertTrue(isSorted());
        assertEq(baseAmt, 2 ether);
        assertEq(price, 450 ether);
        assertEq(owner, address(tester1));
        assertEq(next, o1);
        assertEq(prev, 0);
    }

    function testSellUpdateToBackNoPos() public {

        tester1.joinMkr(5 ether);

        tester1.sell(1 ether, 500 ether, 0);
        uint o2 = tester1.sell(1 ether, 600 ether, 0);
        uint o3 = tester1.sell(1 ether, 550 ether, 0);

        tester1.updateSell(o3, 2 ether, 650 ether, 0);

        (uint baseAmt, uint price, address owner, uint prev, uint next) = order(o3);

        assertTrue(isSorted());
        assertEq(baseAmt, 2 ether);
        assertEq(price, 650 ether);
        assertEq(owner, address(tester1));
        assertEq(next, 0);
        assertEq(prev, o2);
    }

    function testSellUpdateToBackPos() public {

        tester1.joinMkr(5 ether);

        tester1.sell(1 ether, 500 ether, 0);
        uint o2 = tester1.sell(1 ether, 600 ether, 0);
        uint o3 = tester1.sell(1 ether, 550 ether, 0);

        tester1.updateSell(o3, 2 ether, 650 ether, o2);

        (uint baseAmt, uint price, address owner, uint prev, uint next) = order(o3);

        assertTrue(isSorted());
        assertEq(baseAmt, 2 ether);
        assertEq(price, 650 ether);
        assertEq(owner, address(tester1));
        assertEq(next, 0);
        assertEq(prev, o2);
    }

    function testFailUpdateBuyNoCrossing() public {

        tester1.joinMkr(5 ether);
        tester2.joinDai(1000 ether);

        tester1.sell(1 ether, 500 ether, 0);
        uint o = tester2.buy(1 ether, 450, 0);

        tester2.updateBuy(o, 1 ether, 550, 0);
    }

    function testFailUpdateSellNoCrossing() public {

        tester1.joinMkr(5 ether);
        tester2.joinDai(1000 ether);

        uint o = tester1.sell(1 ether, 500 ether, 0);
        tester2.buy(1 ether, 450, 0);

        tester1.updateSell(o, 1 ether, 400, 0);
    }

}

contract CancelTest is OasisTest {
    function testFailMakeOverflow() public {
        tester1.sell(0.99999999999999999 ether, 500.01 ether, 0);
    }

    function testFailTakeOverflow() public {
        tester1.sell(1 ether, 500 ether, 0);
        tester2.buy(0.99999999999999999 ether, 600.01 ether, 0);
    }
}

contract OverflowProtectionTest is OasisTest {
    function testFailCancelSell() public {

        tester1.joinDai(5000 ether);

        tester1.buy(1 ether, 500 ether, 0);
        uint o2 = tester1.buy(1 ether, 550 ether, 0);
        tester1.buy(1 ether, 600 ether, 0);

        tester1.cancelBuy(o2);

        assertTrue(isSorted());

        order(o2);
    }

    function testFailCancelBuy() public {

        tester1.joinDai(5000 ether);

        tester1.sell(1 ether, 500 ether, 0);
        uint o2 = tester1.sell(1 ether, 550 ether, 0);
        tester1.sell(1 ether, 600 ether, 0);

        tester1.cancelSell(o2);

        assertTrue(isSorted());

        order(o2);
    }



}
