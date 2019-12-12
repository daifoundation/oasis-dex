const {
  createMockProvider,
  deployContract,
  getWallets,
  solidity
} = require("ethereum-waffle");
const Oasis = require("../build/Oasis.json");
const fc = require("fast-check");

async function main() {
  let provider = createMockProvider();
  let [sender, ...wallets] = getWallets(provider);

  const RandomMarket = fc.record({
    tokens: fc.shuffledSubarray(
      wallets.map(w => w.address),
      2,
      2
    ),
    dust: fc.nat(1000),
    tic: fc.nat(1000)
  });

  console.log("Fuzzing...");
  let i = 0;
  await fc.assert(
    fc.asyncProperty(fc.array(RandomMarket, 20), async markets => {
      // fc.pre(markets.map())
      console.log("i", i++);
      const oasis = await deployContract(sender, Oasis);

      // await Promise.all(
      //   markets.map(async market => {
      //     console.log("Creating market: ", JSON.stringify(market));

      //     await oasis.addMarket(
      //       market.tokens[0],
      //       market.tokens[1],
      //       market.dust,
      //       market.tic,
      //     );
      //   })
      // );
    }),
    { verbose: true, numRuns: 1000000 }
  );
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
