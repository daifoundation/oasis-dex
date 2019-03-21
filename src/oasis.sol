pragma solidity ^0.5.4;

import "erc20/erc20.sol";
import "ds-test/test.sol";

// to run test on source change:
// while inotifywait -e close_write src/*; do dapp test; done
//
// todo:
// - more test scenarios
// - safe math
// - position
// - tick semantics

contract Oasis is DSTest {
    uint256 private SENTINEL_ID = 0;
    uint256 private lastOrderId = 0;

    struct Order {
        // uint256     market; // what for?
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

    function first(
        mapping (uint256 => Order) storage orders
    ) internal view returns (uint, Order storage) {
        return (orders[SENTINEL_ID].next, orders[orders[SENTINEL_ID].next]);
    }

    function remove(
        mapping (uint256 => Order) storage orders,
        uint currentId,
        Order storage order
    ) internal {
        orders[order.next].prev = order.prev;
        orders[order.prev].next = order.next;
        delete orders[currentId];
    }

    function next(
        mapping (uint256 => Order) storage orders,
        Order storage order
    ) internal view returns (uint, Order storage) {
        return (order.next, orders[order.next]);
    }

    function insertBefore(
        mapping (uint256 => Order) storage orders,
        uint orderId,
        Order storage order,
        Order memory newOrder
    ) internal returns (uint) {
        newOrder.next = orderId;
        newOrder.prev = order.prev;
        orders[++lastOrderId] = newOrder;
        orders[order.prev].next = lastOrderId;
        order.prev = lastOrderId;
        return lastOrderId;
    }

    function trade(
        uint256 marketId, uint256 remainingBaseAmt, uint256 price, bool isBuying
    ) private returns (uint256) {

        Market storage market = markets[marketId];

        // dust controll
        require(remainingBaseAmt * price > market.dust);

        (uint256 currentId, Order storage current) = first(isBuying ? market.sells : market.buys);

        while(
            currentId != SENTINEL_ID &&
            (isBuying && price <= current.price || !isBuying && price <= current.price ) &&
            remainingBaseAmt > 0
        ) {
            if (remainingBaseAmt >= current.baseAmt) {
                // complete fill
                if(isBuying) {
                    require(market.quoteTkn.transferFrom(msg.sender, current.owner, current.baseAmt * price));
                    require(market.baseTkn.transfer(msg.sender, current.baseAmt));
                } else {
                    require(market.baseTkn.transferFrom(msg.sender, current.owner, current.baseAmt));
                    require(market.quoteTkn.transfer(msg.sender, current.baseAmt * price));
                }

                remainingBaseAmt -= current.baseAmt;
                remove(isBuying ? market.sells : market.buys, currentId, current);
            } else {
                // partial fill
                if(isBuying) {
                    require(market.quoteTkn.transferFrom(msg.sender, current.owner, remainingBaseAmt));
                    require(market.baseTkn.transfer(msg.sender, remainingBaseAmt * price));
                } else {
                    require(market.baseTkn.transferFrom(msg.sender, current.owner, remainingBaseAmt));
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
                    remove(isBuying ? market.sells : market.buys, currentId, current);
                }

                remainingBaseAmt = 0;
            }

            (currentId, current) = next(isBuying ? market.sells : market.buys, current);
        }

        if (remainingBaseAmt > 0) {
            // dust controll
            if(remainingBaseAmt * price < market.dust) {
                return 0;
            }

            // escrow
            if(isBuying) {
                require(market.quoteTkn.transferFrom(msg.sender, address(this), remainingBaseAmt * price));
            } else {
                require(market.baseTkn.transferFrom(msg.sender, address(this), remainingBaseAmt));
            }

            // new order in the orderbook
            (currentId, current) = first(isBuying ? market.buys : market.sells);
            while(
                currentId != SENTINEL_ID &&
                (isBuying && current.price >= price || !isBuying && current.price <= price)
            ) {
                (currentId, current) = next(isBuying ? market.buys : market.sells, current);
            }

            // tick controll
            uint tick = isBuying ? price - current.price : current.price - price;
            require(market.tick < tick);

            // @todo we could modify not existing order directly
            return insertBefore(
                isBuying ? market.buys : market.sells,
                currentId,
                current,
                Order(
                    // marketId,
                    remainingBaseAmt,
                    price,
                    msg.sender,
                    0, 0
                )
            );
        }
    }

    function buy(
        uint256 marketId, uint256 baseAmt, uint256 price
    ) public returns (uint256) {
        return trade(marketId, baseAmt, price, true);
    }

    function sell(
        uint256 marketId, uint256 baseAmt, uint256 price
    ) public returns (uint256) {
        return trade(marketId, baseAmt, price, false);
    }

    function cancel(uint256 marketId, uint256 orderId) public {
        Market storage market = markets[marketId];

        Order storage order = market.sells[orderId];
        if(order.baseAmt > 0) {
            require(market.baseTkn.transfer(order.owner, order.baseAmt));
            remove(market.sells, orderId, order);
            return;
        }

        order = market.buys[orderId];
        if(order.baseAmt > 0) {
            require(market.quoteTkn.transfer(order.owner, order.baseAmt * order.price));
            remove(market.buys, orderId, order);
            return;
        }
    }

    function isSorted(uint256 marketId) public view returns (bool) {

        Market storage market = markets[marketId];

        // sells ascending?
        (uint256 id, Order storage order) = first(market.sells);
        while(id != SENTINEL_ID) {
            uint price = order.price;
            (id, order) = next(market.sells, order);
            if(id != SENTINEL_ID && order.price < price) {
                return false;
            }
        }

        // buys descending?
        (id, order) = first(market.buys);
        while(id != SENTINEL_ID) {
            uint price = order.price;
            (id, order) = next(market.buys, order);
            if(id != SENTINEL_ID && order.price > price) {
                return false;
            }
        }

        return true;
    }
}
