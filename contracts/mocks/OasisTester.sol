// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.6.0;

import "../OasisBase.sol";
import "../OasisEscrowInternalBalances.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract OasisTester {

    address public oasis;

    constructor(address _oasis) {
        oasis = _oasis;
    }

    event LimitResult(uint position, uint left, uint total);
    event FokResult(uint left, uint total);


    function limit(
        uint amount, uint price, bool buying, uint pos
    ) public {
        uint position;
        uint left;
        uint total;
        (position, left, total) = OasisBase(oasis).limit(amount, price, buying, pos);
        emit LimitResult(position, left, total);
    }
    
    function fok(
        uint amount, uint price, bool buying
    ) public {
        uint left;
        uint total;
        (left, total) = OasisBase(oasis).fok(amount, price, buying);
        emit FokResult(left, total);
    }

    function approve(
        ERC20 tkn,
        address spender,
        uint256 amount
    ) public {
        tkn.approve(spender, amount);
    }

    function join(bool base, address usr, uint amt) public {
        OasisEscrowInternalBalances(oasis).join(base, usr, amt);
    }

    function exit(bool base, address usr, uint amt) public {
        OasisEscrowInternalBalances(oasis).exit(base, usr, amt);
    }

    function cancel(bool buying, uint pos) public {
        OasisBase(oasis).cancel(buying, pos);
    }
}
