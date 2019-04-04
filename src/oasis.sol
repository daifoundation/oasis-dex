pragma solidity ^0.5.4;

import "erc20/erc20.sol";
import "ds-test/test.sol";

contract Oasis is DSTest {
    uint256 constant private SENTINEL = 0;
    uint256 private lastId = 0;

    struct Order {
        uint256     baseAmt;
        uint256     price;
        address     owner;
        uint256     prev;
        uint256     next;
    }

    struct Market {
        ERC20       baseTkn;
        ERC20       quoteTkn;
        uint256     dust;
        uint256     tic;

        mapping (uint256 => Order) sells;
        mapping (uint256 => Order) buys;
    }

    mapping (uint256 => Market) public markets;

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
        markets[id] = Market(ERC20(baseTkn), ERC20(quoteTkn), dust, tic);
    }

    function buy(
        uint256 mId, uint256 baseAmt, uint256 price, uint256 pos
    ) public returns (uint256) {
        return trade(markets[mId], baseAmt, price, true, pos);
    }

    function sell(
        uint256 mId, uint256 baseAmt, uint256 price, uint256 pos
    ) public returns (uint256) {
        return trade(markets[mId], baseAmt, price, false, pos);
    }

    // TODO: not tested
    function cancel(uint256 mId, bool buying, uint256 id) public {

        require(id != SENTINEL, 'sentinele_forever');

        Market storage m = markets[mId];
        mapping (uint256 => Order) storage orders = buying ? m.buys : m.sells;

        Order storage o = orders[id];
        require(o.baseAmt > 0, 'no_order');
        require(msg.sender == o.owner, 'only_owner');

        if(buying) {
            require(m.baseTkn.transfer(o.owner, o.baseAmt));
        } else {
            require(m.quoteTkn.transfer(o.owner, wmul(o.baseAmt, o.price)));
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

    function trade(
        Market storage m,
        uint256 left,
        uint256 price,
        bool buying,
        uint256 pos
    ) private returns (uint256) {
        // dust controll
        require(wmul(left, price) >= m.dust, 'dust');

        // tic controll
        require(price % m.tic == 0, 'tic');

        // limit order matching
        mapping (uint256 => Order) storage orders = buying ? m.sells : m.buys;
        uint256 id = orders[SENTINEL].next;
        Order storage o = orders[id];
        while(id != SENTINEL && (buying ? price >= o.price : price <= o.price)) {
            uint256 next = o.next;
            left = take(m, buying, orders, id, o, left);
            if(left == 0) {
                return 0;
            }
            o = orders[id = next];
        }

        // make
        return make(m, buying, left, price, pos);
    }

    function take(
        Market storage m,
        bool buying,
        mapping (uint256 => Order) storage orders,
        uint256 id,
        Order storage o,
        uint256 left
    ) private returns (uint256) {
        if (left > o.baseAmt) {
            // complete take
            uint256 quoteAmt = wmul(o.baseAmt, o.price);
            swap(m, buying, msg.sender, o.owner, o.baseAmt, quoteAmt);
            left = left - o.baseAmt;
            remove(orders, id, o);
            return left;
        } else {
            // partial take
            uint256 quoteAmt = wmul(left, o.price);
            swap(m, buying, msg.sender, o.owner, left, quoteAmt);

            if(o.baseAmt == left) {
                remove(orders, id, o);
                return 0;
            }

            left = o.baseAmt - left;

            // dust controll
            quoteAmt = wmul(left, o.price);
            if(quoteAmt < m.dust) {
                // give back
                if(buying) {
                    require(m.baseTkn.transfer(o.owner, left));
                } else {
                    require(m.quoteTkn.transfer(o.owner, quoteAmt));
                }
                remove(orders, id, o);
            }

            o.baseAmt = left;

            return 0;
        }
    }

    function make(
        Market storage m,
        bool buying,
        uint256 baseAmt,
        uint256 price,
        uint pos
    ) private returns (uint id) {
        // dust controll
        uint256 quoteAmt = wmul(baseAmt, price);
        if(quoteAmt < m.dust) {
            return 0;
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

        id = insertBefore(orders, o, baseAmt, price, msg.sender);

        // escrow
        if(buying) {
            require(m.quoteTkn.transferFrom(msg.sender, address(this), quoteAmt));
        } else {
            require(m.baseTkn.transferFrom(msg.sender, address(this), baseAmt));
        }
    }

    function swap(
        Market storage m,
        bool buying,
        address guy1,
        address guy2,
        uint256 baseAmt,
        uint256 quoteAmt
    ) internal {
        if(buying) {
            require(m.quoteTkn.transferFrom(guy1, guy2, quoteAmt));
            require(m.baseTkn.transfer(guy1, baseAmt));
        } else {
            require(m.baseTkn.transferFrom(guy1, guy2, baseAmt));
            require(m.quoteTkn.transfer(guy1, quoteAmt));
        }
    }

    function remove(
        mapping (uint256 => Order) storage orders,
        uint256 id,
        Order storage order
    ) internal {
        require(id != SENTINEL);
        orders[order.next].prev = order.prev;
        orders[order.prev].next = order.next;
        delete orders[id];
    }

    function insertBefore(
        mapping (uint256 => Order) storage orders,
        Order storage order,
        uint256 baseAmt,
        uint256 price,
        address owner
    ) internal returns (uint) {
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

    // safe multiplication
    uint constant WAD = 10 ** 18;

    function wmul(uint x, uint y) internal pure returns (uint z) {
        require(y == 0 || ((z = (x * y) / WAD ) * WAD) / y == x);
    }
}
