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
- utility contract
- ds-auth
- gas usage tests?
- comments
- RAD, WAD, RAY, token precision?
- migration procedure: https://blog.trailofbits.com/2018/10/29/how-contract-migration-works/

## Todo (later):
- events
- use grc to colorise dapp output
- expiration date
