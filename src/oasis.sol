pragma solidity ^0.5.4;

import "erc20/erc20.sol";
import "ds-test/test.sol";

contract Oasis is DSTest {
    uint256 private SENTINEL_ID = 0;
    uint256 private lastOfferId = 0;

    struct Offer {
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
        uint256 marketId, uint256 remainingBaseAmt, uint256 price, bool isBuying 
    ) private returns (uint256) {
        Market storage market = markets[marketId];
     
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
                
                if(current.baseAmt * price < market.quoteDust) {
                    if(isBuying) {
                        require(market.baseTkn.transfer(current.owner, current.baseAmt));
                    } else {
                        require(market.quoteTkn.transfer(current.owner, current.baseAmt * price));
                    }
                    remove(isBuying ? market.sellOffers : market.buyOffers, currentId, current);
                }

                remainingBaseAmt = 0;
                // @todo dust limits
            }

            (currentId, current) = next(isBuying ? market.sellOffers : market.buyOffers, current);
        }

        if (remainingBaseAmt > 0) {

            if(remainingBaseAmt * price < market.quoteDust) {
                return 0;
            }

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

    function cancel(uint256 marketId, uint256 offerId) public {
        Market storage market = markets[marketId];

        Offer storage offer = market.sellOffers[offerId]; 
        if(offer.baseAmt > 0) {
            require(market.baseTkn.transfer(offer.owner, offer.baseAmt));
            remove(market.sellOffers, offerId, offer);
            return;
        }

        offer = market.buyOffers[offerId];
        if(offer.baseAmt > 0) {
            require(market.quoteTkn.transfer(offer.owner, offer.baseAmt * offer.price));
            remove(market.buyOffers, offerId, offer);  
            return;
        }
    }    
}
