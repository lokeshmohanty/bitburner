import { NS } from "@ns";

enum Action {
  hack = "hack",
  grow = "grow",
  weaken = "weaken",
}

function genScript(ns: NS, action: Action): void {
  const data = `
    export async function main(ns) {
      const target = ns.args[0]
      await ns.${action}(target)
    }
  `;
  ns.write(`temp/${action}.js`, data, 'w')
}

export async function main(ns: NS): Promise<void> {
  const target = ns.args[0] as string
  const maxMoney = ns.getServerMaxMoney(target)
  const currMoney = ns.getServerMoneyAvailable(target)
  const minSecurity = ns.getServerMinSecurityLevel(target)
  const currSecurity = ns.getServerSecurityLevel(target)

  genScript(ns, Action.weaken)
  genScript(ns, Action.grow)
  genScript(ns, Action.hack)

  const hackTime = ns.getHackTime(target) / (1000*60)
  const hackThreads = ns.hackAnalyzeThreads(target, 0.3 * maxMoney)
  const hackSec = ns.hackAnalyzeSecurity(hackThreads, target)

  const weakTime = ns.getWeakenTime(target) / (1000*60)
  const weakThreads = Math.floor(hackSec / ns.weakenAnalyze(1))

  const growTime = ns.getGrowTime(target) / (1000*60)
  const growThreads = ns.growthAnalyze(target, 1/(1-0.3))
  const growSec = ns.growthAnalyzeSecurity(growThreads, target)

  const weakTimeG = ns.getWeakenTime(target) / (1000*60)
  const weakThreadsG = Math.floor(growSec / ns.weakenAnalyze(1))

  ns.tprint({
    target,
    maxMoney,
    currMoney,
    minSecurity,
    currSecurity,
    hackTime,
    hackThreads,
    hackSec,
    weakTime,
    weakThreads,
    growTime,
    growThreads,
    growSec,
    weakTimeG,
    weakThreadsG
  })
}



