// SPDX-License-Identifier: UNLICENSED
pragma solidity >= 0.6.0;

import "./OasisBase.sol";
import "./ERC20Like.sol";

contract OasisEscrow is OasisBase {
    ERC20Like public baseTkn;
    ERC20Like public quoteTkn;

    constructor(
        address baseTkn_, address quoteTkn_,
        uint tic_, uint dust_
    ) OasisBase(
        ERC20Like(baseTkn_).decimals(),
        ERC20Like(quoteTkn_).decimals(),
        tic_,
        dust_
    ) {
        baseTkn = ERC20Like(baseTkn_);
        quoteTkn = ERC20Like(quoteTkn_);
    }

    function escrow(address owner, bool buying, uint amt) internal override {
        require((buying ? quoteTkn : baseTkn).transferFrom(owner, address(this), amt));
    }

    function deescrow(address owner, bool buying, uint amt) internal override {
        require((buying ? quoteTkn : baseTkn).transfer(owner, amt));
    }

    function swap(
        mapping (uint => Order) storage, uint, Order storage o,
        address taker, bool buying, uint baseAmt, uint quoteAmt
    ) internal override returns (bool result) {
        if(buying) {
            require(quoteTkn.transferFrom(taker, o.owner, quoteAmt));
            require(baseTkn.transfer(taker, baseAmt));
        } else {
            require(baseTkn.transferFrom(taker, o.owner, baseAmt));
            require(quoteTkn.transfer(taker, quoteAmt));
        }
        return true;
    }
}
