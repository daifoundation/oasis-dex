pragma solidity >=0.5.0;

contract Oasis {
    uint constant private SENTINEL = 0;
    uint private lastId = 1;

    struct Order {
        uint     baseAmt;
        uint     price;
        address  owner;
        uint     prev;
        uint     next;
    }

    struct Market {
        address  baseTkn;
        address  quoteTkn;
        uint     dust;
        uint     tic;

        mapping (uint => Order) sells;
        mapping (uint => Order) buys;
    }

    mapping (uint => Market) public markets;
    mapping (address => mapping (address => uint)) public gems;

    function getMarketId(
        address baseTkn, address quoteTkn, uint dust, uint tic
    ) public pure returns (uint) {
        return uint(keccak256(abi.encodePacked(baseTkn, quoteTkn, dust, tic)));
    }

    function addMarket(
        address baseTkn, address quoteTkn, uint dust, uint tic
    ) public returns (uint id) {
        id = getMarketId(baseTkn, quoteTkn, dust, tic);
        require(markets[id].baseTkn == address(0), 'market-exists');
        markets[id] = Market(baseTkn, quoteTkn, dust, tic);
    }

    function credit(address usr, uint wad) public {
        credit(usr, msg.sender, wad);
    }

    function debit(address usr, uint wad) public {
        debit(usr, msg.sender, wad);
    }

    // TODO: not tested
    function cancel(uint mId, bool buying, uint id) public {

        require(id != SENTINEL, 'sentinele_forever');

        Market storage m = markets[mId];
        mapping (uint => Order) storage orders = buying ? m.buys : m.sells;

        Order storage o = orders[id];
        require(o.baseAmt > 0, 'no_order');
        require(msg.sender == o.owner, 'only_owner');

        if(buying) {
            credit(o.owner, m.baseTkn, o.baseAmt);
        } else {
            credit(o.owner, m.quoteTkn, wmul(o.baseAmt, o.price));
        }

        remove(orders, id, o);

        return;
    }

    function getOrder(
        uint mId, bool buying, uint orderId
    ) public view returns (
        // TODO: is it possible to return just Order?
        uint baseAmt, uint price, address owner, uint prev, uint next
    ) {
        Market storage m = markets[mId];
        Order storage o = (buying ? m.buys : m.sells)[orderId];
        return (o.baseAmt, o.price, o.owner, o.prev, o.next);
    }

    // Trade implements limit offer. It matches (take) orders until there is nothing
    // else to match. The unmatched part stays on the order book (make)
    function trade(
        uint mId, uint amount, uint price, bool buying, uint pos
    ) public returns (uint) {

        Market storage m = markets[mId];

        // dust controll
        require(wmul(amount, price) >= m.dust, 'dust');

        // tic controll
        require(price % m.tic == 0, 'tic');

        // limit order matching
        mapping (uint => Order) storage orders = buying ? m.sells : m.buys;
        uint id = orders[SENTINEL].next;
        Order storage o = orders[id];
        uint left = amount;
        while(id != SENTINEL && (buying ? price >= o.price : price <= o.price)) {
            uint next = o.next;
            left = take(m, buying, orders, id, o, left);
            if(left == 0) {
              return 0;
            }
            o = orders[id = next];
        }
        return make(m, buying, left, price, pos);
    }

    // private methods
    function credit(address usr, address gem, uint wad) private {
        gems[gem][usr] = add(gems[gem][usr], wad);
    }

    function debit(address usr, address gem, uint wad) private {
        gems[gem][usr] = sub(gems[gem][usr], wad);
    }

    // fills an order
    function take(
        Market storage m, bool buying,
        mapping (uint => Order) storage orders, uint id, Order storage o,
        uint left
    ) private returns (uint) {

        uint baseAmt = left >= o.baseAmt ? o.baseAmt : left;
        uint quoteAmt = wmul(baseAmt, o.price);

        if(buying) {
            debit(msg.sender, m.quoteTkn, quoteAmt);
            credit(o.owner, m.quoteTkn, quoteAmt);
            credit(msg.sender, m.baseTkn, baseAmt);
        } else {
            debit(msg.sender, m.baseTkn, baseAmt);
            credit(o.owner, m.baseTkn, baseAmt);
            credit(msg.sender, m.quoteTkn, quoteAmt);
        }

        if(left >= o.baseAmt) {
            remove(orders, id, o);
            return left - baseAmt;
        }

        baseAmt = o.baseAmt - baseAmt;
        quoteAmt = wmul(baseAmt, o.price);
        if(quoteAmt < m.dust) {
            // give back
            if(buying) {
                // gems[o.owner][m.baseTkn] = add(gems[o.owner][m.baseTkn], baseAmt);
                credit(o.owner, m.baseTkn, baseAmt);
            } else {
                credit(o.owner, m.quoteTkn, quoteAmt);
            }
            remove(orders, id, o);
            return 0;
        }

        o.baseAmt = baseAmt;
        return 0;
    }

    // puts a new order into the order book
    function make(
        Market storage m, bool buying, uint baseAmt, uint price, uint pos
    ) private returns (uint) {
        // dust controll
        uint quoteAmt = wmul(baseAmt, price);
        if(quoteAmt < m.dust) {
            return 0;
        }

        mapping (uint => Order) storage orders = buying ? m.buys : m.sells;

        Order storage o = orders[pos];
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

        uint id = insertBefore(orders, o, baseAmt, price, msg.sender);
        debit(msg.sender, buying ? m.quoteTkn : m.baseTkn, buying ? quoteAmt : baseAmt);

        return id;
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

    // insert new order into the double-linked list
    function insertBefore(
        mapping (uint => Order) storage orders, Order storage o,
        uint baseAmt, uint price, address owner
    ) private returns (uint) {
        require(baseAmt > 0);
        require(price > 0);

        Order storage n = orders[++lastId];

        n.next = orders[o.prev].next;
        n.prev = o.prev;
        orders[o.prev].next = lastId;
        o.prev = lastId;

        n.owner = owner;
        n.baseAmt = baseAmt;
        n.price = price;

        return lastId;
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
