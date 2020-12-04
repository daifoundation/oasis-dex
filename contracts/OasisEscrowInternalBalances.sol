// SPDX-License-Identifier: UNLICENSED
pragma solidity >= 0.6.0;

import "./OasisBase.sol";
import "./ERC20Like.sol";


contract OasisEscrowInternalBalances is OasisBase {
    address  public baseTkn;  // base token
    address  public quoteTkn; // quote token
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
        uint tic_, uint dust_
    ) OasisBase(ERC20Like(baseTkn_).decimals(), ERC20Like(quoteTkn_).decimals(), tic_, dust_) {
        baseTkn = baseTkn_;
        quoteTkn = quoteTkn_;
    }

    function join(bool base, address usr, uint amt) virtual public {
        (address tkn, mapping (address => uint) storage bal) =
            base ? (baseTkn, baseBal) : (quoteTkn, quoteBal);
        require(ERC20Like(tkn).transferFrom(msg.sender, address(this), amt));
        bal[usr] = add(bal[usr], amt);
        emit Join(base, msg.sender, usr, amt);
    }

    function exit(bool base, address usr, uint amt) virtual public {
        (address tkn, mapping (address => uint) storage bal) =
            base ? (baseTkn, baseBal) : (quoteTkn, quoteBal);
        bal[msg.sender] = sub(bal[msg.sender], amt);
        require(ERC20Like(tkn).transfer(usr, amt));
        emit Exit(base, msg.sender, usr, amt);
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
