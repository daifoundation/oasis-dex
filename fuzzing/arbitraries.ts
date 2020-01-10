import * as fc from "fast-check";
import { times } from "lodash";
import { GEMS_NO, MAX_OFFERS_PER_MARKET, MAX_MARKETS } from "./constants";
import { q18 } from "./utils";

export const RandomOffer = fc.record({
  amount: fc.nat(),
  price: fc.nat(10_000).map(v => q18(v)),
  buying: fc.boolean(),
  pos: fc.nat(),
});

export const RandomMarket = fc.record({
  tokens: fc.shuffledSubarray(
    times(GEMS_NO).map((_, i) => i),
    2,
    2,
  ),
  dust: fc.nat(1000),
  tic: fc.constant(1000),
  offers: fc.array(RandomOffer, MAX_OFFERS_PER_MARKET),
});

export const RandomMarkets = fc.array(RandomMarket, 1, MAX_MARKETS)