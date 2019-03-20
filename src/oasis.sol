pragma solidity ^0.5.4;

import "erc20/erc20.sol";
import "ds-test/test.sol";

contract Oasis is DSTest {
    uint256 private SENTINEL_ID = 0;
    uint256 private lastOfferId = 0;

    struct Offer {
        uint256     market; // what for?
        uint256     baseAmt;
        uint256     price;
        address     owner;
        // uint64      timestamp; // @todo verify if it should be uint64
        uint256     prev;
        uint256     next;
    }

	struct Market {
		ERC20       baseTkn;
		ERC20       quoteTkn;
		uint256     quoteDust;
		uint256     quoteTick;

		mapping (uint256 => Offer) sellOffers;
		mapping (uint256 => Offer) buyOffers;
	}

	mapping (uint256 => Market) public markets;

    function getMarketId(
        address baseTkn, 
        address quoteTkn, 
        uint256 quoteDust, 
        uint256 quoteTick
    ) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(baseTkn, quoteTkn, quoteDust, quoteTick)));
    }

    function createMarket(
    	address baseTkn, 
        address quoteTkn, 
        uint256 quoteDust, 
        uint256 quoteTick
    ) public returns (uint256 newMarketId) {
        newMarketId = getMarketId(baseTkn, quoteTkn, quoteDust, quoteTick);

        // todo: figureout memory specifier
        Market memory newMarket = Market(ERC20(baseTkn), ERC20(quoteTkn), quoteDust, quoteTick);
        markets[newMarketId] = newMarket;
        // is it necessary?
        // markets[newMarketId].sellOffers[SENTINEL_ID] = Node(SENTINEL_ID, SENTINEL_ID);
        // markets[newMarketId].buyOffers[SENTINEL_ID] = Node(SENTINEL_ID, SENTINEL_ID);
    }

    function first(
        mapping (uint256 => Offer) storage offers
    ) internal returns (uint, Offer storage) {
        emit log_named_uint("first: ", offers[SENTINEL_ID].next);
        return (offers[SENTINEL_ID].next, offers[offers[SENTINEL_ID].next]);
    }

    function remove(
        mapping (uint256 => Offer) storage offers,
        uint currentId,
        Offer storage offer
    ) internal {
        offers[offer.next].prev = offer.prev;
        offers[offer.prev].next = offer.next;
        delete offers[currentId];
    }

    function next(
        mapping (uint256 => Offer) storage offers,
        Offer storage offer
    ) internal view returns (uint, Offer storage) {
        return (offer.next, offers[offer.next]);
    }

    function insertBefore( 
        mapping (uint256 => Offer) storage offers,
        uint offerId,
        Offer storage offer,
        Offer memory newOffer
    ) internal returns (uint) {
        newOffer.next = offerId;
        newOffer.prev = offer.prev;
        offers[++lastOfferId] = newOffer;
        offers[offer.prev].next = lastOfferId;
        offer.prev = lastOfferId;
        return lastOfferId;
    }

    function trade(
        uint256 marketId, uint256 baseAmt, uint256 price, bool isBuying 
    ) private returns (uint256) {
        Market storage market = markets[marketId];

        uint256 remainingBaseAmt = baseAmt; // baseTkn
     
        (uint256 currentId, Offer storage current) = first(isBuying ? market.sellOffers : market.buyOffers);

        while(
            currentId != SENTINEL_ID && 
            (isBuying && price <= current.price || !isBuying && price <= current.price ) && 
            remainingBaseAmt > 0
        ) {
            if (remainingBaseAmt >= current.baseAmt) {
                if(isBuying) {
                    require(market.quoteTkn.transferFrom(msg.sender, current.owner, current.baseAmt * price));
                    require(market.baseTkn.transfer(msg.sender, current.baseAmt));
                } else {
                    require(market.baseTkn.transferFrom(msg.sender, current.owner, current.baseAmt));
                    require(market.quoteTkn.transfer(msg.sender, current.baseAmt * price));                                    
                }

                remainingBaseAmt -= current.baseAmt;
                remove(isBuying ? market.sellOffers : market.buyOffers, currentId, current);
            } else {
                if(isBuying) {
                    require(market.quoteTkn.transferFrom(msg.sender, current.owner, remainingBaseAmt));
                    require(market.baseTkn.transfer(msg.sender, remainingBaseAmt * price));
                } else {
                    require(market.baseTkn.transferFrom(msg.sender, current.owner, remainingBaseAmt));
                    require(market.quoteTkn.transfer(msg.sender, remainingBaseAmt * price));                    
                }
                current.baseAmt -= remainingBaseAmt;
                remainingBaseAmt = 0;
                // @todo dust limits
            }

            (currentId, current) = next(isBuying ? market.sellOffers : market.buyOffers, current);
        }

        if (remainingBaseAmt > 0) {
            if(isBuying) {
                require(market.quoteTkn.transferFrom(msg.sender, address(this), remainingBaseAmt * price));
            } else {
                require(market.baseTkn.transferFrom(msg.sender, address(this), remainingBaseAmt));
            }
    
            (currentId, current) = first(isBuying ? market.buyOffers : market.sellOffers);                
            while(currentId != SENTINEL_ID && price > current.price) {
                (currentId, current) = next(isBuying ? market.buyOffers : market.sellOffers, current);
            }

            // @todo dust limit
            // @todo we could modify not existing offer directly 
            return insertBefore(
                isBuying ? market.buyOffers : market.sellOffers, 
                currentId, 
                current, 
                Offer(
                    marketId, 
                    remainingBaseAmt, 
                    price, 
                    msg.sender, 
                    // uint64(now),
                    0, 0
                )
            );
        }
    }

    function buy(
        uint256 marketId, uint256 baseAmt, uint256 quoteAmt
    ) public returns (uint256) {
        return trade(marketId, baseAmt, quoteAmt, true);
    }

    function sell(
        uint256 marketId, uint256 baseAmt, uint256 quoteAmt
    ) public returns (uint256) {    
        return trade(marketId, baseAmt, quoteAmt, false);
    }

 //    function buy(
 //    	uint256 marketId, uint256 baseAmt, uint256 quoteAmt
	// ) public returns (uint256) {
 //        Market storage market = markets[marketId];

 //        uint256 remainingBaseAmt = baseAmt; // baseTkn
 //        uint256 remainingQuoteAmt = quoteAmt;   // quoteTkn
     
 //        (uint256 currentId, Offer storage current) = first(market.sellOffers);

 //        uint price = quoteAmt / baseAmt;

 //        while(
 //            currentId != SENTINEL_ID && 
 //            price <= current.price && 
 //            remainingBaseAmt > 0
 //        ) {
 //            if (remainingBaseAmt >= current.baseAmt) {
 //                require(market.quoteTkn.transferFrom(msg.sender, current.owner, current.quoteAmt));
 //                require(market.baseTkn.transfer(msg.sender, current.baseAmt));

 //                remainingBaseAmt -= current.baseAmt;
 //                remainingQuoteAmt -= current.quoteAmt;

 //                remove(market.sellOffers, currentId, current);
 //            } else {
 //                require(market.quoteTkn.transferFrom(msg.sender, current.owner, remainingBaseAmt));
 //                require(market.baseTkn.transfer(msg.sender, remainingQuoteAmt));

 //                current.baseAmt -= remainingBaseAmt;
 //                current.quoteAmt -= remainingQuoteAmt;

 //                remainingBaseAmt = 0;
 //                remainingQuoteAmt = 0;
 //                // @todo dust limits
 //            }

 //            (currentId, current) = next(market.sellOffers, current);
 //        }

 //        if (remainingBaseAmt > 0) {

 //            require(market.quoteTkn.transferFrom(msg.sender, address(this), remainingQuoteAmt));

 //            (currentId, current) = first(market.buyOffers);                
 //            while(currentId != SENTINEL_ID && price > current.price) {
 //                (currentId, current) = next(market.buyOffers, current);
 //            }

 //            // @todo dust limit
 //            // @todo we could modify not existing offer directly 
 //            return insertBefore(
 //                market.buyOffers, 
 //                currentId, 
 //                current, 
 //                Offer(
 //                    marketId, 
 //                    remainingBaseAmt, 
 //                    remainingQuoteAmt, 
 //                    price, 
 //                    msg.sender, 
 //                    // uint64(now),
 //                    0, 0
 //                )
 //            );
 //        }
 //    }

 //    function sell(
 //        uint256 marketId, uint256 baseAmt, uint256 quoteAmt
 //    ) public returns (uint256) {
 //        Market storage market = markets[marketId];

 //        uint256 remainingBaseAmt = baseAmt; // baseTkn
 //        uint256 remainingQuoteAmt = quoteAmt;   // quoteTkn
     
 //        (uint256 currentId, Offer storage current) = first(market.buyOffers);

 //        uint price = quoteAmt / baseAmt;

 //        while(
 //            currentId != SENTINEL_ID && 
 //            price >= current.price && 
 //            remainingBaseAmt > 0
 //        ) {
 //            if (remainingBaseAmt >= current.baseAmt) {
 //                require(market.baseTkn.transferFrom(msg.sender, current.owner, current.baseAmt));
 //                require(market.quoteTkn.transfer(msg.sender, current.quoteAmt));                

 //                remainingBaseAmt -= current.baseAmt;
 //                remainingQuoteAmt -= current.quoteAmt;

 //                remove(market.buyOffers, currentId, current);
 //            } else {
 //                require(market.baseTkn.transferFrom(msg.sender, current.owner, remainingBaseAmt));
 //                require(market.quoteTkn.transfer(msg.sender, remainingQuoteAmt));

 //                current.baseAmt -= remainingBaseAmt;
 //                current.quoteAmt -= remainingQuoteAmt;

 //                remainingBaseAmt = 0;
 //                remainingQuoteAmt = 0;
 //                // @todo dust limits
 //            }

 //            (currentId, current) = next(market.buyOffers, current);
 //        }

 //        if (remainingBaseAmt > 0) {

 //            require(market.baseTkn.transferFrom(msg.sender, address(this), remainingBaseAmt));

 //            (currentId, current) = first(market.sellOffers);                
 //            while(currentId != SENTINEL_ID && price < current.price) {
 //                (currentId, current) = next(market.sellOffers, current);
 //            }

 //            // @todo dust limit
 //            // @todo we could modify not existing offer directly 

 //            emit log_named_uint("priceprice: ", price);

 //            insertBefore(
 //                market.sellOffers, 
 //                currentId, 
 //                current, 
 //                Offer(
 //                    marketId, 
 //                    remainingBaseAmt, 
 //                    remainingQuoteAmt, 
 //                    price, 
 //                    msg.sender, 
 //                    // uint64(now),
 //                    0, 0
 //                )
 //            );
 //        }
 //    }
}
