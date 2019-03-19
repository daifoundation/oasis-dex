pragma solidity ^0.5.4;

import "erc20/erc20.sol";

contract OasisMarket {
    uint256 private SENTINEL_ID=0;

	struct Market {
		ERC20 baseTkn;
		uint256 baseDust;

		ERC20 quoteTkn;
		uint256 quoteDust;
		uint256 quoteTick;

		mapping (uint256 => Node) sellOffers;
		mapping (uint256 => Node) buyOffers;
	}


	mapping (uint256 => Market) public markets;
    function getMarketId(
        // address baseTkn, 
        // uint256 baseDust, 
        // address quoteTkn, 
        // uint256 quoteDust, 
        // uint256 quoteTick
    ) public pure returns (uint256) {
        // https://ethereum.stackexchange.com/questions/49951/compare-structs-and-arrays-with-keccak256-in-order-to-save-gas
        return 0;
    }

    uint256 lastOfferId = 1;
	mapping (uint256 => Offer) public offers;

    struct Offer {
        uint256     market;
        uint256     baseAmt;
        uint256     quoteAmt;
    	uint256     price;
        address     owner;
        uint64      timestamp; // @todo verify if it should be uint64
    }

    struct Node {
        uint256 offerId;
        uint256 prev;
        uint256 next;
    }

    function buy(
    	uint256 marketId, uint256 baseAmt, uint256 quoteAmt
	) public returns (uint256) {
        Market storage market = markets[marketId];

        uint256 price = quoteAmt / baseAmt;  // @todo safe math
        uint256 remainingBaseAmt = baseAmt; // baseTkn
        uint256 remainingQuoteAmt = quoteAmt;   // quoteTkn
        Node storage sentinel = market.sellOffers[SENTINEL_ID];
        uint256 currentNodeId = sentinel.next;
        Node storage current = market.sellOffers[currentNodeId];
        while(currentNodeId != SENTINEL_ID && 
            price <= offers[current.offerId].price && 
            remainingBaseAmt > 0 ) {

            Offer storage currentOffer = offers[current.offerId];
            if (remainingBaseAmt >= currentOffer.baseAmt) {
                require(market.baseTkn.transferFrom(msg.sender, currentOffer.owner, currentOffer.baseAmt));
                require(market.quoteTkn.transfer(msg.sender, currentOffer.quoteAmt));

                market.sellOffers[current.next].prev = current.prev;
                market.sellOffers[current.prev].next = current.next;
                delete offers[current.offerId];

                delete market.sellOffers[currentNodeId];

                remainingBaseAmt -= currentOffer.baseAmt;
                remainingQuoteAmt -= currentOffer.quoteAmt;
            } else {
                require(market.baseTkn.transferFrom(msg.sender, currentOffer.owner, remainingBaseAmt));
                require(market.quoteTkn.transfer(msg.sender, remainingQuoteAmt));

                currentOffer.baseAmt -= remainingBaseAmt;
                currentOffer.quoteAmt -= remainingQuoteAmt;

                remainingBaseAmt = 0;
                remainingQuoteAmt = 0;
                // @todo dust limits
            }

            currentNodeId = current.next;
            current = market.sellOffers[currentNodeId];
        }

        if (remainingBaseAmt > 0) {
            // @todo dust limit

            sentinel = market.buyOffers[SENTINEL_ID];
            currentNodeId = sentinel.next;
            current = market.buyOffers[currentNodeId];
            while(currentNodeId != SENTINEL_ID && price > offers[current.offerId].price) {
                currentNodeId = current.next;
                current = market.buyOffers[currentNodeId];
            }

            // @todo we could modify not existing offer directly 
            Offer memory newOffer = Offer(marketId, remainingBaseAmt, remainingQuoteAmt, price, msg.sender, uint64(now));
            Node memory newNode = Node(lastOfferId++, current.prev, currentNodeId);
            offers[newNode.offerId] = newOffer;
            market.buyOffers[newNode.offerId] = newNode;

            require(market.baseTkn.transferFrom(msg.sender, address(this), remainingBaseAmt));

            market.buyOffers[current.prev].next = newNode.offerId;
            current.prev = newNode.offerId;
        }
    }

    function sell(
    	uint256 marketId, uint256 baseAmt, uint256 quoteAmt
	) public returns (uint256) {
        Market storage market = markets[marketId];

        uint256 price = quoteAmt / baseAmt;  // @todo safe math
        uint256 remainingBaseAmt = baseAmt; // baseTkn
        uint256 remainingQuoteAmt = quoteAmt;   // quoteTkn
        Node storage sentinel = market.buyOffers[SENTINEL_ID];
        uint256 currentNodeId = sentinel.next;
        Node storage current = market.buyOffers[currentNodeId];
        while(currentNodeId != SENTINEL_ID && 
            price >= offers[current.offerId].price && 
            remainingBaseAmt > 0 ) {

            Offer storage currentOffer = offers[current.offerId];
            if (remainingBaseAmt >= currentOffer.baseAmt) {
                require(market.baseTkn.transferFrom(msg.sender, currentOffer.owner, currentOffer.baseAmt));
                require(market.quoteTkn.transfer(msg.sender, currentOffer.quoteAmt));

                market.buyOffers[current.next].prev = current.prev;
                market.buyOffers[current.prev].next = current.next;
                delete offers[current.offerId];

                delete market.buyOffers[currentNodeId];

                remainingBaseAmt -= currentOffer.baseAmt;
                remainingQuoteAmt -= currentOffer.quoteAmt;
            } else {
                require(market.baseTkn.transferFrom(msg.sender, currentOffer.owner, remainingBaseAmt));
                require(market.quoteTkn.transfer(msg.sender, remainingQuoteAmt));

                currentOffer.baseAmt -= remainingBaseAmt;
                currentOffer.quoteAmt -= remainingQuoteAmt;

                remainingBaseAmt = 0;
                remainingQuoteAmt = 0;
                // @todo dust limits
            }

            currentNodeId = current.next;
            current = market.buyOffers[currentNodeId];
        }

        if (remainingBaseAmt > 0) {
            // @todo dust limit

            sentinel = market.sellOffers[SENTINEL_ID];
            currentNodeId = sentinel.next;
            current = market.sellOffers[currentNodeId];
            while(currentNodeId != SENTINEL_ID && price < offers[current.offerId].price) {
                currentNodeId = current.next;
                current = market.sellOffers[currentNodeId];
            }

            Offer memory newOffer = Offer(marketId, remainingBaseAmt, remainingQuoteAmt, price, msg.sender, uint64(now));
            Node memory newNode = Node(lastOfferId++, current.prev, currentNodeId);
            offers[newNode.offerId] = newOffer;
            market.sellOffers[newNode.offerId] = newNode;
            
            require(market.baseTkn.transferFrom(msg.sender, address(this), remainingBaseAmt));

            market.sellOffers[current.prev].next = newNode.offerId;
            current.prev = newNode.offerId;
        }
    }

    function cancel(uint256 marketId, uint256 offerId) public {
        // @todo: only onwer of the offer
        // make sure that offer exist in buy or sell
        Market storage market = markets[marketId];
        delete offers[offerId];

       
        if (market.buyOffers[offerId].offerId != 0) {
            Node storage node = market.buyOffers[offerId];
            market.buyOffers[node.prev].next = node.next;
            market.buyOffers[node.next].prev = node.prev;

            delete market.buyOffers[offerId];
        }

        if (market.sellOffers[offerId].offerId != 0) {
            Node storage node2 = market.sellOffers[offerId];
            market.sellOffers[node2.prev].next = node2.next;
            market.sellOffers[node2.next].prev = node2.prev;

            delete market.sellOffers[offerId];
        }
    }

    function createMarket(address baseTkn, 
        uint256 baseDust, 
        address quoteTkn, 
        uint256 quoteDust, 
        uint256 quoteTick
    ) public returns (uint256) {
        uint256 newMarketId = getMarketId(baseTkn, baseDust, quoteTkn, quoteDust, quoteTick);

        // todo: figureout memory specifier
        Market memory newMarket = Market(ERC20(baseTkn), baseDust, ERC20(quoteTkn), quoteDust, quoteTick);
        markets[newMarketId] = newMarket;
        markets[newMarketId].sellOffers[SENTINEL_ID] = Node(0, SENTINEL_ID, SENTINEL_ID);
        markets[newMarketId].buyOffers[SENTINEL_ID] = Node(0, SENTINEL_ID, SENTINEL_ID);
    }
}
