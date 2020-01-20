import * as fc from "fast-check";
import { times } from "lodash";
import { GEMS_NO, MAX_OFFERS_PER_MARKET, MAX_MARKETS } from "./constants";
import { q18 } from "./utils";
import { Arbitrary } from "fast-check";

export const RandomAction = fc.constantFrom("limit", "cancel", "update");

const action2Arb = (action: string, args: any) => {
  switch (action) {
    case "limit":
      return RandomLimitOffer();
    case "cancel":
      return RandomCancel(args);
    case "update":
      return RandomUpdate(args);
  }
};
export type RandomActionResult = GetArbType<
  ReturnType<typeof RandomLimitOffer | typeof RandomCancel | typeof RandomUpdate>
>;

export const RandomLimitOffer = () =>
  fc.record({
    action: fc.constant("limit" as const),
    amount: fc.nat(),
    price: fc.nat(10_000).map(v => q18(v)),
    buying: fc.boolean(),
    pos: fc.nat(),
  });

export const RandomCancel = (maxId: number) =>
  fc.record({
    action: fc.constant("cancel" as const),
    id: fc.nat(maxId),
  });

export const RandomUpdate = (maxId: number) =>
  fc.record({
    action: fc.constant("update" as const),
    id: fc.nat(maxId),
    amount: fc.nat(),
    price: fc.nat(10_000).map(v => q18(v)),
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
  actions: fc.array(RandomAction, MAX_OFFERS_PER_MARKET).chain(actions => {
    const a: Arbitrary<any>[] = actions.map(action2Arb); // @todo there is some problem with types here and we require any here
    return fc.genericTuple(a)
  }),
});

export const RandomMarkets = fc.array(RandomMarket, 1, MAX_MARKETS);

export type GetArbType<T> = T extends fc.Arbitrary<infer C> ? C : never;


export const pickOne = (array: unknown[]) => fc.shuffledSubarray(array, 1, 1).map((e) => e[0])