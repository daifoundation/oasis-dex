import { createMockProvider, getWallets } from "ethereum-waffle";
import fc from "fast-check";
import { assert } from "ts-essentials";
import { expect } from "chai";
import { utils, Wallet } from "ethers";

import { Oasis } from "../types/ethers-contracts/Oasis";
import { DsTokenBase } from "../types/ethers-contracts/DSTokenBase";
import { GemJoin } from "../types/ethers-contracts/GemJoin";

import { deployOasisHelper, deployOasis, deployGemJoins, deployGems, TX_DEFAULTS, tokenNames } from "./contracts";
import { Dictionary } from "lodash";
import { q18 } from "./utils";
import { LimitOrderCmd, AddMarketCmd, JoinGemCmd, Model, Runtime, CancelOrderCmd } from "./commands";

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
        tic: fc.constant(100),
      })
      .map(r => new AddMarketCmd(r.tokens[0], r.tokens[0], r.dust, r.tic)),
    fc
      .record({
        gem: fc.shuffledSubarray(tokenNames, 1, 1),
        user: fc.shuffledSubarray(users, 1, 1),
        amt: fc.nat(),
      })
      .map(r => new JoinGemCmd(r.gem[0], r.user[0].address, r.amt)),
    fc
      .record({
        user: fc.shuffledSubarray(users, 1, 1),
        markedId: fc.nat(5),
        amount: fc.nat(),
        price: fc.nat(),
        buying: fc.boolean(),
        pos: fc.nat(),
      })
      .map(r => new LimitOrderCmd(r.user[0], r.markedId, r.amount, r.price, r.buying, r.pos)),
    fc
      .record({
        user: fc.shuffledSubarray(users, 1, 1),
        orderId: fc.nat(),
      })
      .map(r => new CancelOrderCmd(r.user[0], r.orderId)),
  ];

  await fc.assert(
    fc.asyncProperty(fc.commands(allCommands), async cmds => {
      console.log((cmds as any).commands.map(c => c.toString()));
      const oasis = await deployOasis(sender);
      const oasisHelper = await deployOasisHelper(sender);
      const gemJoins = await deployGemJoins(sender, oasis, gems);

      const setup = () => {
        return {
          model: {
            orderLastId: 1,
            internalBalances: {},
            markets: [],
            orders: {},
          },
          real: {
            oasis,
            oasisHelper,
            gems,
            gemJoins,
          },
        };
      };
      await fc.asyncModelRun<Model, Runtime, true, Model>(setup, cmds);
    }),
    { verbose: true, numRuns: 1000, endOnFailure: true },
  );
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
