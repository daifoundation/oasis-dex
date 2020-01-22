import fc from "fast-check";
import { Dictionary } from "lodash";
import { Wallet } from "ethers";

import { Oasis } from "../types/ethers-contracts/Oasis";
import { DsTokenBase } from "../types/ethers-contracts/DSTokenBase";
import { GemJoin } from "../types/ethers-contracts/GemJoin";
import { TX_DEFAULTS } from "./contracts";
import { q18 } from "./utils";
import { OasisHelper } from "../types/ethers-contracts/OasisHelper";

// for debug purposes only, tracks which commands really were executed
export let RUN: string[] = [];
export function resetRUN() {
  RUN = [];
}

export type Runtime = {
  oasis: Oasis;
  oasisHelper: OasisHelper;
  gems: Dictionary<DsTokenBase>;
  gemJoins: Dictionary<GemJoin>;
};

export interface Model {
  orderLastId: number;
  internalBalances: Dictionary<Dictionary<number>>; // ie. joined gems but not on the orderbook
  markets: Market[];
  orders: Dictionary<{ id: number; marketId: string; buying: boolean; amt: number; price: number }>;
}

interface Market {
  base: string;
  quote: string;
  dust: number;
  tic: number;
  id: string;

  buys: Order[];
  sells: Order[];
}

interface Order {
  id: number;
  amt: number;
  price: number;
}

type OasisCmd = fc.Command<Model, Runtime>;

export class AddMarketCmd implements OasisCmd {
  constructor(readonly base: string, readonly quote: string, readonly dust: number, readonly tic: number) {}

  check(m: Readonly<Model>) {
    return !m.markets.some(
      m => m.quote === this.quote && m.base === this.base && m.dust === this.dust && m.tic === this.tic,
    );
  }

  async run(m: Model, r: Runtime): Promise<void> {
    RUN.push(this.toString());
    await r.oasis.addMarket(
      r.gemJoins[this.base].address,
      r.gemJoins[this.quote].address,
      this.dust,
      this.tic,
      TX_DEFAULTS,
    );

    const id = await r.oasis.getMarketId(
      r.gemJoins[this.base].address,
      r.gemJoins[this.quote].address,
      this.dust,
      this.tic,
    );

    m.markets.push({
      base: this.base,
      quote: this.quote,
      dust: this.dust,
      tic: this.tic,
      buys: [],
      sells: [],
      id: id.toHexString(),
    });
  }
  toString(): string {
    return `addMarket(${JSON.stringify({ base: this.base, quote: this.quote, dust: this.dust, tic: this.tic })})`;
  }
}

export class JoinGemCmd implements OasisCmd {
  constructor(readonly gem: string, readonly user: string, readonly amount: number) {}

  check(): boolean {
    return true;
  }

  async run(m: Model, r: Runtime): Promise<void> {
    RUN.push(this.toString());
    const gemJoin = r.gemJoins[this.gem];
    await r.gems[this.gem].approve(gemJoin.address, this.amount, TX_DEFAULTS);
    await gemJoin.join(this.user, this.amount, TX_DEFAULTS);

    if (m.internalBalances[this.gem] === undefined) {
      m.internalBalances[this.gem] = {};
    }
    m.internalBalances[this.gem][this.user] = (m.internalBalances[this.gem][this.user] ?? 0) + this.amount;
  }

  toString(): string {
    return `joinGem(${JSON.stringify([this.gem, this.user, this.amount])})`;
  }
}

export class LimitOrderCmd implements OasisCmd {
  constructor(
    readonly user: Wallet,
    readonly markedId: number,
    readonly amountFreq: number,
    readonly price: number,
    readonly buying: boolean,
    readonly pos: number,
  ) {}

  check(m: Model): boolean {
    if (this.price === 0) {
      return;
    }

    const market = m.markets[m.markets.length % this.markedId];

    if (!market) {
      return false;
    }

    if (this.buying) {
      if (!m.internalBalances[market.quote]?.[this.user.address]) {
        return false;
      }
    } else {
      if (!m.internalBalances[market.base]?.[this.user.address]) {
        return false;
      }
    }

    const amt = this.getAmt(m, market);
    return this.price * amt > market.dust;
  }

  async run(m: Model, r: Runtime): Promise<void> {
    RUN.push(this.toString());
    const market = m.markets[m.markets.length % this.markedId];

    const amt = this.getAmt(m, market);

    await r.oasis.connect(this.user).limit(market.id, amt, q18(this.price), this.buying, this.pos, { ...TX_DEFAULTS });
    const id = m.orderLastId++;

    const orderList = this.buying ? market.buys : market.sells;
    orderList.push({
      id,
      amt,
      price: this.price,
    });
    m.orders[id] = {
      id,
      marketId: market.id,
      buying: this.buying,
      amt,
      price: this.price,
    };
  }

  toString(): string {
    return `limitOrder(${JSON.stringify([
      this.user.address,
      this.markedId,
      this.amountFreq,
      this.price,
      this.buying,
      this.pos,
    ])})`;
  }

  private getAmt(m: Model, market: Market): number { 
    if (this.buying) {
      const quote = m.internalBalances[market.quote]?.[this.user.address];
      return Math.floor(quote * this.amountFreq / this.price);
    } else {
      const base = m.internalBalances[market.base]?.[this.user.address]
      return Math.floor(base * this.amountFreq);
    }
  }
}

export class CancelOrderCmd implements OasisCmd {
  constructor(readonly user: Wallet, readonly orderId: number) {}

  check(m: Model): boolean {
    return !!m.orders[this.orderId];
  }

  async run(m: Model, r: Runtime): Promise<void> {
    RUN.push(this.toString());
    const order = m.orders[this.orderId];

    await r.oasis.connect(this.user).cancel(order.marketId, order.buying, order.id, { ...TX_DEFAULTS });
  }

  toString(): string {
    return `cancel(${JSON.stringify([this.user.address, this.orderId])})`;
  }
}
