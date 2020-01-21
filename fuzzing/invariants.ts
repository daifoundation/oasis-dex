import { isSorted, Order, getLast } from "./utils";
import { utils } from "ethers";
import { Model, Runtime } from "./commands";
import { DsTokenBase } from "../types/ethers-contracts/DSTokenBase";
import { GemJoin } from "../types/ethers-contracts/GemJoin";
import { getOrderBook } from "./orderbook";
import { expect } from "chai";
import { OfferModel } from "./contracts";

export async function checkInvariants(model: Model, r: Runtime) {
  for (const market of model.markets) {
    console.log("Verifying market: ", JSON.stringify({ base: market.base, quote: market.quote }));
    const offers = await getOrderBook(r.oasis, r.oasisHelper, market.id);

    console.log("Final orderbook state:");
    console.log("Buy:", offers.buying.length);
    console.log("Sell:", offers.selling.length);

    expect(areOffersSorted(offers.buying, "desc"), "buys not ordered").to.be.true;
    expect(areOffersSorted(offers.selling, "asc"), "sells not ordered").to.be.true;

    expect(offersNotCrossed(offers.buying, offers.selling), "offers should not cross").to.be.true;

    expect(noDusts([...offers.buying, ...offers.selling], market.dust), "DUST should be respected").to.be.true;
  }
}

export function areOffersSorted(offers: OfferModel[], order: Order): boolean {
  return isSorted(
    offers.map(o => o.price),
    order,
  );
}

export function offersNotCrossed(buying: OfferModel[], selling: OfferModel[]): boolean {
  const lastBuy = getLast(buying)?.price;
  const firstSell = selling[0]?.price;

  if (!lastBuy || !firstSell) return true;
  return lastBuy.lt(firstSell);
}

export function noDusts(allOffers: OfferModel[], dust: number) {
  return allOffers.every(o => o.price.gte(dust));
}

export function orderbookSum(offers: OfferModel[], buy: boolean) {
  return offers.reduce((acc, cur) => acc.add(buy ? cur.baseAmt.mul(cur.price) : cur.baseAmt), utils.bigNumberify(0));
}
