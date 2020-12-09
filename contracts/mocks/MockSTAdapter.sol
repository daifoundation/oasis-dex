// SPDX-License-Identifier: UNLICENSED
pragma solidity >= 0.6.0;

import "../ERC20Like.sol";
import "../TokenAdapter.sol";

contract ERC20Adapter is TokenAdapter {
    function transfer(address tkn, address to, uint amt) override external returns (bool) {
        return ERC20Like(tkn).transfer(to, amt);
    }
    function transferFrom(address tkn, address from, address to, uint amt) override external returns (bool) {
        return ERC20Like(tkn).transferFrom(from, to, amt);
    }
}

contract MockSTAdapter is STAdapter {
    function transfer(address tkn, address to, uint amt) override external returns (bool) {
        return ERC20Like(tkn).transfer(to, amt);
    }
    function transferFrom(address tkn, address from, address to, uint amt) override external returns (bool) {
        return ERC20Like(tkn).transferFrom(from, to, amt);
    }
    function isWhitelisted(address, address) override external pure returns (bool) {
        return true;
    }
}