contract OasisLike {
    function getOrder(uint, bool, uint) public view returns (uint, uint, address, uint, uint);
}

contract OasisHelper {
    function getOffers(
        OasisLike oasis, uint mId, bool buying, uint id
    ) public view returns (
        uint[100] memory ids, uint[100] memory baseAmts,
        uint[100] memory prices, address[100] memory owners
    ) {
        uint i = 0;
        do {
            ids[i] = id;
            (baseAmts[i], prices[i], owners[i],, id) = oasis.getOrder(mId, buying, id);
            if(id == 0) break;
            ids[i] = id;
        } while (++i < 100);
    }
}