import { createMockProvider, getWallets } from "ethereum-waffle";
import fc from "fast-check";
import { assert } from "ts-essentials";
import { expect } from "chai";
import { utils } from "ethers";

import { Oasis } from "../types/ethers-contracts/Oasis";
import { DsTokenBase } from "../types/ethers-contracts/DSTokenBase";
import { GemJoin } from "../types/ethers-contracts/GemJoin";

import {
  deployOasisHelper,
  deployOasis,
  deployGemJoins,
  deployGems,
  TX_DEFAULTS,
  sumGemJoinBalance,
  cancel,
  update,
} from "./contracts";
import { RandomMarkets, RandomActionResult } from "./arbitraries";
import { GEMS_NO } from "./constants";
import { areOffersSorted, offersNotCrossed, noDusts, orderbookSum } from "./invariants";
import { omit, Dictionary } from "lodash";

async function main() {
  console.log("Fuzzing...");

  let provider = createMockProvider();
  let [sender, ...users] = getWallets(provider);
  const oasisHelper = await deployOasisHelper(sender);
  const gems = await deployGems(sender, 10);

  const allCommands = [
    fc
      .record({
        base: fc.shuffledSubarray(gems, 1, 1),
        quote: fc.shuffledSubarray(gems, 1, 1),
        dust: fc.nat(),
        tic: fc.nat(),
      })
      .map(r => new AddMarketCmd(r.base[0].address, r.quote[0].address, r.dust, r.tic)),
    fc
      .record({
        gem: fc.shuffledSubarray(gems, 1, 1),
        user: fc.shuffledSubarray(users, 1, 1),
        amt: fc.nat(),
      })
      .map(r => new JoinGemCmd(r.gem[0].address, r.user[0].address, r.amt)),
  ];

  await fc.assert(
    fc.asyncProperty(fc.commands(allCommands), async cmds => {
      const oasis = await deployOasis(sender);
      const gemJoins = deployGemJoins(sender, oasis, gems);

      const setup = () => {
        return {
          model: {
            internalBalances: {},
            markets: [],
          },
          real: {
            oasis,
            gems,
            gemJoins,
          }
        };
      };
      fc.modelRun<Model, Runtime, Model>(setup, cmds);
    }),
    { verbose: true, numRuns: 1000 },
  );
}

type Runtime = {
  oasis: Oasis;
  gems: Dictionary<DsTokenBase>;
  gemJoins: Dictionary<GemJoin>;
};

interface Model {
  internalBalances: Dictionary<Dictionary<number>>; // ie. joined gems but not on the orderbook
  markets: Market[];
}

interface Market {
  base: string;
  quote: string;
  dust: number;
  tic: number;

  buys: Order[];
  sells: Order[];
}

interface Order {
  id: number;
  amt: number;
  price: number;
}

type OasisCmd = fc.Command<Model, Runtime>;

class AddMarketCmd implements OasisCmd {
  constructor(readonly base: string, readonly quote: string, readonly dust: number, readonly tic: number) {}

  check(m: Readonly<Model>) {
    return !m.markets.some(
      m => m.quote === this.quote && m.base === this.base && m.dust === this.dust && m.tic === this.tic,
    );
  }

  async run(m: Model, r: Runtime): Promise<void> {
    await r.oasis.addMarket(this.base, this.quote, this.dust, this.tic, TX_DEFAULTS);

    m.markets.push({ base: this.base, quote: this.quote, dust: this.dust, tic: this.tic, buys: [], sells: [] });

    // @todo invariant
  }
  toString(): string {
    return `addMarket(${JSON.stringify({ base: this.base, quote: this.quote, dust: this.dust, tic: this.tic })})`;
  }
}

class JoinGemCmd implements OasisCmd {
  constructor(readonly gem: string, readonly user: string, readonly amount: number) {}

  check(): boolean {
    return true;
  }

  async run(m: Model, r: Runtime): Promise<void> {
    await r.gemJoins[this.gem].join(this.user, this.amount, TX_DEFAULTS);

    m.internalBalances[this.gem][this.user] = (m.internalBalances[this.gem][this.user] ?? 0) + this.amount;

    // @todo invariant
  }

  toString(): string {
    return `joinGem(${(this.gem, this.user, this.amount)})`;
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
