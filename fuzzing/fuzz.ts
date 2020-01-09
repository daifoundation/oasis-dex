import { createMockProvider, deployContract, getWallets } from "ethereum-waffle";
import fc from "fast-check";
import { expect } from "chai";
import { utils } from "ethers";

import { OfferModel } from "./commands";
import { isSorted, Order } from "./utils";
import { getOrderBook } from "./orderbook";
import { deployOasisHelper, deployOasis, deployGemJoins, deployGems, TX_DEFAULTS } from "./contracts";
import { RandomMarket } from "./arbitraries";
import { MAX_MARKETS, GEMS_NO } from "./constants";
import { areOffersSorted, offersNotCrossed, noDusts } from "./invariants";

async function main() {
  console.log("Fuzzing...");

  let provider = createMockProvider();
  let [sender] = getWallets(provider);
  const oasisHelper = await deployOasisHelper(sender);

  let round = 0;
  let errors = 0;
  await fc.assert(
    fc.asyncProperty(fc.array(RandomMarket, 1, MAX_MARKETS), async markets => {
      console.log("Round: ", round++);
      console.log("Errors: ", errors);

      const oasis = await deployOasis(sender);
      const gems = await deployGems(sender, GEMS_NO);
      const gemJoins = await deployGemJoins(sender, oasis, gems);

      for (const market of markets) {
        console.log("Creating market: ", JSON.stringify(market));
        const gemA = gemJoins[market.tokens[0]];
        const gemB = gemJoins[market.tokens[1]];

        // prevent adding same market twice ie. markets should not have duplicates
        await oasis.addMarket(gemA.address, gemB.address, market.dust, market.tic);
        const marketId = await oasis.getMarketId(gemA.address, gemB.address, market.dust, market.tic);

        console.log(`Adding ${market.offers.length} offers...`);
        for (const offer of market.offers) {
          console.log("adding...", JSON.stringify({ marketId, ...offer }));

          const gem = offer.buying ? gemB : gemA;
          const joinAmt = offer.buying
            ? utils.bigNumberify(offer.amount).mul(offer.price)
            : utils.bigNumberify(offer.amount);
          await gem.join(sender.address, joinAmt, TX_DEFAULTS);

          await oasis
            .limit(marketId, offer.amount, offer.price, offer.buying, offer.pos, TX_DEFAULTS)
            .catch(() => errors++);
        }
      }

      for (const market of markets) {
        console.log("Verifying market: ", JSON.stringify(market));
        const gemA = gemJoins[market.tokens[0]];
        const gemB = gemJoins[market.tokens[1]];

        const marketId = await oasis.getMarketId(gemA.address, gemB.address, market.dust, market.tic);
        const offers = await getOrderBook(oasis, oasisHelper, marketId);

        try {
          expect(areOffersSorted(offers.buying, "desc"), "buys not ordered").to.be.true;
          expect(areOffersSorted(offers.selling, "asc"), "sells not ordered").to.be.true;

          expect(offersNotCrossed(offers.buying, offers.selling), "offers should not cross").to.be.true;

          expect(noDusts([...offers.buying, ...offers.selling], market.dust), "DUST should be respected").to.be.true;
        } catch (e) {
          //super useful for debugging...
          debugger;
          throw e;
        }
      }

      console.log("DONE");

      // orders:
      //    - type: bez fok?
      //    - update? tylko dla tych ktore ma
      // make orders - call limit
      // try canceling some of them
      // try updating

      //invariants:
      // - bilans (balances + stan orderbooka) powinny sie zgadzac

      // ideas: try adding orders to non existing markets
      // ideas: mix order markets
    }),
    { verbose: true, numRuns: 1000 },
  );
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
