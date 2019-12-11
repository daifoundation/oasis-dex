const Oasis = artifacts.require("Oasis");
const fc = require("fast-check");

contract("Oasis -> Fuzzing", ([deployer, ...accounts]) => {
  it("should do things", async () => {
    // const a = "0xf801d3d3fb92c7fc91463198164c5f027aba5506";
    // const b = "0x2f57ea5d0b1e8a7b85603ad7dfcdec8fd8680579";

    // // console.log(oasis);
    // debugger;
    // const oasis = await Oasis.deployed();

    // const RandomAddress = fc
    //   .nat(accounts.length - 1)
    //   .chain(i => fc.constant(accounts[i]));

    const RandomMarket = fc.record({
      tokens: fc.shuffledSubarray(accounts, 2, 2),
      dust: fc.nat(1000),
      tic: fc.nat(1000)
    });

    await fc.assert(
      fc.asyncProperty(fc.array(RandomMarket, 20), async markets => {
        // fc.pre(markets.map())
        const oasis = await Oasis.new({ data: { from: deployer } });

        await Promise.all(
          markets.map(async market => {
            // console.log("Creating market: ", JSON.stringify(market));

            await oasis.addMarket(
              market.tokens[0],
              market.tokens[1],
              market.dust,
              market.tic,
              {
                from: deployer
              }
            );
          })
        );
      }),
      { verbose: true, numRuns: 1000000 }
    );
  });
});
