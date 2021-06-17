// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.5;
pragma experimental ABIEncoderV2;

import "./OasisBase.sol";
import "./ERC20Like.sol";
import "./TokenAdapter.sol";

// Not tested, audited, just a research project! Should not be deployed!

contract OasisEscrowInternalBalances is OasisBase {
    ERC20Like  public baseTkn;  // base token
    ERC20Like  public quoteTkn; // quote token

    TokenAdapter public baseAtr;
    TokenAdapter public quoteAtr;

    mapping (address => uint) public baseBal; // user -> amount
    mapping (address => uint) public quoteBal; // user -> amount

    event Join (
        bool base,
        address sender,
        address usr,
        uint amt
    );

    event Exit (
        bool base,
        address sender,
        address usr,
        uint amt
    );

    constructor(
        address baseTkn_, address quoteTkn_,
        address baseAtr_, address quoteAtr_,
        uint tic_, uint dust_
    ) OasisBase(ERC20Like(baseTkn_).decimals(), ERC20Like(quoteTkn_).decimals(), tic_, dust_) {
        baseTkn = ERC20Like(baseTkn_);
        quoteTkn = ERC20Like(quoteTkn_);
        baseAtr = TokenAdapter(baseAtr_);
        quoteAtr = TokenAdapter(quoteAtr_);
    }

    function join(bool base, address usr, uint amt) virtual public {
        (ERC20Like tkn, TokenAdapter atr, mapping (address => uint) storage bal) =
            base ? (baseTkn, baseAtr, baseBal) : (quoteTkn, quoteAtr, quoteBal);

        require(transferFrom(atr, tkn, msg.sender, address(this), amt));
        bal[usr] = add(bal[usr], amt);
        emit Join(base, msg.sender, usr, amt);
    }

    function exit(bool base, address usr, uint amt) virtual public {
        (ERC20Like tkn, TokenAdapter atr, mapping (address => uint) storage bal) =
            base ? (baseTkn, baseAtr, baseBal) : (quoteTkn, baseAtr, quoteBal);
        bal[msg.sender] = sub(bal[msg.sender], amt);
        require(transfer(atr, tkn, usr, amt));
        emit Exit(base, msg.sender, usr, amt);
    }

    function transferFrom(
        TokenAdapter atr, ERC20Like tkn, address from, address to, uint amt
    ) private returns (bool) {
        (bool success, bytes memory returnData) = address(atr).delegatecall(
            abi.encodeWithSelector(TokenAdapter.transferFrom.selector, tkn, from, to, amt)
        );
        return success && abi.decode(returnData, (bool));
    }

    function transfer(
        TokenAdapter atr, ERC20Like tkn, address to, uint amt
    ) private returns (bool) {
        (bool success, bytes memory returnData) = address(atr).delegatecall(
            abi.encodeWithSelector(TokenAdapter.transfer.selector, tkn, to, amt)
        );
        return success && abi.decode(returnData, (bool));
    }

    function escrow(address owner, bool buying, uint amt) internal override {
        mapping (address => uint) storage bal = buying ? quoteBal : baseBal;
        bal[owner] = sub(bal[owner], amt);
    }

    function deescrow(address owner, bool buying, uint amt) internal override {
        mapping (address => uint) storage bal = buying ? quoteBal: baseBal;
        bal[owner] = add(bal[owner], amt);
    }

    function swap(
        mapping (uint => Order) storage, uint, Order storage o,
        address taker, bool buying, uint baseAmt, uint quoteAmt
    ) internal override returns (bool result) {
        if(buying) {
            quoteBal[taker] = sub(quoteBal[taker], quoteAmt);
            quoteBal[o.owner] = add(quoteBal[o.owner], quoteAmt);
            baseBal[taker] = add(baseBal[taker], baseAmt);
        } else {
            baseBal[taker] = sub(baseBal[taker], baseAmt);
            baseBal[o.owner] = add(baseBal[o.owner], baseAmt);
            quoteBal[taker] = add(quoteBal[taker], quoteAmt);
        }
        return true;
    }
}
