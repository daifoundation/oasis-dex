pragma solidity >=0.5.0;

import "ds-test/test.sol";

contract Oasis is DSTest {
    uint constant private SENTINEL = 0;
    uint private lastId = 1;

    address  public baseTkn;
    address  public quoteTkn;
    uint     public dust;
    uint     public tic;

    mapping (uint => Order) sells;
    mapping (uint => Order) buys;

    struct Order {
        uint     baseAmt;
        uint     price;
        address  owner;
        uint     prev;
        uint     next;
    }

    // adapter -> user -> amount
    mapping (address => mapping (address => uint)) public gems;

    constructor(
        address  baseTkn_,
        address  quoteTkn_,
        uint     dust_,
        uint     tic_
    ) public {
        baseTkn = baseTkn_;
        quoteTkn = quoteTkn_;
        dust = dust_;
        tic = tic_;
    }

    function credit(address usr, uint wad) public {
        require(msg.sender == baseTkn || msg.sender == quoteTkn, 'invalid_adapter');
        credit(usr, msg.sender, wad);
    }

    function debit(address usr, uint wad) public {
        require(msg.sender == baseTkn || msg.sender == quoteTkn, 'invalid_adapter');
        debit(usr, msg.sender, wad);
    }

    function cancel(bool buying, uint id) public logs_gas {

        require(id != SENTINEL, 'sentinele_forever');

        mapping (uint => Order) storage orders = buying ? buys : sells;

        Order storage o = orders[id];
        require(o.baseAmt > 0, 'no_order');
        require(msg.sender == o.owner, 'only_owner');

        if(buying) {
            credit(o.owner, quoteTkn, wmul(o.baseAmt, o.price));
        } else {
            credit(o.owner, baseTkn, o.baseAmt);
        }
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
    ) public logs_gas returns (uint left, uint total) {

        // dust controll
        require(wmul(amount, price) >= dust, 'dust');

        // tic controll
        require(price % tic == 0, 'tic');

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
    ) public logs_gas returns (uint left, uint total) {
        (left, total) = ioc(amount, price, buying);
        require(buying ? total <= totalLimit : total >= totalLimit);
    }

    // limit order
    function limit(
        uint amount, uint price, bool buying, uint pos
    ) public logs_gas returns (uint, uint, uint) {
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

    function credit(address usr, address gem, uint wad) private {
        gems[gem][usr] = add(gems[gem][usr], wad);
    }

    function debit(address usr, address gem, uint wad) private {
        gems[gem][usr] = sub(gems[gem][usr], wad);
    }

    // fills an order
    function take(
        bool buying,
        mapping (uint => Order) storage orders, uint id, Order storage o,
        uint left, uint total
    ) private returns (uint, uint) {

        uint baseAmt = left >= o.baseAmt ? o.baseAmt : left;
        uint quoteAmt = wmul(baseAmt, o.price);

        if(buying) {
            debit(msg.sender, quoteTkn, quoteAmt);
            credit(o.owner, quoteTkn, quoteAmt);
            credit(msg.sender, baseTkn, baseAmt);
        } else {
            debit(msg.sender, baseTkn, baseAmt);
            credit(o.owner, baseTkn, baseAmt);
            credit(msg.sender, quoteTkn, quoteAmt);
        }

        if(left >= o.baseAmt) {
            remove(orders, id, o);
            return (left - baseAmt, add(total, quoteAmt));
        }

        baseAmt = o.baseAmt - baseAmt;
        quoteAmt = wmul(baseAmt, o.price);
        if(quoteAmt < dust) {
            // give back
            if(buying) {
                credit(o.owner, baseTkn, baseAmt);
            } else {
                credit(o.owner, quoteTkn, quoteAmt);
            }
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
        uint quoteAmt = wmul(baseAmt, price);
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

        debit(msg.sender, buying ? quoteTkn : baseTkn, buying ? quoteAmt : baseAmt);

        return lastId;
    }

    // remove an order from the double-linked list
    function remove(
        mapping (uint => Order) storage orders, uint id, Order storage order
    ) private {
        require(id != SENTINEL);
        orders[order.next].prev = order.prev;
        orders[order.prev].next = order.next;
        delete orders[id];
    }

    // safe math
    uint constant WAD = 10 ** 18;

    function wmul(uint x, uint y) private pure returns (uint z) {
        require(y == 0 || ((z = (x * y) / WAD ) * WAD) / y == x, 'wmul-overflow');
    }

    function add(uint x, uint y) internal pure returns (uint z) {
        require((z = x + y) >= x, 'add-overflow');
    }

    function sub(uint x, uint y) internal pure returns (uint z) {
        require((z = x - y) <= x, 'sub-underflow');
    }
}
