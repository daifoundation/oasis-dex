# Oasis

Simple on-chain market for ERC20-compatible tokens.

## 'Previous' version:
- https://github.com/makerdao/maker-otc
- https://github.com/makerdao/maker-otc-support-methods

**Work in progress!**

## General assumptions
### Permissionless
There are neither priviled users nor operators. No KYC, no master switch, no one beside the owner can cancel offers. Market creation and parameters selection(trading pair, dust, tick) is done on the darwinian basis, ie any configuration is permissioned, market participants decide which one to trade on.

### Non custodial
Makers funds are deposited in the exchange escrow ensuring that the order can always be settled. No need to trust funds to anything beside smartcontract logic.

### Composable
Can be used by other smartcontracts as a building block. Logic is fully implemented on chain, always available.

### Orderbook based price discovery
Proven in practice, safer than bonding curve designs
...

## Specifics

### Order model
* buy orders: base amount, price, owner
* sell orders: base amount, price, owner

### Dust
Minimum on order total quote, prevents polluting orderbook with small orders that would make matching cost a lot of gas.

### Tick
Minimum amount by which price can move. See: https://www.investopedia.com/terms/t/tick.asp.

### Order types
* Limit order
* Fill or kill
* Immediate or cancel

### Adapter based
Saves maker gas by not requiring transfers on each match, abstracts erc20 peculiarities,

### Move
For market makes, combines cancel and make, saves 50% of gas.

### Expiration
should it expire ???

### Single contract vs contract per market(uniswap like)
???

### Specific usecases support
Kyber?

### Frontrunning prevention
Idea: Maker orders need to incubate for 1 block ???

### Transaction expiration
Idea: Uniswap style ???

### Rounding behaviour
...

## Scratchpad
### To run tests on source change:
```bash
dapp test; while inotifywait -e close_write src/*; do dapp test; done
```

### Gas usage analysis
* Old:
* make:   241,653 ?
    * (BAT-DAI, 227,820, main, 5.12.19, 0x68359624873e8bd961545fcc2a759ccbb871378107cd88bd985ddffe85d42a58)
    * (BAT-DAI, 217,514, kovan, 5.12.19, 0x2aec3752b2b7569f1fa159aac9c33f04b662ce17e630cdc15af458f8c11f327e)
* cancel:  73,919
    * (BAT-DAI, 65,441, main, 5.12.19, 0x1cb0d1e242ec15298063f6f5a651b0486e577ed8806f67dcddb9505364e3ed7e)
    * (BAT-DAI, 72,121, kovan, 5.12.19, 0x7eb309edccfdb67f8d9f1a8b50ab9a8ab9d0b11278a607fb1cddb3508933e013)


* New:
    * make:   125,000
    * cancel:  43,000
    * update:  86,768 (3,5x)
