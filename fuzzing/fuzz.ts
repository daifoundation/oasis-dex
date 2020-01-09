import { createMockProvider, deployContract, getWallets } from "ethereum-waffle";
import fc from "fast-check";

import { OfferModel } from "./commands";
import { isSorted, q18 } from "./utils";
import { getOrderBook } from "./orderbook";
import { deployOasisHelper, deployOasis, deployGemJoins, deployGems, TX_DEFAULTS } from "./contracts";
import { times } from "lodash";

export const GEMS_NO = 4;
export const MAX_MARKETS = 1;
export const MAX_OFFERS_PER_MARKET = 20;

async function main() {
  console.log("Fuzzing...");

  let provider = createMockProvider();
  let [sender, gemDeployer] = getWallets(provider);
  const oasisHelper = await deployOasisHelper(sender);

  let i = 0;
  // await fc.assert(
  //   fc.asyncProperty(fc.array(RandomMarket, maxMarket), async markets => {
  const markets = [
    {
      tokens: [1, 2],
      dust: 0,
      tic: q18(1).div(100),
      offers: [
        { amount: q18(1), price: q18(500), buying: false, pos: 507273949 },
        // {
        //   amount: 1101888850,
        //   price: 1542937419,
        //   buying: true,
        //   pos: 1221808968
        // },
        // {
        //   amount: 1980712877,
        //   price: 1712511499,
        //   buying: false,
        //   pos: 792590599
        // },
        // {
        //   amount: 1312857782,
        //   price: 229164883,
        //   buying: false,
        //   pos: 690663897
        // }
      ],
    },
  ];
  console.log("i", i++);

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
      const joinAmt = offer.buying ? offer.amount.mul(offer.price) : offer.amount;
      await gem.join(sender.address, joinAmt, TX_DEFAULTS);

      await oasis.limit(marketId, offer.amount, offer.price, offer.buying, offer.pos, TX_DEFAULTS);
    }
    debugger;
  }

  // for (const market of markets) {
  //   console.log("Verifying market: ", JSON.stringify(market));
  //   const gemA = gemJoins[market.tokens[0]];
  //   const gemB = gemJoins[market.tokens[1]];

  //   const marketId = await oasis.getMarketId(gemA.address, gemB.address, market.dust, market.tic);
  //   const offers = await getOrderBook(oasis, oasisHelper, marketId);
  //   debugger;

  //   if (areOffersSorted(offers) === false) {
  //     throw new Error("Offers are not sorted!");
  //   }
  // }

  console.log("DONE");

  // orders:
  //    - type: bez fok?
  //    - update? tylko dla tych ktore ma
  // make orders - call limit
  // try canceling some of them
  // try updating

  //invariants:
  // - buy i sell powinny byc posortowane
  // - nie powinny sie crossowac (powinien byc spread)
  // - bilans (balances + stan orderbooka) powinny sie zgadzac
  // no dust orders

  // ideas: try adding orders to non existing markets
  // ideas: mix order markets
  // }),
  // { verbose: true, endOnFailure: true, numRuns: 10 }
  // );
}

function areOffersSorted(offers: OfferModel[]) {
  return isSorted(offers.map(o => o.price));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
