pragma solidity >=0.6.0;

abstract contract GemLike {
    function transfer(address, uint) public virtual returns (bool);
    function transferFrom(address, address, uint) public virtual returns (bool);
}

abstract contract OasisLike {
    function credit(address, uint) public virtual;
    function debit(address, uint) public virtual;
}

contract GemJoin {
    GemLike public gem;
    constructor(address gem_) public {
        gem = GemLike(gem_);
    }

    function join(OasisLike oasis, address usr, uint wad) public {
        oasis.credit(usr, wad);
        require(gem.transferFrom(msg.sender, address(this), wad));
    }

    function exit(OasisLike oasis, address usr, uint wad) public {
        oasis.debit(msg.sender, wad);
        require(gem.transfer(usr, wad));
    }
}
