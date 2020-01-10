import { utils } from "ethers";

export function isSorted(arr: Array<utils.BigNumber>, order: Order): boolean {
  for (let i = 0; i < arr.length - 1; i++) {
    const sorted = order == "desc" ? arr[i].gte(arr[i + 1]) : arr[i].lte(arr[i + 1]);
    
    if (!sorted) {
      return false;
    }
  }
  return true;
}

export const q18 = (n: number | utils.BigNumber) =>
  utils
    .bigNumberify(10)
    .pow(18)
    .mul(n);

export const UINT_256_MAX = utils.bigNumberify(2).pow(255);

export type Order = "asc" | "desc";

export function getLast<T>(arr: T[]): T | undefined {
  return arr[arr.length - 1];
}
