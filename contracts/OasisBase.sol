// SPDX-License-Identifier: UNLICENSED
pragma solidity >= 0.6.0;
pragma experimental ABIEncoderV2;

abstract contract OasisBase {
    uint constant private SENTINEL = 0;
    uint private lastId = 1;

    uint public  dust;     // dust
    uint public  tic;      // dict

    uint8 public  baseDec;  // base token decimals
    uint8 public  quoteDec; // quote token decimals
    uint8 private baseAvailableDec; // base token decimals available for usage

    mapping (uint => Order) public sells; // sorted sell orders
    mapping (uint => Order) public buys;  // sorted buy orders

    struct Order {
        uint     baseAmt;
        uint     price;
        address  owner;
        uint     prev;
        uint     next;
    }

    event Make(
        uint            id,
        uint            timestamp,
        address indexed maker,
        bool            buying,
        uint            baseAmt,
        uint            price
    );

    event Take(
        uint            id,
        uint            timestamp,
        address indexed taker,
        bool            buying,
        uint            baseAmt,
        uint            price
    );

    event SwapFailed(
        uint            id,
        uint            timestamp,
        address indexed taker,
        bool            buying,
        uint            baseAmt,
        uint            price
    );

    event Cancel(
        uint indexed id,
        uint         timestamp
    );

    constructor(uint8 baseDec_, uint8 quoteDec_, uint tic_, uint dust_) {
        baseDec = baseDec_;
        quoteDec = quoteDec_;

        dust = dust_;
        tic = tic_;

        uint8 ticUnusedDec = 1;
        while(unusedDec(tic, ticUnusedDec)) {
            ticUnusedDec++;
        }
        ticUnusedDec = ticUnusedDec - 1;

        baseAvailableDec =  ticUnusedDec > baseDec ? baseDec : ticUnusedDec;
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

        emit Cancel(id, block.timestamp);

        return;
    }

    function getOrder(bool buying, uint orderId) public view returns (Order memory) {
        return (buying ? buys : sells)[orderId];
    }

    // immediate or cancel
    function ioc(
        uint amount, uint price, bool buying
    ) public virtual returns (uint left, uint total) {

        // tic control
        require(price % tic == 0, 'tic');

        // precision control
        require(unusedDec(amount, baseDec - baseAvailableDec), 'base-dirty');

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
        uint amount, uint price, bool buying
    ) public returns (uint left, uint total) {
        (left, total) = ioc(amount, price, buying);
        require(left == 0, 'fok-not-filled');
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
    function succesor(
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
        q = (base * price) / 10 ** uint(baseDec);
        require((q * 10 ** uint(baseDec)) / price == base, 'quote-inaccurate');
    }

    // fills an order
    function take(
        bool buying,
        mapping (uint => Order) storage orders, uint id, Order storage o,
        uint left, uint total
    ) internal returns (uint, uint) { // left total

        uint baseAmt = left >= o.baseAmt ? o.baseAmt : left;
        uint quoteAmt = quote(baseAmt, o.price);
        uint orderPrice = o.price;

        if(!swap(
            orders, id, o,
            msg.sender, buying, baseAmt, quoteAmt
        )) {
            emit SwapFailed(id, block.timestamp, msg.sender, buying, baseAmt, orderPrice);
            return (left, total);
        }

        emit Take(id, block.timestamp, msg.sender, buying, baseAmt, o.price);

        if(left >= o.baseAmt) {
            remove(orders, id, o);
            return (left - baseAmt, add(total, quoteAmt));
        }

        //remaining amounts
        baseAmt = o.baseAmt - baseAmt;
        uint remainingQuoteAmt = quote(baseAmt, o.price);
        if(remainingQuoteAmt < dust) {
            deescrow(o.owner, buying, buying ? baseAmt : remainingQuoteAmt);
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

        // dust control
        uint quoteAmt = quote(baseAmt, price);
        if(quoteAmt < dust) {
            return 0;
        }

        mapping (uint => Order) storage orders = buying ? buys : sells;

        Order storage o = succesor(orders, buying, price, pos);

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

        emit Make(lastId, block.timestamp, msg.sender, buying, baseAmt, price);

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
