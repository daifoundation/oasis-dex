pragma solidity ^0.5.4;

contract OasisMarket {

	struct Market {
		ERC20 bidTkn;
		ERC20 quoteTkn;
		uint tick;
		List sellOffers;
		List buyOffers;
	}

	mapping (uint => Offer) public offers;

    struct Offer {
        uint     sellAmt;
        uint     buyAmt;
    	uint     price;
        address  owner;
        uint64   timestamp;
    }

    struct Node {
        uint id;
        uint prev;
        uint next;
    }

}
