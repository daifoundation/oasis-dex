import { utils } from "ethers";

export function isSorted(arr: Array<any>): boolean {
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] > arr[i + 1]) {
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
