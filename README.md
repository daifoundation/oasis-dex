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
        * make:   241,653 ?
            (BAT-DAI, 227,820, main, 5.12.19, 0x68359624873e8bd961545fcc2a759ccbb871378107cd88bd985ddffe85d42a58)
            (BAT-DAI, 217,514, kovan, 5.12.19, 0x2aec3752b2b7569f1fa159aac9c33f04b662ce17e630cdc15af458f8c11f327e)
        * cancel:  73,919
            (BAT-DAI, 65,441, main, 5.12.19, 0x1cb0d1e242ec15298063f6f5a651b0486e577ed8806f67dcddb9505364e3ed7e)
            (BAT-DAI, 72,121, kovan, 5.12.19, 0x7eb309edccfdb67f8d9f1a8b50ab9a8ab9d0b11278a607fb1cddb3508933e013)


    * New:
        * make:   125,000
        * cancel:  43,000
        * update:  86,768 (3,6x, 2x)
