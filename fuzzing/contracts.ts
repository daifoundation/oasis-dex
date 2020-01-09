import { Wallet } from "ethers";

import { Oasis as OasisType } from "../types/ethers-contracts/Oasis";
import { OasisHelper as OasisHelperType } from "../types/ethers-contracts/OasisHelper";
import { DsTokenBase as DsTokenBaseType } from "../types/ethers-contracts/DSTokenBase";
import { GemJoin as GemJoinType } from "../types/ethers-contracts/GemJoin";
import { deployContract } from "ethereum-waffle";
import { q18, UINT_256_MAX } from "./utils";

const Oasis = require("../waffle_out/Oasis.json");
const OasisHelper = require("../waffle_out/OasisHelper.json");
const DSTokenBase = require("../waffle_out/DSTokenBase.json");
const GemJoin = require("../waffle_out/GemJoin.json");

export const TX_DEFAULTS = {
  gasLimit: 5000000,
}

export async function deployGems(sender: Wallet, gemsNo: number): Promise<DsTokenBaseType[]> {
  const res: DsTokenBaseType[] = [];

  for (let i = 0; i < gemsNo; i++) {
    const c = await deployContract(sender, DSTokenBase, [UINT_256_MAX]) as DsTokenBaseType;
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
    const c = await deployContract(sender, GemJoin, [oasis.address, gem.address]) as GemJoinType;
    await gem.approve(c.address, q18(q18(5000)));
    res.push(c);
  }

  return res;
}

export function deployOasisHelper(sender: Wallet): Promise<OasisHelperType> {
  return deployContract(sender, OasisHelper) as any;
}

export function deployOasis(sender: Wallet): Promise<OasisType> {
  return deployContract(sender, Oasis) as any;
}
