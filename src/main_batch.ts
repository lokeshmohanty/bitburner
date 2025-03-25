import { NS } from "@ns";

enum Action {
  hack = "hack",
  grow = "grow",
  weak = "weaken",
}
enum Scripts {
  hack = "temp/hack.js",
  grow = "temp/grow.js",
  weak = "temp/weaken.js",
}

enum File {
  serverMap = 'server-map.json',
  serverParent = 'server-parent.json'
}

type ServerDetails = { 
  hackingLevel: number,  
  ports: number,
  maxMoney: number,
  threads: { [key in Action]: number },
  ram: number,
  isNuked: boolean
}

function Executor(ns: NS, serverMap: Record<string, ServerDetails>) { 
  let threads = 0
  let minRam = 1.75
  const hosts: Record<string, number> = {}

  for (const [k, v] of Object.entries(serverMap)) {
    if (v.isNuked && v.ram > minRam) {
      hosts[k] = Math.floor(v.ram / minRam)
      threads += hosts[k]
    }
  }
  ns.print("Available threads: ", threads)
  ns.print("Available hosts: ")
  ns.print(hosts)

  return {
    threads,
    hosts,
    async run(script: Scripts, threads: number, scriptTime: number, waitTime: number, scriptArgs: string) {
      const hosts: Record<string, number> = {}

      let reqThreads = threads
      for (const [k, v] of Object.entries(this.hosts)) {
        hosts[k] = reqThreads > v ? v : v - reqThreads
        this.hosts[k] -= hosts[k]
      }
      this.threads -= threads
      ns.print("Hosts being used for current script: ", hosts)

      // TODO: don't hold the threads during wait time
      await ns.asleep(waitTime)
      for (const [k, v] of Object.entries(hosts)) {
        ns.exec(script, k, v, scriptArgs)
      }
      await ns.asleep(scriptTime)

      for (const [k, v] of Object.entries(hosts)) {
        this.hosts[k] += v
      }
      this.threads += threads
    },
  }
}

export async function main(ns: NS): Promise<void> {
  const nocache = ns.args[0] as boolean
  const serverMap = JSON.parse(ns.read(File.serverMap))
  const bestServers = Object.entries(serverMap).sort(([_, a], [_, b]) => a.maxMoney - b.maxMoney)
  const target = bestServers.pop()[0]
  ns.print(`Target server to hack: ${target}`)

  ns.ui.openTail()
  const executor = Executor(ns, serverMap)

  await initServer(ns, executor, target, nocache)
  await hackLoop(ns, executor, target)
}

async function hackLoop(ns: NS, executor: any, target: string): Promise<void> {
  const maxMoney = ns.getServerMaxMoney(target)

  const hackThreads = Math.floor(ns.hackAnalyzeThreads(target, 0.3 * maxMoney))
  const hackSec = ns.hackAnalyzeSecurity(hackThreads, target)
  const hackTime = ns.getHackTime(target)

  const growThreads = 3 + Math.ceil(ns.growthAnalyze(target, 1 / (1 - 0.3)))
  const growSec = ns.growthAnalyzeSecurity(growThreads, target)
  const growTime = ns.getGrowTime(target)

  const weakThreads = 3 + Math.ceil((hackSec + growSec) / ns.weakenAnalyze(1))
  const weakTime = ns.getWeakenTime(target)

  const maxTime = 100 + Math.max(hackTime, growTime, weakTime)

  const threadsPerBatch = hackThreads + growThreads + weakThreads

  for (let i = 0; i < 100 && executor.threads; i++) {
    if (threadsPerBatch > executor.threads) break;
    ns.print(`Executing batch ${i} on ${target}`)
    ns.print(`Stats: `)
    ns.print(`       hackThreads: ${hackThreads}`)
    ns.print(`       growThreads: ${growThreads}`)
    ns.print(`       weakThreads: ${weakThreads}`)
    ns.print(`          hackTime: ${hackTime}`)
    ns.print(`          growTime: ${growTime}`)
    ns.print(`          weakTime: ${weakTime}`)
    ns.print(`           maxTime: ${maxTime}`)
    executor.run(Scripts.hack, hackThreads, hackTime, maxTime - hackTime - 200, target)
    executor.run(Scripts.grow, growThreads, growTime, maxTime - growTime - 100, target)
    executor.run(Scripts.weak, weakThreads, weakTime, maxTime - weakTime      , target)
    await ns.asleep(100)
  }
}

async function initServer(ns: NS, executor: any, target: string, nocache: boolean) {
  ns.print(`Initialize Server: ${target}`)
  if (nocache) {
    ns.print(`Copy Scripts to ${target}`)
    genScript(ns, Action.weak)
    genScript(ns, Action.grow)
    genScript(ns, Action.hack)
  }
  const maxMoney = ns.getServerMaxMoney(target)
  const currMoney = ns.getServerMoneyAvailable(target)
  const minSecurity = ns.getServerMinSecurityLevel(target)
  const currSecurity = ns.getServerSecurityLevel(target)

  const growMultiplier = maxMoney / currMoney
  const weakenAmount = currSecurity - minSecurity

  const growTime = ns.getGrowTime(target)
  const growThreads = Math.ceil(ns.growthAnalyze(target, growMultiplier))
  const growSec = ns.growthAnalyzeSecurity(growThreads, target)

  const weakTime = ns.getWeakenTime(target)
  const weakThreads = Math.ceil((weakenAmount + growSec) / ns.weakenAnalyze(1))

  const maxTime = 100 + Math.max(growTime, weakTime)

  ns.print(`Max Money and Min Security on ${target}`)
  ns.print(`Stats: `)
  ns.print(`       growThreads: ${growThreads}`)
  ns.print(`       weakThreads: ${weakThreads}`)
  ns.print(`          growTime: ${growTime}`)
  ns.print(`          weakTime: ${weakTime}`)
  ns.print(`           maxTime: ${maxTime}`)
  executor.run(Scripts.grow, growThreads, growTime, maxTime - growTime - 100, target)
  executor.run(Scripts.weak, weakThreads, weakTime, maxTime - weakTime      , target)
  await ns.asleep(maxTime)
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



