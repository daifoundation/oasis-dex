pragma solidity >= 0.6.0;

abstract contract OasisLike {
    function getOrder(uint, bool, uint) public virtual view returns (uint, uint, address, uint, uint);
}

contract OasisHelper {
    function getOffers(
        OasisLike oasis, uint mId, bool buying, uint id
    ) public view returns (
        uint[100] memory ids, uint[100] memory baseAmts,
        uint[100] memory prices, address[100] memory owners
    ) {
        (,,,, id) = oasis.getOrder(mId, buying, id);
        uint i = 0;
        while ( id != 0 && i < 100) {
            ids[i] = id;
            (baseAmts[i], prices[i], owners[i],, id) = oasis.getOrder(mId, buying, id);
            i++;
        }
    }
}