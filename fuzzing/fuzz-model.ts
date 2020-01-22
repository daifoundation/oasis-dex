import { createMockProvider, getWallets } from "ethereum-waffle";
import fc from "fast-check";
import { performance } from "perf_hooks";
import { assert } from "ts-essentials";
import { expect } from "chai";
import { utils, Wallet } from "ethers";

import { Oasis } from "../types/ethers-contracts/Oasis";
import { DsTokenBase } from "../types/ethers-contracts/DSTokenBase";
import { GemJoin } from "../types/ethers-contracts/GemJoin";

import { deployOasisHelper, deployOasis, deployGemJoins, deployGems, TX_DEFAULTS, tokenNames } from "./contracts";
import { Dictionary, times, constant } from "lodash";
import { q18 } from "./utils";
import { LimitOrderCmd, AddMarketCmd, JoinGemCmd, Model, Runtime, CancelOrderCmd, RUN, resetRUN } from "./commands";
import { checkInvariants } from "./invariants";

async function main() {
  console.log("Fuzzing...");

  let provider = createMockProvider();
  let [sender, ..._users] = getWallets(provider);
  const users = _users.slice(0, 2);
  const oasisHelper = await deployOasisHelper(sender);
  const gems = await deployGems(sender);

  const allCommands = [
    fc
      .record({
        tokens: fc.shuffledSubarray(tokenNames, 1, 2),
        dust: fc.nat(100),
        tic: fc.constant(100), // @todo real tic
      })
      .map(r => new AddMarketCmd(r.tokens[0], r.tokens[0], r.dust, r.tic)),
    fc
      .record({
        gem: fc.shuffledSubarray(tokenNames, 1, 1),
        user: fc.shuffledSubarray(users, 1, 1),
        amt: fc.nat(),
      })
      .map(r => new JoinGemCmd(r.gem[0], r.user[0].address, r.amt)),
    ...times(
      3,
      constant(
        fc
          .record({
            user: fc.shuffledSubarray(users, 1, 1),
            markedId: fc.nat(5),
            amountFreq: fc.float(1.0),
            priceFreq: fc.nat(),
            buying: fc.boolean(),
            pos: fc.nat(),
          })
          .map(r => new LimitOrderCmd(r.user[0], r.markedId, r.amountFreq, r.priceFreq, r.buying, r.pos)),
      ),
    ),
    fc
      .record({
        user: fc.shuffledSubarray(users, 1, 1),
        orderId: fc.nat(),
      })
      .map(r => new CancelOrderCmd(r.user[0], r.orderId)),
  ];

  await fc.assert(
    fc.asyncProperty(fc.commands(allCommands), async cmds => {
      // console.log(
      //   "Scheduled:",
      //   (cmds as any).commands.map(c => c.toString()),
      // );
      const t0 = performance.now();
      const oasis = await deployOasis(sender);
      const gemJoins = await deployGemJoins(sender, oasis, gems);

      resetRUN();
      const env: { model: Model; real: Runtime } = {
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
      await fc.asyncModelRun<Model, Runtime, true, Model>(() => env, cmds);
      console.log("Executed:", RUN);
      await checkInvariants(env.model, env.real);
      const executionTime = Math.ceil(performance.now() - t0);
      console.log("Took: ", executionTime, "ms");
      console.log("-----------------------------------------");
    }),
    { verbose: true, numRuns: 1_000_000, endOnFailure: true },
  );
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
