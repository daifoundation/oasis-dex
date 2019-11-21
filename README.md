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
- comments
- events
- expiration date ?

## Gas usage analysis
    * Old:
        * make:   241,653
        * cancel:  73,919
    * New:
        * make:   125,000
        * cancel:  43,000
        * update:  86,768 (3,6x, 2x)
