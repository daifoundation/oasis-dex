// SPDX-License-Identifier: UNLICENSED
pragma solidity >= 0.6.0;
pragma experimental ABIEncoderV2;

import "./OasisBase.sol";
import "./ERC20Like.sol";
import "./TokenAdapter.sol";
import "./STAdapter.sol";

contract OasisNoEscrow is OasisBase {
    ERC20Like public baseTkn;
    ERC20Like public quoteTkn;

    STAdapter public baseAtr;
    TokenAdapter public quoteAtr;

    constructor(
        address baseTkn_, address quoteTkn_,
        address baseAtr_, address quoteAtr_,
        uint tic_, uint dust_
    ) OasisBase(
        ERC20Like(baseTkn_).decimals(),
        ERC20Like(quoteTkn_).decimals(),
        tic_,
        dust_
    ) {
        baseTkn = ERC20Like(baseTkn_);
        quoteTkn = ERC20Like(quoteTkn_);
        baseAtr = STAdapter(baseAtr_);
        quoteAtr = TokenAdapter(quoteAtr_);
    }

    function ioc(
        uint amount, uint price, bool buying
    ) public override returns (uint left, uint total) {
        require(isWhitelisted(msg.sender), 'taker-not-whitelisted');
        return super.ioc(amount, price, buying);
    }

    function escrow(address owner, bool buying, uint amt) internal override {
        ERC20Like tkn = buying ? quoteTkn : baseTkn;
        // require(tkn.balanceOf(owner) >= amt, 'maker-balance-to-low');
        // require(tkn.allowance(owner, address(this)) >= amt, 'maker-not-allowed');
        if(!isWhitelisted(owner)) {
            revert('maker-not-whitelisted');
        }
    }

    function deescrow(address owner, bool buying, uint amt) internal override {}

    function hash(string memory str) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(str));
    }

    function swap(
        mapping (uint => Order) storage orders, uint id, Order storage o,
        address taker, bool buying, uint baseAmt, uint quoteAmt
    ) internal override returns (bool result) {
        try this.atomicSwap(taker, o.owner, buying, baseAmt, quoteAmt) {
            return true;
        } catch Error(string memory reason) {
            if(hash(reason) == hash('swap-taker-failed')) {
                revert('taker-fault');
            }
            if(hash(reason) == hash('swap-maker-failed')) {
                remove(orders, id, o);
                return false;
            }
            revert(reason);
        } catch (bytes memory) {
            revert('swap-unhandled');
        }
    }

    function transferFrom(
        TokenAdapter atr, ERC20Like tkn, address from, address to, uint amt
    ) private returns (bool) {
        (bool success, bytes memory returnData) = address(atr).delegatecall(
            abi.encodeWithSelector(TokenAdapter.transferFrom.selector, tkn, from, to, amt)
        );
        return success && abi.decode(returnData, (bool));
    }

    function isWhitelisted(address usr) internal returns (bool) {
        (bool success, bytes memory returnData) = address(baseAtr).delegatecall(
            abi.encodeWithSelector(STAdapter.isWhitelisted.selector, baseTkn, usr)
        );
        return success && abi.decode(returnData, (bool));
    }

    function atomicSwap(
        address taker, address maker, bool buying, uint baseAmt, uint quoteAmt
    ) public {
        require(msg.sender == address(this), 'swap-not-internal');
        if(buying) {
            require(transferFrom(quoteAtr, quoteTkn, taker, maker, quoteAmt), 'swap-taker-failed');
            // taker is whitelisted - checked in ioc
            require(transferFrom(baseAtr, baseTkn, maker, taker, baseAmt), 'swap-maker-failed');
        } else {
            require(isWhitelisted(maker), 'swap-maker-failed');
            require(transferFrom(baseAtr, baseTkn, taker, maker, baseAmt), 'swap-taker-failed');
            require(transferFrom(quoteAtr, quoteTkn, maker, taker, quoteAmt), 'swap-maker-failed');
        }
    }
}
