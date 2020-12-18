// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.5;

import {ERC20Like} from "../../ERC20Like.sol";
import {STAdapter} from "../../STAdapter.sol";
import "./WithWhitelist.sol";

contract MockSTWhitelistAdapter is STAdapter {
    function transfer(address tkn, address to, uint amt) override external returns (bool) {
        return ERC20Like(tkn).transfer(to, amt);
    }
    function transferFrom(address tkn, address from, address to, uint amt) override external returns (bool) {
        return ERC20Like(tkn).transferFrom(from, to, amt);
    }
    function isWhitelisted(address tkn, address usr) override external view returns (bool) {
        return WithWhitelist(tkn).isWhitelisted(usr);
    }
}
