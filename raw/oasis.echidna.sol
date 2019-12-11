pragma solidity >=0.5.0;

import "./oasis.sol";

contract OasisEchidna {
    // invariants:
    // - is sorted
    // - is not crossing
    // - balance always >= 0
    // - sum should be eq
    // - all orders linked should exist

  uint private marketId;

  address token1 = 0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359;
  address token2 = 0xCFdC4ca61423482657596cDb9f665647CCE043ee;


  constructor() public {
    marketId = addMarket(token1, token2, 10, 10);
  }

  // function breakIt(uint mId, bool buying, uint id) public  {
  //   fail = true;
  // }

  function echidna_alwaystrue() public returns (bool){
    return !fail;
  }

  function isSorted() private view returns (bool) {
        // buys descending?
        (, uint price,,, uint next) = this.getOrder(marketId, true, 0);
        while(next != 0) {
            (, price,,, next) = this.getOrder(marketId, true, next);
            (, uint nextPrice,,,) = this.getOrder(marketId, true, next);
            if(next != 0 && nextPrice > price) {
                return false;
            }
        }

        // sells descending?
        (,,,, next) = this.getOrder(marketId, false, 0);
        while(next != 0) {
            (, price,,, next) = this.getOrder(marketId, false, next);
            (, uint nextPrice,,,) = this.getOrder(marketId, false, next);
            if(next != 0 && nextPrice < price) {
                return false;
            }
        }
        return true;
  }

  uint constant private SENTINEL = 0;
    uint private lastId = 1;

    struct Order {
        uint     baseAmt;
        uint     price;
        address  owner;
        uint     prev;
        uint     next;
    }

    struct Market {
        address  baseTkn;
        address  quoteTkn;
        uint     dust;
        uint     tic;

        mapping (uint => Order) sells;
        mapping (uint => Order) buys;
    }

    mapping (uint => Market) public markets;
    mapping (address => mapping (address => uint)) public gems;

    function getMarketId(
        address baseTkn, address quoteTkn, uint dust, uint tic
    ) public pure returns (uint) {
        return uint(keccak256(abi.encodePacked(baseTkn, quoteTkn, dust, tic)));
    }

    function addMarket(
        address baseTkn, address quoteTkn, uint dust, uint tic
    ) public returns (uint id) {
        id = getMarketId(baseTkn, quoteTkn, dust, tic);
        require(markets[id].baseTkn == address(0), 'market-exists');
        markets[id] = Market(baseTkn, quoteTkn, dust, tic);
    }

    function credit(address usr, uint wad) public {
        credit(usr, msg.sender, wad);
    }

    function debit(address usr, uint wad) public {
        debit(usr, msg.sender, wad);
    }

    bool public fail = false;

    function cancel(uint mId, bool buying, uint id) public  {

        // if (mId == getMarketId(0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359, 0xCFdC4ca61423482657596cDb9f665647CCE043ee, 10, 10)) {
            fail = true;
        // }

        require(id != SENTINEL, 'sentinele_forever');

        Market storage m = markets[mId];
        mapping (uint => Order) storage orders = buying ? m.buys : m.sells;

        Order storage o = orders[id];
        require(o.baseAmt > 0, 'no_order');
        require(msg.sender == o.owner, 'only_owner');

        if(buying) {
            credit(o.owner, m.quoteTkn, wmul(o.baseAmt, o.price));
        } else {
            credit(o.owner, m.baseTkn, o.baseAmt);
        }
        remove(orders, id, o);
        return;
    }

    function getOrder(
        uint mId, bool buying, uint orderId
    ) public view returns (
        // TODO: is it possible to return just Order?
        uint baseAmt, uint price, address owner, uint prev, uint next
    ) {
        Market storage m = markets[mId];
        Order storage o = (buying ? m.buys : m.sells)[orderId];
        return (o.baseAmt, o.price, o.owner, o.prev, o.next);
    }

    // immediate or cancel
    function ioc(
        uint mId, uint amount, uint price, bool buying
    ) public  returns (uint left, uint total) {

        Market storage m = markets[mId];

        // dust controll
        require(wmul(amount, price) >= m.dust, 'dust');

        // tic controll
        require(price % m.tic == 0, 'tic');

        // limit order matching
        mapping (uint => Order) storage orders = buying ? m.sells : m.buys;
        uint id = orders[SENTINEL].next;
        Order storage o = orders[id];
        left = amount;
        total = 0;
        while(id != SENTINEL && (buying ? price >= o.price : price <= o.price)) {
            uint next = o.next;
            (left, total) = take(m, buying, orders, id, o, left, total);
            if(left == 0) {
              return (0, total);
            }
            o = orders[id = next];
        }
        return (left, total);
    }

    // fill or kill
    function fok(
        uint mId, uint amount, uint price, bool buying, uint totalLimit
    ) public  returns (uint left, uint total) {
        (left, total) = ioc(mId, amount, price, buying);
        require(buying ? total <= totalLimit : total >= totalLimit);
    }

    // limit order
    function limit(
        uint mId, uint amount, uint price, bool buying, uint pos
    ) public  returns (uint, uint, uint) {
        (uint left, uint total) = ioc(mId, amount, price, buying);

        if(left > 0) {
            return (make(mId, buying, left, price, pos), left, total);
        }

        return (0, left, total);
    }

    function update(
        uint mId, bool buying, uint id, uint amount, uint price, uint pos
    ) public  {

        Market storage m = markets[mId];

        mapping (uint => Order) storage orders = buying ? m.sells : m.buys;
        Order storage f = orders[orders[SENTINEL].next];

        require(
            (f.baseAmt == 0) || (f.baseAmt > 0 && buying ? f.price > price : f.price < price),
            'no_crosing_updates'
        );

        orders = buying ? m.buys : m.sells;

        Order storage u = orders[id];
        require(u.baseAmt > 0, 'no_order');
        require(msg.sender == u.owner, 'only_owner');

        Order storage o = next(orders, buying, price, pos);

        orders[u.next].prev = u.prev;
        orders[u.prev].next = u.next;

        u.next = orders[o.prev].next;
        u.prev = o.prev;
        orders[o.prev].next = id;
        o.prev = id;

        address tkn = buying ? m.quoteTkn : m.baseTkn;
        credit(u.owner, tkn, buying ? wmul(u.baseAmt, u.price) : u.baseAmt);
        debit(msg.sender, tkn, buying ? wmul(amount, price) : amount);

        u.price = price;
        u.baseAmt = amount;
    }

    // private methods
    function next(
        mapping (uint => Order) storage orders, bool buying, uint price, uint pos
    ) private view returns (Order storage o) {
        o = orders[pos];
        // does exist?
        if(o.baseAmt > 0) {
            // backtrack if necessary
            while(o.prev != SENTINEL && (buying ? o.price < price : o.price > price)) {
                o = orders[pos = o.prev]; // previous
            }
        } else {
            o = orders[pos = orders[SENTINEL].next]; // first
        }
        while(pos != SENTINEL && (buying ? o.price >= price : o.price <= price)) {
            o = orders[pos = o.next]; // next
        }
    }

    function credit(address usr, address gem, uint wad) private {
        gems[gem][usr] = add(gems[gem][usr], wad);
    }

    function debit(address usr, address gem, uint wad) private {
        gems[gem][usr] = sub(gems[gem][usr], wad);
    }

    // fills an order
    function take(
        Market storage m, bool buying,
        mapping (uint => Order) storage orders, uint id, Order storage o,
        uint left, uint total
    ) private returns (uint, uint) {

        uint baseAmt = left >= o.baseAmt ? o.baseAmt : left;
        uint quoteAmt = wmul(baseAmt, o.price);

        if(buying) {
            debit(msg.sender, m.quoteTkn, quoteAmt);
            credit(o.owner, m.quoteTkn, quoteAmt);
            credit(msg.sender, m.baseTkn, baseAmt);
        } else {
            debit(msg.sender, m.baseTkn, baseAmt);
            credit(o.owner, m.baseTkn, baseAmt);
            credit(msg.sender, m.quoteTkn, quoteAmt);
        }

        if(left >= o.baseAmt) {
            remove(orders, id, o);
            return (left - baseAmt, add(total, quoteAmt));
        }

        baseAmt = o.baseAmt - baseAmt;
        quoteAmt = wmul(baseAmt, o.price);
        if(quoteAmt < m.dust) {
            // give back
            if(buying) {
                credit(o.owner, m.baseTkn, baseAmt);
            } else {
                credit(o.owner, m.quoteTkn, quoteAmt);
            }
            remove(orders, id, o);
            return (0, add(total, quoteAmt));
        }

        o.baseAmt = baseAmt;
        return (0, add(total, quoteAmt));
    }

    // puts a new order into the order book
    function make(
        uint mId, bool buying, uint baseAmt, uint price, uint pos
    ) private returns (uint) {

        Market storage m = markets[mId];

        // dust controll
        uint quoteAmt = wmul(baseAmt, price);
        if(quoteAmt < m.dust) {
            return 0;
        }

        mapping (uint => Order) storage orders = buying ? m.buys : m.sells;

        Order storage o = next(orders, buying, price, pos);

        require(baseAmt > 0);
        require(price > 0);

        Order storage n = orders[++lastId];

        n.next = orders[o.prev].next;
        n.prev = o.prev;
        orders[o.prev].next = lastId;
        o.prev = lastId;

        n.owner = msg.sender;
        n.baseAmt = baseAmt;
        n.price = price;

        debit(msg.sender, buying ? m.quoteTkn : m.baseTkn, buying ? quoteAmt : baseAmt);

        return lastId;
    }

    // remove an order from the double-linked list
    function remove(
        mapping (uint => Order) storage orders, uint id, Order storage order
    ) private {
        require(id != SENTINEL);
        orders[order.next].prev = order.prev;
        orders[order.prev].next = order.next;
        delete orders[id];
    }

    // safe math
    uint constant WAD = 10 ** 18;

    function wmul(uint x, uint y) private pure returns (uint z) {
        require(y == 0 || ((z = (x * y) / WAD ) * WAD) / y == x, 'wmul-overflow');
    }

    function add(uint x, uint y) internal pure returns (uint z) {
        require((z = x + y) >= x, 'add-overflow');
    }

    function sub(uint x, uint y) internal pure returns (uint z) {
        require((z = x - y) <= x, 'sub-underflow');
    }
}