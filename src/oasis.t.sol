pragma solidity ^0.5.4;

import "ds-test/test.sol";
import "ds-token/base.sol";

import "./oasis.sol";

contract OasisTest is DSTest {

    ERC20 dai;
    ERC20 mkr;

    Oasis oasis;

    uint mkrDaiMarketId;

    function setUp() public {
        dai = new DSTokenBase(10 ** 9);
        mkr = new DSTokenBase(10 ** 6);
        oasis = new Oasis();

        mkrDaiMarketId = oasis.createMarket(
            address(mkr), // baseTkn, 
            1 finney,     // baseDust,    
            address(dai), // quoteTkn, 
            1 finney,     // quoteDust, 
            1 finney      // quoteTick
        );
    }

    function testCreateMarket() public {
        assertTrue(address(oasis.markets[mkrDaiMarketId][0]) == address(mkr));
    }

    function testSellToEmptyOrgerBook() public {
        oasis.sell(mkrDaiMarketId, 1, 500);
    }
}
