pragma solidity ^0.5.4;

import "erc20/erc20.sol";
import "ds-test/test.sol";

contract Oasis is DSTest {
    uint256 private SENTINEL_ID = 0;
    uint256 private lastOrderId = 0;

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
    ) public returns (uint256 newMarketId) {
        newMarketId = getMarketId(baseTkn, quoteTkn, dust, tic);
        Market memory newMarket = Market(ERC20(baseTkn), ERC20(quoteTkn), dust, tic);
        markets[newMarketId] = newMarket;
    }

    function trade(
        uint256 marketId,
        uint256 leftBaseAmt,
        uint256 price,
        bool buying,
        uint256 pos
    ) private returns (uint256) {

        Market storage market = markets[marketId];

        // dust controll
        require(leftBaseAmt * price >= market.dust);

        // tic controll
        require(price % market.tic == 0);

        // match with orders on the opposite side of the orderbook
        mapping (uint256 => Order) storage orders = buying ? market.sells : market.buys;

        (bool notFinal, Order storage current) = first(orders);
        while(notFinal && (buying ? price >= current.price : price <= current.price)) {
            if (leftBaseAmt > current.baseAmt) {
                // complete take
                swap(market, buying, msg.sender, current.owner, current.baseAmt, current.price);
                leftBaseAmt -= current.baseAmt;
                remove(orders, current);
                (notFinal, current) = next(orders, current);
            } else {
                // partial take
                swap(market, buying, msg.sender, current.owner, leftBaseAmt, current.price);

                if(current.baseAmt == leftBaseAmt) {
                    remove(orders, current);
                    return 0;
                }

                current.baseAmt -= leftBaseAmt;

                // dust controll
                if(current.baseAmt * current.price < market.dust) {
                    giveUp(market, buying, current.owner, current.baseAmt, current.price);
                    remove(orders, current);
                }
                return 0;
            }
        }

        // 'our' side of the orderbook
        orders = buying ? market.buys : market.sells;

        // dust controll
        if(leftBaseAmt * price < market.dust) {
            return 0;
        }

        // make
        escrow(market, buying, leftBaseAmt, price);
        Order storage worse = findWorse(orders, buying, price, pos);
        return insertBefore(orders, worse, leftBaseAmt, price, msg.sender);
    }

    function findWorse(
        mapping (uint256 => Order) storage orders, bool buying, uint256 price, uint pos
    ) private view returns (Order storage current) {
        bool notFinal;
        if(exists(orders, pos)) {
            // backtrack if necessary
            current = getOrder(orders, pos);
            notFinal = !isFirst(current);
            while(notFinal && (buying ? current.price < price : current.price > price)) {
                (notFinal, current) = prev(orders, current);
            }
            notFinal = !isLast(current);
        } else {
            (notFinal, current) = first(orders);
        }

        while(notFinal && (buying ? current.price >= price : current.price <= price)) {
            (notFinal, current) = next(orders, current);
        }
    }

    function buy(
        uint256 marketId, uint256 baseAmt, uint256 price, uint256 pos
    ) public returns (uint256) {
        return trade(marketId, baseAmt, price, true, pos);
    }

    function sell(
        uint256 marketId, uint256 baseAmt, uint256 price, uint256 pos
    ) public returns (uint256) {
        return trade(marketId, baseAmt, price, false, pos);
    }

    function cancel(uint256 marketId, uint256 orderId) public {
        Market storage market = markets[marketId];
        Order storage order = market.sells[orderId];

        if(order.baseAmt > 0) {
            require(msg.sender == order.owner);
            require(market.baseTkn.transfer(order.owner, order.baseAmt));
            remove(market.sells, order);
            return;
        }

        order = market.buys[orderId];
        if(order.baseAmt > 0) {
            require(msg.sender == order.owner);
            require(market.quoteTkn.transfer(order.owner, order.baseAmt * order.price));
            remove(market.buys, order);
            return;
        }

        require(false);
    }

    // transfer helpers
    function swap(
        Market storage market,
        bool buying,
        address guy1, 
        address guy2,
        uint256 baseAmt, 
        uint256 price
    ) internal {
        if(buying) {
            require(market.quoteTkn.transferFrom(guy1, guy2, baseAmt * price));
            require(market.baseTkn.transfer(guy1, baseAmt));
        } else {
            require(market.baseTkn.transferFrom(guy1, guy2, baseAmt));
            require(market.quoteTkn.transfer(guy1, baseAmt * price));
        }
    }

    function giveUp(
        Market storage market,
        bool buying,
        address guy,
        uint256 baseAmt,
        uint256 price
    ) internal {
        if(buying) {
            require(market.baseTkn.transfer(guy, baseAmt));
        } else {
            require(market.quoteTkn.transfer(guy, baseAmt * price));
        }
    }

    function escrow(
        Market storage market,
        bool buying,
        uint256 baseAmt,
        uint256 price
    ) internal {
        if(buying) {
            require(market.quoteTkn.transferFrom(msg.sender, address(this), baseAmt * price));
        } else {
            require(market.baseTkn.transferFrom(msg.sender, address(this), baseAmt));
        }
    }

    // list helpers
    function first(
        mapping (uint256 => Order) storage orders
    ) internal view returns (bool, Order storage) {
        uint id = orders[SENTINEL_ID].next;
        return (id != SENTINEL_ID, orders[id]);
    }

    function remove(
        mapping (uint256 => Order) storage orders,
        Order storage order
    ) internal {
        uint currentId = orders[order.prev].next;
        require(currentId != SENTINEL_ID);
        orders[order.next].prev = order.prev;
        orders[order.prev].next = order.next;
        delete orders[currentId];
    }

    function next(
        mapping (uint256 => Order) storage orders,
        Order storage order
    ) internal view returns (bool, Order storage) {
        uint id = order.next;
        return (id != SENTINEL_ID, orders[id]);
    }

    function prev(
        mapping (uint256 => Order) storage orders,
        Order storage order
    ) internal view returns (bool, Order storage) {
        uint id = order.prev;
        return (id != SENTINEL_ID, orders[id]);
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
        Order storage newOrder = orders[++lastOrderId];
        newOrder.next = orders[order.prev].next;
        newOrder.prev = order.prev;
        orders[order.prev].next = lastOrderId;
        order.prev = lastOrderId;
        newOrder.owner = owner;
        newOrder.baseAmt = baseAmt;
        newOrder.price = price;
        return lastOrderId;
    }

    function isFirst(
        Order storage order
    ) internal view returns (bool) {
        return order.prev == SENTINEL_ID;
    }

    function isLast(
        Order storage order
    ) internal view returns (bool) {
        return order.next == SENTINEL_ID;
    }

    function getOrder(
        mapping (uint256 => Order) storage orders,
        uint256 id
    ) internal view returns (Order storage) {
        Order storage order = orders[id];
        require((order).baseAmt != 0);
        return order;
    }

    function exists(
        mapping (uint256 => Order) storage orders,
        uint256 id
    ) internal view returns (bool) {
        return orders[id].baseAmt != 0;
    }

    // test helpers
    function isSorted(uint256 marketId) public view returns (bool) {

        Market storage market = markets[marketId];

        // sells ascending?
        (bool notFinal, Order storage order) = first(market.sells);
        while(notFinal) {
            uint price = order.price;
            (notFinal, order) = next(market.sells, order);
            if(notFinal && order.price < price) {
                return false;
            }
        }

        // buys descending?
        (notFinal, order) = first(market.buys);
        while(notFinal) {
            uint price = order.price;
            (notFinal, order) = next(market.buys, order);
            if(notFinal && order.price > price) {
                return false;
            }
        }
        return true;
    }

    function depth(uint256 marketId, bool isBuy) private view returns (uint256 length) {

        Market storage market = markets[marketId];

        mapping (uint256 => Order) storage orders = isBuy ? market.buys : market.sells;

        length = 0;
        (bool notFinal, Order storage order) = first(orders);
        while(notFinal) {
            length++;
            (notFinal, order) = next(orders, order);
        }
    }

    function sellDepth(uint256 marketId) public view returns (uint256) {
        return depth(marketId, false);
    }


    function buyDepth(uint256 marketId) public view returns (uint256) {
        return depth(marketId, true);
    }
}
