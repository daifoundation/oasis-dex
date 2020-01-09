import fc from "fast-check";
import { BigNumber } from "ethers/utils";

export interface OfferModel {
  id: BigNumber;
  baseAmt: BigNumber;
  price: BigNumber;
  owner: string;
}

class LimitOrderCmd implements fc.Command<OfferModel, List> {
  constructor(readonly value: number) {}
  check = (m: Readonly<Model>) => true;
  run(m: Model, r: List): void {
    r.push(this.value); // impact the system
    ++m.num; // impact the model
  }
  toString = () => `push(${this.value})`;
}
