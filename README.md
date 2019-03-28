# Oasis

Simple on-chain market for ERC20-compatible tokens.

**Work in progress!**

## To run tests on source change:
```bash
dapp test; while inotifywait -e close_write src/*; do dapp test; done
```

## Previous version:
- https://github.com/makerdao/maker-otc
- https://github.com/makerdao/maker-otc-support-methods

## Todo (first iteration):
- more test scenarios
- safe math
- utility contract
- ds-auth
- reentrancy
- coding style based on flip
- gas usage tests?
- comments
- RAD, WAT, RAY, token presicion

## Todo (later):
- events
- use grc to colorise dapp output
- expiration date
