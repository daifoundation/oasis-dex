pragma solidity ^0.5.4;

// import "ds-test/test.sol";

contract GemLike {
    function transfer(address,uint) public returns (bool);
    function transferFrom(address,address,uint) public returns (bool);
}

contract Oasis { // is DSTest
    uint constant private SENTINEL = 0;
    uint private lastId = 0;
    bool locked = false;

    struct Order {
        uint     baseAmt;
        uint     price;
        address  owner;
        uint     prev;
        uint     next;
    }

    struct Market {
        GemLike  baseTkn;
        GemLike  quoteTkn;
        uint     dust;
        uint     tic;

        mapping (uint => Order) sells;
        mapping (uint => Order) buys;
    }

    mapping (uint => Market) public markets;
    mapping (address => mapping (address => uint)) public balances;

    modifier synchronized {
        require(!locked);
        locked = true;
        _;
        locked = false;
    }

    function getMarketId(
        address baseTkn,
        address quoteTkn,
        uint dust,
        uint tic
    ) public pure returns (uint) {
        return uint(keccak256(abi.encodePacked(baseTkn, quoteTkn, dust, tic)));
    }

    function createMarket(
        address baseTkn,
        address quoteTkn,
        uint dust,
        uint tic
    ) public returns (uint id) {
        id = getMarketId(baseTkn, quoteTkn, dust, tic);
        markets[id] = Market(GemLike(baseTkn), GemLike(quoteTkn), dust, tic);
    }

    function balanceOf(address guy, address gem) public view returns (uint) {
        return balances[guy][gem];
    }

    function buy(
        uint mId, uint baseAmt, uint price, uint pos
    ) public synchronized returns (uint) {
        Market storage m = markets[mId];
        (uint id, uint escrow) = trade(m, baseAmt, price, true, pos);
        require(m.quoteTkn.transferFrom(msg.sender, address(this), escrow));
        return id;
    }

    function sell(
        uint mId, uint baseAmt, uint price, uint pos
    ) public synchronized returns (uint) {
        Market storage m = markets[mId];
        (uint id, uint escrow) = trade(m, baseAmt, price, false, pos);
        require(m.baseTkn.transferFrom(msg.sender, address(this), escrow));
        return id;
    }

    function exit(address gem, uint wad) public synchronized {
        balances[msg.sender][gem] = sub(balances[msg.sender][gem], wad);
        require(balances[msg.sender][gem] >= 0, 'exit-manko');
        GemLike(gem).transfer(msg.sender, wad);
    }

    // TODO: not tested
    function cancel(uint mId, bool buying, uint id) public synchronized {

        require(id != SENTINEL, 'sentinele_forever');

        Market storage m = markets[mId];
        mapping (uint => Order) storage orders = buying ? m.buys : m.sells;

        Order storage o = orders[id];
        require(o.baseAmt > 0, 'no_order');
        require(msg.sender == o.owner, 'only_owner');

        if(buying) {
            balance(o.owner, m.baseTkn, o.baseAmt);
        } else {
            balance(o.owner, m.quoteTkn, wmul(o.baseAmt, o.price));
        }

        remove(orders, id, o);

        return;
    }

    function getOrder(
        uint mId,
        bool buying,
        uint orderId
    ) public view returns (
        uint baseAmt,
        uint price,
        address owner,
        uint prev,
        uint next
    ) {
        Market storage m = markets[mId];
        Order storage o = (buying ? m.buys : m.sells)[orderId];
        return (o.baseAmt, o.price, o.owner, o.prev, o.next);
    }

    // private methods

    // Trade implements limit offer. It matches (take) orders until there is nothing
    // else to match. The unmatched part stays on the order book (make)
    function trade(
        Market storage m,
        uint left,
        uint price,
        bool buying,
        uint pos
    ) private returns (uint, uint escrow) {
        // dust controll
        require(wmul(left, price) >= m.dust, 'dust');

        // tic controll
        require(price % m.tic == 0, 'tic');

        // limit order matching
        mapping (uint => Order) storage orders = buying ? m.sells : m.buys;
        uint id = orders[SENTINEL].next;
        Order storage o = orders[id];
        while(id != SENTINEL && (buying ? price >= o.price : price <= o.price)) {
            uint next = o.next;
            (left, escrow) = take(m, buying, orders, id, o, left, escrow);
            if(left == 0) {
              return (0, escrow);
            }
            o = orders[id = next];
        }
        return make(m, buying, left, price, pos, escrow);
    }

    function balance(address guy, GemLike gem, uint wad) private {
        balances[guy][address(gem)] = add(balances[guy][address(gem)], wad);
        require(balances[guy][address(gem)] >= 0, 'move-manko');
    }

    // fills an order
    function take(
        Market storage m,
        bool buying,
        mapping (uint => Order) storage orders,
        uint id,
        Order storage o,
        uint left,
        uint escrow
    ) private returns (uint, uint) {

        uint baseAmt = left >= o.baseAmt ? o.baseAmt : left;
        uint quoteAmt = wmul(baseAmt, o.price);

        if(buying) {
            escrow = add(escrow, quoteAmt);
            balance(msg.sender, m.baseTkn, baseAmt);
            balance(o.owner, m.quoteTkn, quoteAmt);
        } else {
            escrow = add(escrow, baseAmt);
            balance(msg.sender, m.quoteTkn, quoteAmt);
            balance(o.owner, m.baseTkn, baseAmt);
        }

        if(left >= o.baseAmt) {
            remove(orders, id, o);
            return (left - baseAmt, escrow);
        }

        baseAmt = o.baseAmt - baseAmt;
        quoteAmt = wmul(baseAmt, o.price);
        if(quoteAmt < m.dust) {
            // give back
            if(buying) {
                balance(o.owner, m.baseTkn, baseAmt);
            } else {
                balance(o.owner, m.quoteTkn, quoteAmt);
            }
            remove(orders, id, o);
            return (0, escrow);
        }

        o.baseAmt = baseAmt;
        return (0, escrow);
    }

    // puts a new order into the order book
    function make(
        Market storage m,
        bool buying,
        uint baseAmt,
        uint price,
        uint pos,
        uint escrow
    ) private returns (uint, uint) {
        // dust controll
        uint quoteAmt = wmul(baseAmt, price);
        if(quoteAmt < m.dust) {
            return (0, escrow);
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

        // escrow
        return (id, add(escrow, buying ? quoteAmt : baseAmt));
    }

    // remove an order from double-linked list
    function remove(
        mapping (uint => Order) storage orders,
        uint id,
        Order storage order
    ) private {
        require(id != SENTINEL);
        orders[order.next].prev = order.prev;
        orders[order.prev].next = order.next;
        delete orders[id];
    }

    // insert new order into the double-linked list
    function insertBefore(
        mapping (uint => Order) storage orders,
        Order storage order,
        uint baseAmt,
        uint price,
        address owner
    ) private returns (uint) {
        require(baseAmt > 0);
        require(price > 0);
        Order storage newOrder = orders[++lastId];
        newOrder.next = orders[order.prev].next;
        newOrder.prev = order.prev;
        orders[order.prev].next = lastId;
        order.prev = lastId;
        newOrder.owner = owner;
        newOrder.baseAmt = baseAmt;
        newOrder.price = price;
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
        require((z = x - y) <= x, 'sub-overflow');
    }
}
