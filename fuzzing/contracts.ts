import { Wallet } from "ethers";
import { BigNumber } from "ethers/utils";

import { Oasis as OasisType } from "../types/ethers-contracts/Oasis";
import { OasisHelper as OasisHelperType } from "../types/ethers-contracts/OasisHelper";
import { DsToken as DsTokenBaseType } from "../types/ethers-contracts/DSTokenBase";
import { GemJoin as GemJoinType } from "../types/ethers-contracts/GemJoin";
import { deployContract } from "ethereum-waffle";
import { q18, UINT_256_MAX } from "./utils";

const Oasis = require("../waffle_out/Oasis.json");
const OasisHelper = require("../waffle_out/OasisHelper.json");
const DSTokenBase = require("../waffle_out/DSTokenBase.json");
const GemJoin = require("../waffle_out/GemJoin.json");

export const TX_DEFAULTS = {
  gasLimit: 5000000,
};

export async function deployGems(sender: Wallet, gemsNo: number): Promise<DsTokenBaseType[]> {
  const res: DsTokenType[] = [];

  for (let i = 0; i < gemsNo; i++) {
    const c = (await deployContract(sender, DSTokenBase, [UINT_256_MAX])) as DsTokenBaseType;
    res.push(c as any);
  }

  return res;
}

export async function deployGemJoins(
  sender: Wallet,
  oasis: OasisType,
  gems: DsTokenBaseType[],
): Promise<GemJoinType[]> {
  const res: GemJoinType[] = [];

  for (let gem of gems) {
    const join = (await deployContract(sender, GemJoin, [oasis.address, gem.address])) as GemJoinType;
    await gem.approve(join.address, q18(q18(5000)));
    await join.join(sender.address, q18(q18(5000)), TX_DEFAULTS);

    res.push(join);
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
