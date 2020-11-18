pragma solidity >= 0.6.0;

abstract contract OasisBase {
    uint constant private SENTINEL = 0;
    uint private lastId = 1;

    uint public  dust;     // dust
    uint public  tic;      // dict

    uint public  baseDec;  // base token decimals
    uint public  quoteDec; // quote token decimals
    uint private baseAvailableDec; // base token decimals available for usage

    mapping (uint => Order) public sells; // sorted sell orders
    mapping (uint => Order) public buys;  // sorted buy orders

    struct Order {
        uint     baseAmt;
        uint     price;
        address  owner;
        uint     prev;
        uint     next;
    }

    constructor(uint baseDec_, uint quoteDec_, uint tic_, uint ticUnusedDec_, uint dust_) public {
        baseDec = baseDec_;
        quoteDec = quoteDec_;

        dust = dust_;
        tic = tic_;

        require(unusedDec(tic, ticUnusedDec_), 'ticUnusedDec-too-big');
        require(!unusedDec(tic, ticUnusedDec_ + 1), 'ticUnusedDec-too-small');
        baseAvailableDec =  ticUnusedDec_ > baseDec ? baseDec : ticUnusedDec_;
    }

    function unusedDec(uint x, uint d) internal pure returns (bool) {
        return ((x / 10 ** d) * 10 ** d) == x;
    }

    function cancel(bool buying, uint id) public {

        require(id != SENTINEL, 'sentinel-forever');

        mapping (uint => Order) storage orders = buying ? buys : sells;

        Order storage o = orders[id];
        require(o.baseAmt > 0, 'no-order');
        require(msg.sender == o.owner, 'only-owner');

        deescrow(o.owner, buying, buying ? quote(o.baseAmt, o.price) : o.baseAmt);

        remove(orders, id, o);
        return;
    }

    function getOrder(
        bool buying, uint orderId
    ) public view returns (
    // TODO: is it possible to return just Order?
        uint baseAmt, uint price, address owner, uint prev, uint next
    ) {
        Order storage o = (buying ? buys : sells)[orderId];
        return (o.baseAmt, o.price, o.owner, o.prev, o.next);
    }

    // immediate or cancel
    function ioc(
        uint amount, uint price, bool buying
    ) public returns (uint left, uint total) {

        // tic controll
        require(price % tic == 0, 'tic');

        // precision controll
        require(unusedDec(amount, baseAvailableDec), 'base-dirty');

        // limit order matching
        mapping (uint => Order) storage orders = buying ? sells : buys;
        uint id = orders[SENTINEL].next;
        Order storage o = orders[id];
        left = amount;
        total = 0;
        while(id != SENTINEL && (buying ? price >= o.price : price <= o.price)) {
            uint next = o.next;
            (left, total) = take(buying, orders, id, o, left, total);
            if(left == 0) {
                return (0, total);
            }
            o = orders[id = next];
        }
        return (left, total);
    }

    // fill or kill
    function fok(
        uint amount, uint price, bool buying, uint totalLimit
    ) public returns (uint left, uint total) {
        (left, total) = ioc(amount, price, buying);
        require(buying ? total <= totalLimit : total >= totalLimit);
    }

    // limit order
    function limit(
        uint amount, uint price, bool buying, uint pos
    ) public returns (uint, uint, uint) {
        (uint left, uint total) = ioc(amount, price, buying);

        if(left > 0) {
            return (make(buying, left, price, pos), left, total);
        }

        return (0, left, total);
    }

    // private methods
    function next(
        mapping (uint => Order) storage orders, bool buying, uint price, uint pos
    ) private view returns (Order storage o) {
        o = orders[pos];
        if(o.baseAmt > 0) {
            // backtrack if necessary
            while(o.prev != SENTINEL && (buying ? o.price < price : o.price > price)) {
                o = orders[pos = o.prev]; // previous
            }
        } else {
            o = orders[pos = orders[SENTINEL].next]; // first
        }
        while(pos != SENTINEL && (buying ? o.price >= price : o.price <= price)) {
            o = orders[pos = o.next]; // next
        }
    }

    function swap(
        mapping (uint => Order) storage orders, uint id, Order storage o,
        address taker, bool buying, uint baseAmt, uint quoteAmt
    ) internal virtual returns (bool result);

    function quote(uint base, uint price) internal view returns (uint q) {
        require(
            ((q = (base * price) / 10**baseDec ) * 10**quoteDec) / price == base,
            'quote-inaccurate'
        );
    }

    // fills an order
    function take(
        bool buying,
        mapping (uint => Order) storage orders, uint id, Order storage o,
        uint left, uint total
    ) internal returns (uint, uint) { // left total

        uint baseAmt = left >= o.baseAmt ? o.baseAmt : left;
        uint quoteAmt = quote(baseAmt, o.price);

        bool swapped = swap(
            orders, id, o,
            msg.sender, buying, baseAmt, quoteAmt
        );

        if(!swapped) {
            return (left, total);
        }

        if(left >= o.baseAmt) {
            remove(orders, id, o);
            return (left - baseAmt, add(total, quoteAmt));
        }

        //remaining amounts
        baseAmt = o.baseAmt - baseAmt;
        quoteAmt = quote(baseAmt, o.price);
        if(quoteAmt < dust) {
            deescrow(o.owner, buying, buying ? baseAmt : quoteAmt);
            remove(orders, id, o);
            return (0, add(total, quoteAmt));
        }

        o.baseAmt = baseAmt;
        return (0, add(total, quoteAmt));
    }

    // puts a new order into the order book
    function make(
        bool buying, uint baseAmt, uint price, uint pos
    ) private returns (uint) {

        // dust controll
        uint quoteAmt = quote(baseAmt, price);
        if(quoteAmt < dust) {
            return 0;
        }

        mapping (uint => Order) storage orders = buying ? buys : sells;

        Order storage o = next(orders, buying, price, pos);

        require(baseAmt > 0);
        require(price > 0);

        Order storage n = orders[++lastId];

        n.next = orders[o.prev].next; // o.id
        n.prev = o.prev;
        orders[o.prev].next = lastId;
        o.prev = lastId;

        n.owner = msg.sender;
        n.baseAmt = baseAmt;
        n.price = price;

        escrow(msg.sender, buying, buying ? quoteAmt : baseAmt);

        return lastId;
    }

    // remove an order from the double-linked list
    function remove(
        mapping (uint => Order) storage orders, uint id, Order storage order
    ) internal {
        require(id != SENTINEL, 'sentinel-forever');
        orders[order.next].prev = order.prev;
        orders[order.prev].next = order.next;
        delete orders[id];
    }

    function escrow(address owner, bool buying, uint amt) internal virtual;
    function deescrow(address owner, bool buying, uint amt) internal virtual;

    function add(uint x, uint y) internal pure returns (uint z) {
        require((z = x + y) >= x, 'add-overflow');
    }

    function sub(uint x, uint y) public pure returns (uint z) {
        require((z = x - y) <= x, "sub-underflow");
    }
}

