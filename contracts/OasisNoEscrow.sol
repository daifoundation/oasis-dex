// SPDX-License-Identifier: UNLICENSED
pragma solidity >= 0.6.0;

import "./OasisBase.sol";
import "./ERC20Like.sol";

contract OasisNoEscrow is OasisBase {
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

    function baseWhitelisted(address) internal virtual view returns (bool) {
        return true;
    }

    function ioc(
        uint amount, uint price, bool buying
    ) public override returns (uint left, uint total) {
        require(baseWhitelisted(msg.sender), 'taker-not-whitelisted');
        super.ioc(amount, price, buying);
    }

    function escrow(address owner, bool buying, uint amt) internal override {
        require((buying ? quoteTkn : baseTkn).balanceOf(owner) >= amt, 'maker-balance-to-low');

        if(!baseWhitelisted(owner)) {
            revert('maker-not-whitelisted');
        }
    }

    function deescrow(address owner, bool buying, uint amt) internal override {}

    function swap(
        mapping (uint => Order) storage orders, uint id, Order storage o,
        address taker, bool buying, uint baseAmt, uint quoteAmt
    ) internal override returns (bool result) {
        try this.atomicSwap(taker, o.owner, buying, baseAmt, quoteAmt) {
            return true;
        } catch Error(string memory reason) {
            if(keccak256(abi.encodePacked(reason)) == keccak256(abi.encodePacked('swap-taker-failed'))) {
                revert('taker-fault');
            }
            if(keccak256(abi.encodePacked(reason)) == keccak256(abi.encodePacked('swap-maker-failed'))) {
                remove(orders, id, o);
                return false;
            }
            revert(reason);
        } catch (bytes memory) {
            revert('swap-unhandled');
        }
    }

    function atomicSwap(
        address taker, address maker, bool buying, uint baseAmt, uint quoteAmt
    ) public {
        require(msg.sender == address(this), 'swap-not-internal');
        if(buying) {
            try quoteTkn.transferFrom(taker, maker, quoteAmt) returns (bool r) {
                require(r, 'swap-taker-failed');
            } catch {
                revert('swap-taker-failed');
            }
            // taker is whitelisted - checked in ioc
            try baseTkn.transferFrom(maker, taker, baseAmt) returns (bool r) {
                require(r, 'swap-maker-failed');
            } catch {
                revert('swap-maker-failed');
            }
        } else {
            require(baseWhitelisted(maker), 'swap-maker-failed');
            try baseTkn.transferFrom(taker, maker, baseAmt) returns (bool r) {
                require(r, 'swap-taker-failed');
            } catch {
                revert('swap-taker-failed');
            }
            try quoteTkn.transferFrom(maker, taker, quoteAmt) returns (bool r) {
                require(r, 'swap-maker-failed');
            } catch {
                revert('swap-maker-failed');
            }
        }
    }
}
