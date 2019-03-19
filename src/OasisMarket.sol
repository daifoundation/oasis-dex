pragma solidity ^0.5.4;

contract OasisMarket {

	struct Market {
		ERC20 baseTkn;
		uint baseDust;

		ERC20 quoteTkn;
		uint quoteDust
		uint quoteTick;

		mapping (uint => Node) sellOffers;
		mapping (uint => Node) buyOffers;
	}

	mapping (... => Market) public markets;

	mapping (uint => Offer) public offers;

    struct Offer {
        uint     baseAmt;
        uint     quoteAmt;
    	uint     price;
        address  owner;
        uint64   timestamp;
    }

    struct Node {
        uint offerId;
        uint prev;
        uint next;
    }
}
