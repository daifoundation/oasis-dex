import { utils } from "ethers";
import { zip } from "lodash";

import { Oasis as OasisType } from "../types/ethers-contracts/Oasis";
import { OasisHelper as OasisHelperType } from "../types/ethers-contracts/OasisHelper";
import { OfferModel } from "./commands";

export async function getOrderBook(
  oasis: OasisType,
  oasisHelperType: OasisHelperType,
  market: utils.BigNumber
) {
  return [
    ...(await getOrderBookSide(oasis, oasisHelperType, market, true, 0)),
    ...(await getOrderBookSide(oasis, oasisHelperType, market, false, 0))
  ];
}

async function getOrderBookSide(
  oasis: OasisType,
  oasisHelperType: OasisHelperType,
  market: utils.BigNumber,
  buying: boolean,
  id: number = 0
): Promise<OfferModel[]> {
  const rawOffers = await oasisHelperType.getOffers(
    oasis.address,
    market,
    buying,
    id
  );

  const zippedOffers = zip(
    rawOffers.ids,
    rawOffers.owners,
    rawOffers.baseAmts,
    rawOffers.prices
  );
  return zippedOffers.map(rawOffer => {
    return {
      id: rawOffer[0],
      owner: rawOffer[1],
      baseAmt: rawOffer[2],
      price: rawOffer[3]
    } as OfferModel;
  });
}
