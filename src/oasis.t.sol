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

    uint DAI_MAX = 1000 ether;
    uint MKR_MAX = 1000 ether;

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

        dai.transfer(address(tester), DAI_MAX);
        tester.approve(dai);

        mkr.transfer(address(tester), MKR_MAX);
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
