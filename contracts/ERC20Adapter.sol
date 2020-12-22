// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.5;

import "./ERC20Like.sol";
import "./TokenAdapter.sol";

contract ERC20Adapter is TokenAdapter {
    function transfer(address tkn, address to, uint amt) override external returns (bool) {
        return ERC20Like(tkn).transfer(to, amt);
    }
    function transferFrom(address tkn, address from, address to, uint amt) override external returns (bool) {
        return ERC20Like(tkn).transferFrom(from, to, amt);
    }
}
