pragma solidity ^0.5.4;

import "./oasis.t.sol";

contract OasisMakeTest is OasisTest {
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
}