contract Oasis is OasisBase {
    address  public baseTkn;  // base adapter address
    address  public quoteTkn; // quote adapter address
    mapping (address => mapping (address => uint)) public gems; // adapter -> user -> amount

    constructor(
        address baseTkn_, address quoteTkn_,
        uint baseDec_, uint quoteDec_,
        uint tic_, uint ticUnusedDec_,
        uint dust_
    ) public OasisBase(baseDec_, quoteDec_, tic_, ticUnusedDec_, dust_) {
        baseTkn = baseTkn_;
        quoteTkn = quoteTkn_;
    }

    function credit(address usr, uint wad) public {
        require(msg.sender == baseTkn || msg.sender == quoteTkn, 'invalid-adapter');
        credit(usr, msg.sender, wad);
    }

    function debit(address usr, uint wad) public {
        require(msg.sender == baseTkn || msg.sender == quoteTkn, 'invalid-adapter');
        debit(usr, msg.sender, wad);
    }

    function credit(address usr, address gem, uint wad) private { // should be private after linking
        gems[gem][usr] = add(gems[gem][usr], wad);
    }

    function debit(address usr, address gem, uint wad) private { // should be private after linking
        gems[gem][usr] = sub(gems[gem][usr], wad);
    }

    function escrow(address owner, bool buying, uint amt) internal override {
        debit(owner, buying ? quoteTkn : baseTkn, amt);
    }

    function deescrow(address owner, bool buying, uint amt) internal override {
        credit(owner, buying ? quoteTkn : baseTkn, amt);
    }

    function swap(
        mapping (uint => Order) storage, uint, Order storage o,
        address taker, bool buying, uint baseAmt, uint quoteAmt
    ) internal override returns (bool result) {
        if(buying) {
            debit(taker, quoteTkn, quoteAmt);
            credit(o.owner, quoteTkn, quoteAmt);
            credit(taker, baseTkn, baseAmt);
        } else {
            debit(taker, baseTkn, baseAmt);
            credit(o.owner, baseTkn, baseAmt);
            credit(taker, quoteTkn, quoteAmt);
        }
        return true;
    }
}

abstract contract ERC20Like {
    function transfer(address, uint) public virtual returns (bool);
    function transferFrom(address, address, uint) public virtual returns (bool);
}

contract OasisEscrowNoAdapters is OasisBase {
    ERC20Like public baseTkn;
    ERC20Like public quoteTkn;

    constructor(
        address baseTkn_, address quoteTkn_,
        uint baseDec_, uint quoteDec_,
        uint tic_, uint ticUnusedDec_,
        uint dust_
    ) public OasisBase(baseDec_, quoteDec_, tic_, ticUnusedDec_, dust_) {
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

contract OasisNoEscrowNoAdapters is OasisBase {
    ERC20Like public baseTkn;
    ERC20Like public quoteTkn;

    constructor(
        address baseTkn_, address quoteTkn_,
        uint baseDec_, uint quoteDec_,
        uint tic_, uint ticUnusedDec_,
        uint dust_
    ) public OasisBase(baseDec_, quoteDec_, tic_, ticUnusedDec_, dust_) {
        baseTkn = ERC20Like(baseTkn_);
        quoteTkn = ERC20Like(quoteTkn_);
    }

    function escrow(address owner, bool buying, uint amt) internal override {}
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

    // TODO: verify that this is safe?
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
            try baseTkn.transferFrom(maker, taker, baseAmt) returns (bool r) {
                require(r, 'swap-maker-failed');
            } catch {
                revert('swap-maker-failed');
            }
        } else {
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
