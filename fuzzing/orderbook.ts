import { utils } from "ethers";
import { zip } from "lodash";

import { Oasis as OasisType } from "../types/ethers-contracts/Oasis";
import { OasisHelper as OasisHelperType } from "../types/ethers-contracts/OasisHelper";
import { OfferModel } from "./contracts";

export async function getOrderBook(oasis: OasisType, oasisHelperType: OasisHelperType, market: utils.BigNumber) {
  return {
    buying: await getOrderBookSide(oasis, oasisHelperType, market, true),
    selling: await getOrderBookSide(oasis, oasisHelperType, market, false),
  };
}

async function getOrderBookSide(
  oasis: OasisType,
  oasisHelperType: OasisHelperType,
  market: utils.BigNumber,
  buying: boolean,
) {
  let allOrders: OfferModel[] = [];

  let needsNewOrders = true;

  while (needsNewOrders) {
    const lastId = allOrders[allOrders.length - 1]?.id.toNumber() ?? 0;
    const orders = await getOrderBookChunk(oasis, oasisHelperType, market, buying, lastId);

    needsNewOrders = orders.length > 0;
    allOrders = [...allOrders, ...orders];
  }

  return allOrders;
}

async function getOrderBookChunk(
  oasis: OasisType,
  oasisHelperType: OasisHelperType,
  market: utils.BigNumber,
  buying: boolean,
  id: number,
): Promise<OfferModel[]> {
  const rawOffers = await oasisHelperType.getOffers(oasis.address, market, buying, id);

  const zippedOffers = zip(rawOffers.ids, rawOffers.owners, rawOffers.baseAmts, rawOffers.prices);
  return zippedOffers
    .filter(rawOffer => !rawOffer[0].isZero())
    .map(rawOffer => {
      return {
        id: rawOffer[0],
        owner: rawOffer[1],
        baseAmt: rawOffer[2],
        price: rawOffer[3],
      } as OfferModel;
    });
}
