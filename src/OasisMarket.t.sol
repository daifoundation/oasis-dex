pragma solidity ^0.5.4;

import "ds-test/test.sol";

import "./OasisMarket.sol";

contract OasisMarketTest is DSTest {
    OasisMarket market;

    function setUp() public {
        market = new OasisMarket();
    }

    function testFail_basic_sanity() public {
        assertTrue(false);
    }

    function test_basic_sanity() public {
        assertTrue(true);
    }
}
