import { createMockProvider, getWallets } from "ethereum-waffle";
import fc from "fast-check";
import { assert } from "ts-essentials";
import { expect } from "chai";
import { utils } from "ethers";

import { Oasis } from "../types/ethers-contracts/Oasis";
import { DsTokenBase } from "../types/ethers-contracts/DSTokenBase";
import { GemJoin } from "../types/ethers-contracts/GemJoin";

import { deployOasisHelper, deployOasis, deployGemJoins, deployGems, TX_DEFAULTS, tokenNames } from "./contracts";
import { Dictionary } from "lodash";
import { q18 } from "./utils";

async function main() {
  console.log("Fuzzing...");

  let provider = createMockProvider();
  let [sender, ...users] = getWallets(provider);
  const oasisHelper = await deployOasisHelper(sender);
  const gems = await deployGems(sender);

  const allCommands = [
    fc
      .record({
        tokens: fc.shuffledSubarray(tokenNames, 1, 2),
        dust: fc.nat(),
        tic: fc.nat(),
      })
      .map(r => new AddMarketCmd(r.tokens[0], r.tokens[0], r.dust, r.tic)),
    fc
      .record({
        gem: fc.shuffledSubarray(tokenNames, 1, 1),
        user: fc.shuffledSubarray(users, 1, 1),
        amt: fc.nat(),
      })
      .map(r => new JoinGemCmd(r.gem[0], r.user[0].address, r.amt)),
  ];

  await fc.assert(
    fc.asyncProperty(fc.commands(allCommands), async cmds => {
      console.log((cmds as any).commands.map(c => c.toString()));
      const oasis = await deployOasis(sender);
      const gemJoins = await deployGemJoins(sender, oasis, gems);

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
          },
        };
      };
      await fc.asyncModelRun<Model, Runtime, true, Model>(setup, cmds);
    }),
    { verbose: true, numRuns: 1000, endOnFailure: true  },
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
    await r.oasis.addMarket(
      r.gemJoins[this.base].address,
      r.gemJoins[this.quote].address,
      this.dust,
      this.tic,
      TX_DEFAULTS,
    );

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
    const gemJoin = r.gemJoins[this.gem];
    await r.gems[this.gem].approve(gemJoin.address, this.amount, TX_DEFAULTS);
    await gemJoin.join(this.user, this.amount, TX_DEFAULTS);

    if (m.internalBalances[this.gem] === undefined) {
      m.internalBalances[this.gem] = {};
    }
    m.internalBalances[this.gem][this.user] = (m.internalBalances[this.gem][this.user] ?? 0) + this.amount;

    // @todo invariant
  }

  toString(): string {
    return `joinGem(${JSON.stringify([this.gem, this.user, this.amount])})`;
  }
}

class LimitOrderCmd implements OasisCmd {
  constructor(readonly quote: string, readonly base: string, readonly amount: number) {}

  check(): boolean {
    return true;
  }

  async run(m: Model, r: Runtime): Promise<void> {
    const quoteJoin = r.gemJoins[this.quote];
    const baseJoin = r.gemJoins[this.base];

    

    // await r.gems[this.gem].approve(gemJoin.address, this.amount, TX_DEFAULTS);
    // await gemJoin.join(this.user, this.amount, TX_DEFAULTS);

    // if (m.internalBalances[this.gem] === undefined) {
    //   m.internalBalances[this.gem] = {};
    // }
    // m.internalBalances[this.gem][this.user] = (m.internalBalances[this.gem][this.user] ?? 0) + this.amount;

    // @todo invariant
  }

  toString(): string {
    return `limitOrder(${JSON.stringify([this.quote, this.base, this.amount])})`;
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
