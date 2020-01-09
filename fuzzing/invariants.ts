import { isSorted, Order, getLast } from "./utils";
import { OfferModel } from "./commands";

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

  return lastBuy.gt(firstSell);
}

export function noDusts(allOffers: OfferModel[], dust: number) {
  return allOffers.every(o => o.price.gte(dust))
}