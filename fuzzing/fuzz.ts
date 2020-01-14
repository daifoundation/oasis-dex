import { createMockProvider, getWallets } from "ethereum-waffle";
import fc from "fast-check";
import { expect } from "chai";
import { utils } from "ethers";

import { getOrderBook } from "./orderbook";
import {
  deployOasisHelper,
  deployOasis,
  deployGemJoins,
  deployGems,
  TX_DEFAULTS,
  sumGemJoinBalance,
  cancel,
  update,
} from "./contracts";
import { RandomMarkets, RandomActionResult } from "./arbitraries";
import { GEMS_NO } from "./constants";
import { areOffersSorted, offersNotCrossed, noDusts, orderbookSum } from "./invariants";
import { omit, Dictionary } from "lodash";

async function main() {
  console.log("Fuzzing...");

  let provider = createMockProvider();
  let [sender] = getWallets(provider);
  const oasisHelper = await deployOasisHelper(sender);

  const stats = {
    round: 0,
    limitOffers: 0,
    limitOfferErrors: 0,
    cancels: 0,
    cancelsErrors: 0,
    updates: 0,
    updateErrors: 0,
  };

  await fc.assert(
    fc.asyncProperty(RandomMarkets, async markets => {
      stats.round++;
      console.log("Stats: ", JSON.stringify(stats));
      console.log("Markets: ", markets.length);

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

        for (const _action of market.actions) {
          const action = _action as RandomActionResult;
          debugger;
          if (action.action === "limit") {
            try {
              await oasis.limit(marketId, action.amount, action.price, action.buying, action.pos, TX_DEFAULTS);
              stats.limitOffers++;
            } catch (e) {
              stats.limitOfferErrors++;
              console.error("limit failed with: ", e.message);
            }
          } else if (action.action === "cancel") {
            try {
              await cancel(oasis, marketId, action.id);
              stats.cancels++;
            } catch (e) {
              stats.cancelsErrors++;
              console.error("cancel failed with: ", e.message);
            }
          } else if (action.action === "update") {
            console.log("update not implemented");

            try {
              await update(oasis, marketId, action.id, action.amount, action.price, action.pos);
              stats.updates;
            } catch (e) {
              stats.updateErrors++;
              console.error("update failed with: ", e.message);
            }
          } else {
            throw new Error(`Not implemented action: ${(action as any).action}!`);
          }
        }

        console.log(`Adding ${market.actions.length} offers...`);
        for (const offer of market.actions) {
          console.log("Adding...", JSON.stringify({ marketId, ...offer }));
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
      // do not check balances
      // for (const [index, gem] of Array.from(gems.entries())) {
      //   console.log("Verifying gem: ", gem.address);

      //   const gemJoin = gemJoins[index];
      //   const balanceGem = await gem.balanceOf(gemJoin.address);
      //   const orderbookBalance = orderBookGemBalances[gem.address] ?? utils.bigNumberify(0);
      //   const gemJoinBalance = await sumGemJoinBalance(oasis, gemJoin, sender.address);

      //   expect(balanceGem.toString(), `Gem ${index} balances don't match`).to.be.eq(
      //     orderbookBalance.add(gemJoinBalance).toString(),
      //   );
      // }

      console.log("DONE");
    }),
    { verbose: true, numRuns: 1000 },
  );
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
