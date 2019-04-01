pragma solidity ^0.5.4;

import "./oasis.t.sol";

contract OasisMakeTest is OasisTest {
    function testFailDustControl() public {
        (,,uint256 dust,) = oasis.markets(mkrDaiMarketId);
        tester1.sell(dust - 1, 1, 0);
    }

    function testDustControl() public {
        (,,uint256 dust,) = oasis.markets(mkrDaiMarketId);
        tester1.sell(dust, 5, 0);
    }

    function testFailTicControl() public {
        (,,uint256 dust, uint256 tic) = oasis.markets(mkrDaiMarketId);
        tester1.sell(dust + tic - 1, 1, 0);
    }

    function testTicControl() public {
        (,,uint256 dust, uint256 tic) = oasis.markets(mkrDaiMarketId);
        tester1.sell(dust + tic, 5, 0);
    }
}