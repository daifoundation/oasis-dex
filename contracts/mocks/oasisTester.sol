// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.6.0;

import "../oasis.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract OasisTester {

    OasisBase public oasis;

    constructor(address _oasis) public {
        oasis = OasisBase(_oasis);
    }

    event LimitResult(uint position, uint left, uint total);

    function limit(
        uint amount, uint price, bool buying, uint pos
    ) public {
        uint position;
        uint left;
        uint total;
        (position, left, total) = oasis.limit(amount, price, buying, pos);
        emit LimitResult(position, left, total);
    }

    function approve(
        ERC20 tkn,
        address spender,
        uint256 amount
    ) public {
        tkn.approve(spender, amount);
    }
}
