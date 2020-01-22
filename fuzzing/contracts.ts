import { Wallet } from "ethers";
import { BigNumber, formatBytes32String } from "ethers/utils";

import { Oasis as OasisType } from "../types/ethers-contracts/Oasis";
import { OasisHelper as OasisHelperType } from "../types/ethers-contracts/OasisHelper";
import { DsToken as DsTokenType } from "../types/ethers-contracts/DSToken";
import { GemJoin as GemJoinType } from "../types/ethers-contracts/GemJoin";
import { deployContract } from "ethereum-waffle";
import { q18, UINT_256_MAX } from "./utils";
import { Dictionary } from "ts-essentials";

const Oasis = require("../waffle_out/Oasis.json");
const OasisHelper = require("../waffle_out/OasisHelper.json");
const DSToken = require("../waffle_out/DSToken.json");
const GemJoin = require("../waffle_out/GemJoin.json");

export const TX_DEFAULTS = {
  gasLimit: 5000000,
};

export const tokenNames = ["ETH", "DAI", "MKR", ];
export async function deployGems(sender: Wallet): Promise<Dictionary<DsTokenType>> {
  const res: Dictionary<DsTokenType> = {};

  for (const name of tokenNames) {
    const token = (await deployContract(sender, DSToken, [formatBytes32String(name)])) as DsTokenType;
    await token.mint(sender.address, UINT_256_MAX, TX_DEFAULTS);
    res[name] = token;
  }

  return res;
}

export async function deployGemJoins(
  sender: Wallet,
  oasis: OasisType,
  gems: Dictionary<DsTokenType>,
): Promise<Dictionary<GemJoinType>> {
  const res: Dictionary<GemJoinType> = {};

  for (let [name, gem] of Object.entries(gems)) {
    const join = (await deployContract(sender, GemJoin, [oasis.address, gem.address])) as GemJoinType;
    res[name] = join;
  }

  return res;
}

export function deployOasisHelper(sender: Wallet): Promise<OasisHelperType> {
  return deployContract(sender, OasisHelper) as any;
}

export function deployOasis(sender: Wallet): Promise<OasisType> {
  return deployContract(sender, Oasis) as any;
}

export function sumGemJoinBalance(oasis: OasisType, gem: GemJoinType, usr: string) {
  return oasis.gems(gem.address, usr);
}

export async function cancel(oasis: OasisType, marketId: BigNumber, id: number) {
  try {
    await oasis.cancel(marketId, true, id, TX_DEFAULTS);
  } catch {
    await oasis.cancel(marketId, false, id, TX_DEFAULTS);
  }
}

export async function update(
  oasis: OasisType,
  marketId: BigNumber,
  id: number,
  amount: number,
  price: BigNumber,
  pos: number,
) {
  try {
    await oasis.update(marketId, true, id, amount, price, pos);
  } catch {
    await oasis.update(marketId, false, id, amount, price, pos);
  }
}

export interface OfferModel {
  id: BigNumber;
  baseAmt: BigNumber;
  price: BigNumber;
  owner: string;
}