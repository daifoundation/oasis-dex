import * as fc from "fast-check";
import { times } from "lodash";
import { GEMS_NO, MAX_OFFERS_PER_MARKET } from "./fuzz";

export const RandomOffer = fc.record({
  amount: fc.nat(),
  price: fc.nat(),
  buying: fc.boolean(),
  pos: fc.nat(),
});

export const RandomMarket = fc.record({
  tokens: fc.shuffledSubarray(
    times(GEMS_NO).map(i => i),
    2,
    2,
  ),
  dust: fc.nat(1000),
  tic: fc.nat(1000),
  offers: fc.array(RandomOffer, MAX_OFFERS_PER_MARKET),
});
