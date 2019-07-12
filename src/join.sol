pragma solidity >=0.5.0;

contract GemLike {
    function transfer(address, uint) public returns (bool);
    function transferFrom(address, address, uint) public returns (bool);
}

contract OasisLike {
    function credit(address, uint) public;
    function debit(address, uint) public;
}

contract GemJoin {
    OasisLike public oasis;
    GemLike public gem;
    constructor(address oasis_, address gem_) public {
        oasis = OasisLike(oasis_);
        gem = GemLike(gem_);
    }
    function join(address usr, uint wad) public {
        oasis.credit(usr, wad);
        require(gem.transferFrom(msg.sender, address(this), wad));
    }

    function exit(address usr, uint wad) public {
        oasis.debit(msg.sender, wad);
        require(gem.transfer(usr, wad));
    }
}

contract ETHWETHJoin is GemJoin {
    function joinETH(address usr) public payable {
        oasis.credit(usr, msg.value);
    }
    // TODO: add exitETH
}
