import { createMockProvider, getWallets } from "ethereum-waffle";
import fc from "fast-check";
import { expect } from "chai";
import { utils } from "ethers";

import { getOrderBook } from "./orderbook";
import { deployOasisHelper, deployOasis, deployGemJoins, deployGems, TX_DEFAULTS } from "./contracts";
import { RandomMarkets } from "./arbitraries";
import { GEMS_NO } from "./constants";
import { areOffersSorted, offersNotCrossed, noDusts, orderbookSum } from "./invariants";
import { omit, Dictionary } from "lodash";

async function main() {
  console.log("Fuzzing...");

  let provider = createMockProvider();
  let [sender] = getWallets(provider);
  const oasisHelper = await deployOasisHelper(sender);

  let round = 0;
  let errors = 0;
  await fc.assert(
    fc.asyncProperty(RandomMarkets, async markets => {
      console.log("Round: ", round++);
      console.log("Markets: ", markets.length);
      console.log("Cumulative Errors: ", errors);

      const oasis = await deployOasis(sender);
      const gems = await deployGems(sender, GEMS_NO);
      const gemJoins = await deployGemJoins(sender, oasis, gems);

      for (const market of markets) {
        console.log("Creating market: ", JSON.stringify(omit(market, "offers")));
        const gemA = gemJoins[market.tokens[0]];
        const gemB = gemJoins[market.tokens[1]];

        // prevent adding same market twice ie. markets should not have duplicates
        await oasis.addMarket(gemA.address, gemB.address, market.dust, market.tic);
        const marketId = await oasis.getMarketId(gemA.address, gemB.address, market.dust, market.tic);

        console.log(`Adding ${market.offers.length} offers...`);
        for (const offer of market.offers) {
          console.log("Adding...", JSON.stringify({ marketId, ...offer }));

          const gem = offer.buying ? gemB : gemA;
          const joinAmt = offer.buying
            ? utils.bigNumberify(offer.amount).mul(offer.price)
            : utils.bigNumberify(offer.amount);
          await gem.join(sender.address, joinAmt, TX_DEFAULTS);

          await oasis
            .limit(marketId, offer.amount, offer.price, offer.buying, offer.pos, TX_DEFAULTS)
            .catch(async e => {
              errors++;
              console.error("limit failed with: ", e.message);
              await gem.exit(sender.address, joinAmt, TX_DEFAULTS);
            });
        }
      }

      const orderBookGemBalances: Dictionary<utils.BigNumber> = {};
      for (const market of markets) {
        console.log("Verifying market: ", JSON.stringify(omit(market, "offers")));
        const gemA = gems[market.tokens[0]];
        const gemB = gems[market.tokens[1]];
        const gemJoinA = gemJoins[market.tokens[0]];
        const gemJoinB = gemJoins[market.tokens[1]];

        const marketId = await oasis.getMarketId(gemJoinA.address, gemJoinB.address, market.dust, market.tic);
        const offers = await getOrderBook(oasis, oasisHelper, marketId);

        console.log("Final orderbook state:");
        console.log("Buy:", offers.buying.length);
        console.log("Sell:", offers.selling.length);

        expect(areOffersSorted(offers.buying, "desc"), "buys not ordered").to.be.true;
        expect(areOffersSorted(offers.selling, "asc"), "sells not ordered").to.be.true;

        expect(offersNotCrossed(offers.buying, offers.selling), "offers should not cross").to.be.true;

        expect(noDusts([...offers.buying, ...offers.selling], market.dust), "DUST should be respected").to.be.true;

        orderBookGemBalances[gemA.address] = (orderBookGemBalances[gemA.address] ?? utils.bigNumberify(0)).add(
          await orderbookSum(offers.selling, false),
        );
        orderBookGemBalances[gemB.address] = (orderBookGemBalances[gemB.address] ?? utils.bigNumberify(0)).add(
          await orderbookSum(offers.buying, true),
        );
      }
      for (const [index, gem] of Array.from(gems.entries())) {
        console.log("Verifying gem: ", gem.address);

        const gemJoin = gemJoins[index];
        const balanceGem = await gem.balanceOf(gemJoin.address);
        const orderbookBalance = orderBookGemBalances[gem.address] ?? utils.bigNumberify(0);

        expect(balanceGem.toString(), "Gem balances don't match").to.be.eq(orderbookBalance.toString());
      }

      console.log("DONE");

      // orders:
      //    - type: bez fok?
      //    - update? tylko dla tych ktore ma
      // make orders - call limit
      // try canceling some of them
      // try updating
    }),
    { verbose: true, numRuns: 1000 },
  );
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
