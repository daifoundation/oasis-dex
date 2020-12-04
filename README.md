# Oasis DEX 2

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
