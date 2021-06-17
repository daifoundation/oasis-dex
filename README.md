# Oasis DEX 2

A prototype resulting from a research project into whether it would be possible to create a next iteration of OasisDEX which could handle both pure crypto orders and also orders relating to tokens with transfer restrictions (e.g. greenlist/redlist etc).

The smart contracts have not been robustly independently tested and have not been audited - they are in no way in a state that could be deployed (does have unit tests completed).

# Disclaimer

Not tested, audited, just a research project! Should not be deployed!

## Getting started

```
yarn
yarn test
```

## Development

When changing contracts, you need run compile to rebuild type information for tests.

```
yarn compile
```

To run tests and recompile any changes in smartcontracts run:

```
yarn test
```

To run tests with coverage:

```
yarn coverage
```
Coverage report can be found in `coverage` (just open `index.html` in your browser).

Finally, to run prettier and linter in fix mode and finally tests run:

```
yarn test:fix
```

## General assumptions

### Problem space

- on-chain market/markets for ERC20 and security tokens
- supported class of security tokens:
    - only simple whitelist-like transfer restrictions
    - forced transfers
    - it might not be possible to put market contract on the token whitelist
    - it is possible to grant allowance to market contract.
    - examples spotted in the wild:
        - Stokr - [https://github.com/stokr-io/stokr-smart-contracts/tree/master/contracts](https://github.com/stokr-io/stokr-smart-contracts/tree/master/contracts)
        - RealT - [https://eveem.org/code/0xE9eace1313913888C364D8504ffC3b8d991C67C6](https://eveem.org/code/0xE9eace1313913888C364D8504ffC3b8d991C67C6)

    Info from Jacek:

    - [That](https://github.com/CMTA/CMTA20)'s a security (equity) token standard which it seems is followed by a few Swiss token issuers, including [this token](https://www.iam-lab.ch/token/) which was recently issued (and is tradable on Uniswap);
    - I was told by atpar, a tokenization platform, that they have been using the above plus ERC-1404 (from Tokensoft), ERC-1400 (from Polymath), and ERC-20 with added ERC-2222;
    - I am still waiting for info from Amazing Blocks;
    - I reached out to STOKR for an Etherscan link to any implemented security token issued via their platform. There we go with STOKR contracts:
        - BlueSky Token contract: [https://etherscan.io/address/0x1982f533D195ffea3E9BAB0fcdd3bBa0c1C5df55#code](https://etherscan.io/address/0x1982f533D195ffea3E9BAB0fcdd3bBa0c1C5df55#code)
        - ArtID Token contract: [https://etherscan.io/address/0x9a3f7daafd36a69fb9f88c764b10817f2066a7f0#code](https://etherscan.io/address/0x9a3f7daafd36a69fb9f88c764b10817f2066a7f0#code)
        - TRex:
        contract: [https://github.com/TokenySolutions/T-REX/tree/master/contracts/token](https://github.com/TokenySolutions/T-REX/tree/master/contracts/token)
        whitepaper: [https://tokeny.com/wp-content/uploads/2019/12/Whitepaper-T-REX-Security-tokens.pdf](https://tokeny.com/wp-content/uploads/2019/12/Whitepaper-T-REX-Security-tokens.pdf)

### Attack line

- suite of separate smart contracts covering different use cases
- modularisation: Two level inheritance with abstract base contract that models orderbook and matching logic. Target contracts provide implementation of abstract methods defined by base contract, adapting base contract to specific use case. When experimentation phase is over we might flatten the inheritance hierarchy in order to have structure that is simple to reason about.
- contract prototypes under development:
    - ERC20 pair without adapters, with escrow, very close to OasisDEX V1, rather theoretical excercise to prove right amount of abstraction in the base contract
    - ERC20 pair with adapters and escrow
    - security tokens pair without adapters and escrow
- contracts prototypes that might be considered worth prototyping:
    - mixed security token as base and ERC20 as quote, quote token might be escrowed
    - in case when adding market address to the whitelist is possible, it should be possible to escrow security tokens on per maker address

### Order model

Order model assumptions: General goal was to have an order model that will balance following constraints:

- intuitive - i.e. no need to simulate sell orders with buy orders
- clear semantic - i.e. explicit price instead of buy/sell amount ratio with related rounding problems causing price drift phenomenon
- 'simple' implementation - the lower the amount of loc the better, declarative over imperative, not all implementations are equally verifiable

My main reference point for exchange interfaces is ccxt, a library that provides access to multiple exchanges. [https://github.com/ccxt/ccxt/wiki/Manual#placing-orders](https://github.com/ccxt/ccxt/wiki/Manual#placing-orders)

Price, base amount model seems dominant there, and that is also main v2 assumption.

#### Rounding

Higly experimental attempt to get rid of rouding altogether. Not final!

If we take explicit price assumption seriously, we should not be doing any rounding at all, as it means trading at a price that is different than specified. For zero precision tokens that might be a serious difference.

The only place when rounding might occur is where quote amount is calculated ie quote = base * price. No rounding means that base * price should not have more than quote precision decimals (quoteDec).

Next observation is about tic: price needs to meet tic condition ie: `price % tic == 0`. We can assume without significantly affecting usability that several last digits of tic are zeros (`ticUnusedDec ≤ quoteDec`), which also means that that `ticUnusedDec` last digits of price are zeros. That means that if only `min(baseDec, ticUnusedDec)` first decimal digits of base amount are non zero then no rounding will be necessary to calculate quote.

Example:

base token: FOO, baseDec = 18

quote token: DAI, quoteDec = 18

tic: 10^16 - price needs to move by at least one dai-cent

baseAvailableDec = min(18, 16) = 16

base amount: 0.0000000000000001 = 10^-16

price: 0.01

quote:  10^-18 - no rounding!

#### **Dust**

Minimum on order total quote, prevents polluting orderbook with small orders that would make matching cost a lot of gas.

#### **Tick**

Minimum amount by which price can move. See: [https://www.investopedia.com/terms/t/tick.asp](https://www.investopedia.com/terms/t/tick.asp).

### **Order types**

- Limit order
- Fill or kill
- Immediate or cancel
