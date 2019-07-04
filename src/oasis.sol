pragma solidity ^0.5.4;

import "ds-test/test.sol";

contract GemLike {
    function transfer(address,uint) public returns (bool);
    function transferFrom(address,address,uint) public returns (bool);
}

contract Oasis is DSTest {
    uint256 constant private SENTINEL = 0;
    uint256 private lastId = 0;
    bool locked = false;

    struct Order {
        uint256     baseAmt;
        uint256     price;
        address     owner;
        uint256     prev;
        uint256     next;
    }

    struct Market {
        GemLike     baseTkn;
        GemLike     quoteTkn;
        uint256     dust;
        uint256     tic;

        mapping (uint256 => Order) sells;
        mapping (uint256 => Order) buys;
    }

    mapping (uint256 => Market) public markets;
    mapping (address => mapping (address => uint256)) public balances;

    modifier synchronized {
        require(!locked);
        locked = true;
        _;
        locked = false;
    }

    function getMarketId(
        address baseTkn,
        address quoteTkn,
        uint256 dust,
        uint256 tic
    ) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(baseTkn, quoteTkn, dust, tic)));
    }

    function createMarket(
        address baseTkn,
        address quoteTkn,
        uint256 dust,
        uint256 tic
    ) public returns (uint256 id) {
        id = getMarketId(baseTkn, quoteTkn, dust, tic);
        markets[id] = Market(GemLike(baseTkn), GemLike(quoteTkn), dust, tic);
    }

    function buy(
        uint256 mId, uint256 baseAmt, uint256 price, uint256 pos
    ) public synchronized returns (uint256) {
        Market storage m = markets[mId];
        (uint id, uint escrow) = trade(m, baseAmt, price, true, pos);
        require(m.quoteTkn.transferFrom(msg.sender, address(this), escrow));
        return id;
    }

    function sell(
        uint256 mId, uint256 baseAmt, uint256 price, uint256 pos
    ) public synchronized returns (uint256) {
        Market storage m = markets[mId];
        (uint id, uint escrow) = trade(m, baseAmt, price, false, pos);
        require(m.baseTkn.transferFrom(msg.sender, address(this), escrow));
        return id;
    }

    function exit(address gem, uint256 wad) public synchronized {
        balances[msg.sender][gem] = sub(balances[msg.sender][gem], wad);
        require(balances[msg.sender][gem] >= 0, 'exit-manko');
        GemLike(gem).transfer(msg.sender, wad);
    }

    // TODO: not tested
    function cancel(uint256 mId, bool buying, uint256 id) public synchronized {

        require(id != SENTINEL, 'sentinele_forever');

        Market storage m = markets[mId];
        mapping (uint256 => Order) storage orders = buying ? m.buys : m.sells;

        Order storage o = orders[id];
        require(o.baseAmt > 0, 'no_order');
        require(msg.sender == o.owner, 'only_owner');

        if(buying) {
            move(o.owner, m.baseTkn, o.baseAmt);
        } else {
            move(o.owner, m.quoteTkn, wmul(o.baseAmt, o.price));
        }

        remove(orders, id, o);

        return;
    }

    function getOrder(
        uint256 mId,
        bool buying,
        uint256 orderId
    ) public view returns (
        uint256 baseAmt,
        uint256 price,
        address owner,
        uint256 prev,
        uint256 next
    ) {
        Market storage m = markets[mId];
        Order storage o =  (buying ? m.buys : m.sells)[orderId];
        return (o.baseAmt, o.price, o.owner, o.prev, o.next);
    }

    // private methods

    // Trade implements limit offer. It matches (make) orders until there is nothing
    // else to match. The unmatched part stays on the order book (take)
    function trade(
        Market storage m,
        uint256 left,
        uint256 price,
        bool buying,
        uint256 pos
    ) private returns (uint256, uint256) {
        // dust controll
        require(wmul(left, price) >= m.dust, 'dust');

        // tic controll
        require(price % m.tic == 0, 'tic');

        // limit order matching
        uint256 escrow = 0;
        bool r = false;
        mapping (uint256 => Order) storage orders = buying ? m.sells : m.buys;
        uint256 id = orders[SENTINEL].next;
        Order storage o = orders[id];
        while(id != SENTINEL && (buying ? price >= o.price : price <= o.price)) {
            uint256 next = o.next;
            (left, escrow, r) = take(m, buying, o, left, escrow);

            if(r) {
                remove(orders, id, o);
            }

            if(left == 0) {
                break;
            }
            o = orders[id = next];
        }

        if(left == 0) {
            return (0, escrow);
        } else {
            return make(m, buying, left, price, pos, escrow);
        }
    }

    function move(address guy, GemLike gem, uint256 wad) private {
        balances[guy][address(gem)] = sub(balances[guy][address(gem)], wad);
        require(balances[guy][address(gem)] >= 0, 'move-manko');
        balances[guy][address(gem)] = add(balances[guy][address(gem)], wad);
    }

    // fills an order
    function take(
        Market storage m,
        bool buying,
        Order storage o,
        uint256 left,
        uint256 escrow
    ) private returns (uint256, uint256, bool) {
        if (left >= o.baseAmt) {
            // complete take
            uint256 quoteAmt = wmul(o.baseAmt, o.price);

            if(buying) {
              escrow = add(escrow, quoteAmt); //quoteTkn
              move(o.owner, m.baseTkn, o.baseAmt);
            } else {
              escrow = add(escrow, o.baseAmt); //baseTkn
              move(o.owner, m.quoteTkn, quoteAmt);
            }

            left = left - o.baseAmt;
            return (left, escrow, true);
        } else {
            // partial take
            uint256 quoteAmt = wmul(left, o.price);

            if(buying) {
              escrow = add(escrow, quoteAmt); //quoteTkn
              move(o.owner, m.baseTkn, left);
            } else {
              escrow = add(escrow, left); //baseTkn
              move(o.owner, m.quoteTkn, quoteAmt);
            }

            // dust controll
            left = o.baseAmt - left;
            quoteAmt = wmul(left, o.price);
            if(quoteAmt < m.dust) {
                // give back
                if(buying) {
                    move(o.owner, m.baseTkn, left);
                } else {
                    move(o.owner, m.quoteTkn, quoteAmt);
                }
                return (0, escrow, true);
            }

            o.baseAmt = left;
            return (0, escrow, false);
        }
    }

    // puts a new order into the order book
    function make(
        Market storage m,
        bool buying,
        uint256 baseAmt,
        uint256 price,
        uint pos,
        uint256 escrow
    ) private returns (uint, uint) {
        // dust controll
        uint256 quoteAmt = wmul(baseAmt, price);
        if(quoteAmt < m.dust) {
            return (0, escrow);
        }

        mapping (uint256 => Order) storage orders = buying ? m.buys : m.sells;

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

        uint256 id = insertBefore(orders, o, baseAmt, price, msg.sender);

        // escrow
        return (id, add(escrow, buying ? quoteAmt : baseAmt));
    }

    // remove an order from double-linked list
    function remove(
        mapping (uint256 => Order) storage orders,
        uint256 id,
        Order storage order
    ) private {
        require(id != SENTINEL);
        orders[order.next].prev = order.prev;
        orders[order.prev].next = order.next;
        delete orders[id];
    }

    // insert new order into the double-linked list
    function insertBefore(
        mapping (uint256 => Order) storage orders,
        Order storage order,
        uint256 baseAmt,
        uint256 price,
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

    function wmul(uint256 x, uint256 y) private pure returns (uint z) {
        require(y == 0 || ((z = (x * y) / WAD ) * WAD) / y == x, 'wmul-overflow');
    }
    function add(uint256 x, uint256 y) internal pure returns (uint256 z) {
        require((z = x + y) >= x, 'add-overflow');
    }
    function sub(uint256 x, uint256 y) internal pure returns (uint256 z) {
        require((z = x - y) <= x, 'sub-overflow');
    }
}
