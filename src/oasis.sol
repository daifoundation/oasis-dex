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
		uint256     tick;

		mapping (uint256 => Order) sells;
		mapping (uint256 => Order) buys;
	}

	mapping (uint256 => Market) public markets;

    function getMarketId(
        address baseTkn,
        address quoteTkn,
        uint256 dust,
        uint256 tick
    ) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(baseTkn, quoteTkn, dust, tick)));
    }

    function createMarket(
        address baseTkn,
        address quoteTkn,
        uint256 dust,
        uint256 tick
    ) public returns (uint256 newMarketId) {
        newMarketId = getMarketId(baseTkn, quoteTkn, dust, tick);
        Market memory newMarket = Market(ERC20(baseTkn), ERC20(quoteTkn), dust, tick);
        markets[newMarketId] = newMarket;
    }

    function trade(
        uint256 marketId,
        uint256 remainingBaseAmt,
        uint256 price,
        bool isBuying,
        uint256 pos
    ) private returns (uint256) {

        Market storage market = markets[marketId];

        // dust controll
        require(remainingBaseAmt * price > market.dust);

        // tick controll
        require((remainingBaseAmt * price) % market.tick == 0);

        // try to match with orders on the counter side of the orderbook
        mapping (uint256 => Order) storage orders = isBuying ? market.sells : market.buys;

        (bool notFinal, Order storage current) = first(orders);
        while(
            notFinal &&
            (isBuying && price >= current.price || !isBuying && price <= current.price ) &&
            remainingBaseAmt > 0
        ) {
            if (remainingBaseAmt >= current.baseAmt) {
                // complete fill
                if(isBuying) {
                    require(market.quoteTkn.transferFrom(
                        msg.sender, current.owner, current.baseAmt * price
                    ));
                    require(market.baseTkn.transfer(msg.sender, current.baseAmt));
                } else {
                    require(market.baseTkn.transferFrom(
                        msg.sender, current.owner, current.baseAmt
                    ));
                    require(market.quoteTkn.transfer(msg.sender, current.baseAmt * price));
                }

                remainingBaseAmt -= current.baseAmt;
                remove(orders, current);
            } else {
                // partial fill
                if(isBuying) {
                    require(market.quoteTkn.transferFrom(
                        msg.sender, current.owner, remainingBaseAmt
                    ));
                    require(market.baseTkn.transfer(msg.sender, remainingBaseAmt * price));
                } else {
                    require(market.baseTkn.transferFrom(
                        msg.sender, current.owner, remainingBaseAmt
                    ));
                    require(market.quoteTkn.transfer(msg.sender, remainingBaseAmt * price));
                }

                current.baseAmt -= remainingBaseAmt;

                // dust controll
                if(current.baseAmt * price < market.dust) {
                    if(isBuying) {
                        require(market.baseTkn.transfer(current.owner, current.baseAmt));
                    } else {
                        require(market.quoteTkn.transfer(current.owner, current.baseAmt * price));
                    }
                    remove(orders, current);
                }
                remainingBaseAmt = 0;
            }

            (notFinal, current) = next(orders, current);
        }

        // 'our' side of the orderbook
        orders = isBuying ? market.buys : market.sells;

        if (remainingBaseAmt > 0) {
            // dust controll
            if(remainingBaseAmt * price < market.dust) {
                return 0;
            }

            // escrow
            require(
                (isBuying ? market.quoteTkn : market.baseTkn).transferFrom(
                    msg.sender,
                    address(this),
                    isBuying ? remainingBaseAmt * price : remainingBaseAmt
                )
            );

            // find place in the orderbook
            if(pos == SENTINEL_ID) {
                (notFinal, current) = first(orders);
            } else {
                // backtrack if necessary
                (notFinal, current )= (!isFirst(current), getOrder(orders, pos));
                while(notFinal &&
                    (isBuying && current.price < price ||
                    !isBuying && current.price > price)
                ) {
                    (notFinal, current) = prev(orders, current);
                }
                notFinal = !isLast(current);
            }

            while(notFinal &&
                (isBuying && current.price >= price ||
                !isBuying && current.price <= price)
            ) {
                (notFinal, current) = next(orders, current);
            }

            return insertBefore(
                orders,
                current,
                Order(
                    // isBuying ? remainingBaseAmt : remainingBaseAmt * price,
                    remainingBaseAmt,
                    price,
                    msg.sender,
                    0, 0
                )
            );
        }
    }

    function buy(
        uint256 marketId, uint256 baseAmt, uint256 price, uint256 pos
    ) public returns (uint256) {
        return trade(marketId, baseAmt, price, true, pos);
    }

    function buy(
        uint256 marketId, uint256 baseAmt, uint256 price
    ) public returns (uint256) {
        return trade(marketId, baseAmt, price, true, SENTINEL_ID);
    }

    function sell(
        uint256 marketId, uint256 baseAmt, uint256 price, uint256 pos
    ) public returns (uint256) {
        return trade(marketId, baseAmt, price, false, pos);
    }

    function sell(
        uint256 marketId, uint256 baseAmt, uint256 price
    ) public returns (uint256) {
        return trade(marketId, baseAmt, price, false, SENTINEL_ID);
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
        Order memory newOrder
    ) internal returns (uint) {
        newOrder.next = orders[order.prev].next;
        newOrder.prev = order.prev;
        orders[++lastOrderId] = newOrder;
        orders[order.prev].next = lastOrderId;
        order.prev = lastOrderId;
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
