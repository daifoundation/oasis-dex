pragma solidity ^0.5.4;

contract OasisMarket {

	struct Market {
		address baseTkn;
		uint256 baseDust;

		address quoteTkn;
		uint256 quoteDust;
		uint256 quoteTick;

		mapping (uint256 => Node) sellOffers;
		mapping (uint256 => Node) buyOffers;
	}


	mapping (uint256 => Market) public markets;
    function getMarketKey(
        address baseTkn, 
        uint256 baseDust, 
        address quoteTkn, 
        uint256 quoteDust, 
        uint256 quoteTick
    ) public pure returns uint256;

	mapping (uint256 => Offer) public offers;

    struct Offer {
        uint256     market;
        uint256     baseAmt;
        uint256     quoteAmt;
    	uint256     price;
        address     owner;
        uint64      timestamp;
    }

    struct Node {
        uint256 offerId;
        uint256 prev;
        uint256 next;
    }

    function buy(uint256 market, uint256 baseAmt, uint256 quoteAmt) public uint256 {
        
    }

    function sell(uint256 market, uint256 baseAmt, uint256 quoteAmt) public uint256 {}

    function cancel(uint256 offerId) {}

    function createMarket(address baseTkn, 
        uint256 baseDust, 
        address quoteTkn, 
        uint256 quoteDust, 
        uint256 quoteTick
    ) public returns uint256 {
        uint256 newMarketKey = getMarketKey(baseTkn, baseDust, quoteTkn, quoteDust, quoteTick);

        markets[newMarketKey] = Market(baseTkn, baseDust, quoteTkn, quoteDust, quoteTick);
    }
}
