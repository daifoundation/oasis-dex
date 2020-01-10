import { isSorted, Order, getLast } from "./utils";
import { utils } from "ethers";
import { OfferModel } from "./commands";
import { DsTokenBase } from "../types/ethers-contracts/DSTokenBase";
import { GemJoin } from "../types/ethers-contracts/GemJoin";

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
