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
        address baseTkn, 
        uint256 baseDust, 
        address quoteTkn, 
        uint256 quoteDust, 
        uint256 quoteTick
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

    function buy(uint256 marketId, uint256 baseAmt, uint256 quoteAmt) public returns (uint256) {
        Market market = markets[marketId];

        uint256 price = quoteAmt / baseAmt;  // @todo safe math
        uint256 remainingBaseAmt = baseAmt; // baseTkn
        uint256 remainingQuoteAmt = quoteAmt;   // quoteTkn
        Node sentinel = market.sellOffers[SENTINEL_ID];
        Node currentNodeId = sentinel.next;
        Node current = market.sellOffers[currentNodeId];
        while(currentNodeId != SENTINEL_ID && 
            price <= offer[current.offerId].price && 
            remainingBaseAmt > 0 ) {

            Offer currentOffer = offer[current.offerId];
            if (remainingBaseAmt >= currentOffer.baseAmt) {
                require(market.baseTkn.transferFrom(msg.sender, currentOffer.owner, currentOffer.baseAmt));
                require(market.quoteTkn.transfer(msg.sender, currentOffer.quoteAmt));

                current.next.prev = current.prev;
                current.prev.next = current.next;
                delete offers[currrent.offerId];

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
            while(currentNodeId != SENTINEL_ID && price > offer[current.offerId].price) {
                currentNodeId = current.next;
                current = market.buyOffers[currentNodeId];
            }

            Offer newOffer = Offer(market, remainingBaseAmt, remainingQuoteAmt, price, msg.sender, uint64(now));
            Node newNode = Node(lastOfferId++, current.prev, current);
            offers[newNode.id] = newOffer;
            market.buyOffers[newNode.id] = newNode;

            require(market.baseTkn.transferFrom(msg.sender, address(this), remainingBaseAmt));

            current.prev.next = newNode.id;
            current.prev = newNode.id;
        }
    }

    function sell(uint256 marketId, uint256 baseAmt, uint256 quoteAmt) public returns (uint256) {
        Market market = markets[marketId];

        uint256 price = quoteAmt / baseAmt;  // @todo safe math
        uint256 remainingBaseAmt = baseAmt; // baseTkn
        uint256 remainingQuoteAmt = quoteAmt;   // quoteTkn
        Node sentinel = market.buyOffers[SENTINEL_ID];
        Node currentNodeId = sentinel.next;
        Node current = market.buyOffers[currentNodeId];
        while(currentNodeId != SENTINEL_ID && 
            price >= offer[current.offerId].price && 
            remainingBaseAmt > 0 ) {

            Offer currentOffer = offer[current.offerId];
            if (remainingBaseAmt >= currentOffer.baseAmt) {
                require(market.baseTkn.transferFrom(msg.sender, currentOffer.owner, currentOffer.baseAmt));
                require(market.quoteTkn.transfer(msg.sender, currentOffer.quoteAmt));

                current.next.prev = current.prev;
                current.prev.next = current.next;
                delete offers[currrent.offerId];

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
            while(currentNodeId != SENTINEL_ID && price < offer[current.offerId].price) {
                currentNodeId = current.next;
                current = market.sellOffers[currentNodeId];
            }

            Offer newOffer = Offer(market, remainingBaseAmt, remainingQuoteAmt, price, msg.sender, uint64(now));
            Node newNode = Node(lastOfferId++, current.prev, current);
            offers[newNode.id] = newOffer;
            market.sellOffers[newNode.id] = newNode;
            
            require(market.baseTkn.transferFrom(msg.sender, address(this), remainingBaseAmt));

            current.prev.next = newNode.id;
            current.prev = newNode.id;
        }
    }

    function cancel(uint256 marketId, uint256 offerId) {
        // @todo: only onwer of the offer
        // make sure that offer exist in buy or sell
        Market market = markets[marketId];
        delete offers[offerId];

        Node node;
        if (market.buyOffers[offerId].id != 0) {
            node = market.buyOffers[offerId];
            node.prev.next = node.next;
            node.next.prev = node.prev;

            delete market.buyOffers[offerId];
        }

        if (market.sellOffers[offerId].id != 0) {
            node = market.sellOffers[offerId];
            node.prev.next = node.next;
            node.next.prev = node.prev;

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
        Market  newMarket = Market(baseTkn, baseDust, quoteTkn, quoteDust, quoteTick);
        newMarket.sellOffers[SENTINEL_ID] = Node(0, SENTINEL_ID, SENTINEL_ID);
        newMarket.buyOffers[SENTINEL_ID] = Node(0, SENTINEL_ID, SENTINEL_ID);
        markets[newMarketId] = newMarket;
    }
}
