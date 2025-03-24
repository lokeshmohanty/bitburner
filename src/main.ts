import { NS } from "@ns";

type Action = "free" | "hack" | "grow" | "weaken"
type ServerDetails = { 
  hackingLevel: number,  
  ports: number,
  maxMoney: number,
  threads: { [key in Action]: number },
  ram: number,
  isNuked: boolean
}

enum file {
  serverMap = 'server-map.json',
  serverParent = 'server-parent.json'
}

const G = { 
  requiredRam: 1.75,
  findBestServer: true, 
  hackingLevel: 0,
  target: { name: "home", maxMoney: 0 },
  threads: { grow: 0, weaken: 0, hack: 0, free: 0 },
  ports: (ns: NS) => [
    ns.brutessh,
    ns.ftpcrack,
    ns.relaysmtp,
    ns.httpworm,
    ns.sqlinject,
  ],
  portPrograms: ["BruteSSH.exe", "FTPCrack.exe", "HTTPWorm.exe", "SQLInject.exe", "relaySMTP.exe"]
}
let serverMap: { [server: string]: ServerDetails } = {}
let serverParent: Record<string, string> = {}

export async function main(ns: NS): Promise<void> {
  for (const server of ns.scan()) {
    serverParent[server] = "home"
    await updateMap(ns, server)
  }
  ns.write(file.serverMap, JSON.stringify(serverMap), 'w')
  ns.write(file.serverParent, JSON.stringify(serverParent), 'w')
  ns.tprint("Scanned: ", Object.keys(serverMap))

  G.target = Object.entries(serverMap).reduce(
    (acc, [k, v]) => v.isNuked && acc.maxMoney < v.maxMoney ? { name: k, maxMoney: v.maxMoney } : acc, 
    G.target
  )

  // Store initiliazing values
  const values = { nuke: {}, buy: {}, hack: {} }
  let loops = 0
  while(true) {
    if (loops % 10 === 0) {
      await nukeServers(ns, values.nuke)
      await buyServers(ns, values.buy)
    }
    await hackServer(ns, values.hack)
    await ns.sleep(1000 * 60 * 1)
    loops += 1
  }
}

async function updateMap(ns: NS, server: string): Promise<void> {
  serverMap[server] = getServerDetails(ns, server)
  copyScripts(ns, server)
  ns.print("Server ", server, " with details ",  serverMap[server])
  const servers = ns.scan(server).filter(s => s != "home" && !serverMap[s])
  for (const newServer of servers) {
    await updateMap(ns, newServer)
    serverParent[newServer] = server
    await ns.sleep(100)
  }
}

/** @param {NS} ns */
async function buyServers(ns: NS, v: Record<string, any>): Promise<void> {
  if (Object.keys(v).length === 0) {
    v.maxServers = ns.getPurchasedServerLimit()
    v.maxRam = ns.getPurchasedServerMaxRam()
    v.servers = ns.getPurchasedServers()
    v.ram = (v.servers.length == 0) ? 64 : ns.getServerMaxRam(v.servers[0])
    v.cost = ns.getPurchasedServerCost(v.ram)
    v.serversToBuy = v.maxServers - v.servers.length
    v.money = 0
    v.upgradeIndex = 0
    ns.tprint("Servers to buy: ", v.serversToBuy)
  }

  if (v.serversToBuy > 0) {
    v.money = ns.getServerMoneyAvailable("home")
    const newServers = Math.min(Math.floor(v.money / v.cost), v.maxServers)
    while (newServers != 0) {
      const server = "server".concat(v.servers.length) 
      ns.tprint("Buying ", server, " with ram: ", v.ram)
      v.newServers -= 1
      v.servers.push(server)
      ns.purchaseServer(server, v.ram)
      copyScripts(ns, server)
      serverMap[server] = getServerDetails(ns, server)
      G.threads.free += serverMap[server].threads.free
      await ns.sleep(100)
    }

    ns.print("============= Buy Servers ================")
    ns.print("Servers: ", v.servers)
    ns.print("Ram: ", v.ram)

  } else if (v.ram < v.maxRam) {
    const upgradeFactor = (v.ram >= Math.pow(2, 10)) ? 2 : 4
    v.money = ns.getServerMoneyAvailable("home")
    v.cost = ns.getPurchasedServerUpgradeCost(v.servers[v.upgradeIndex], v.ram * upgradeFactor)
    let numUpgrade = Math.min(Math.floor(v.money / v.cost), v.maxServers - v.upgradeIndex)
    while (numUpgrade != 0) {
      const server = v.servers[v.upgradeIndex]
      ns.tprint("Upgrading ", server, " from ", v.ram, " to ", v.ram * upgradeFactor)
      numUpgrade -= 1
      v.upgradeIndex += 1
      ns.upgradePurchasedServer(server, v.ram * upgradeFactor)
      serverMap[server].ram = v.ram * upgradeFactor
      const prevThreads = Object.values(serverMap[server].threads).reduce((acc, v) => acc + v)
      serverMap[server].threads.free = prevThreads * (upgradeFactor - 1)
      G.threads.free += serverMap[server].threads.free
      await ns.sleep(100)
    }
    if (v.upgradeIndex == v.maxServers) {
      v.ram *= upgradeFactor
      v.upgradeIndex = 0
    }

    ns.print("============= Buy Servers ================")
    ns.print("Servers: ", v.servers)
    ns.print("Ram: ", v.ram)
    ns.print("Upgrade Index: ", v.upgradeIndex)
  }
}

async function execute(ns: NS, server: string, action: Action): Promise<void> {
  const target = G.target.name
  ns.print("Execute ", action, " on ", target, " from ", server)
  const threads = serverMap[server].threads
  let free = 0
  for (const key of Object.keys(threads)) {
    free += threads[key as Action]
    G.threads[key as Action] -= threads[key as Action]
    threads[key as Action] = 0
  }
  G.threads[action] += free
  threads[action] = free
  if (free == 0) return
  ns.killall(server)
  ns.exec("scripts/" + action + ".js", server, free, target)
  await ns.sleep(100)
}

async function hackServer(ns: NS, v: Record<string, any>): Promise<void> {
  if (Object.keys(v).length === 0) {
    const availableServers = Object.keys(serverMap).filter(server => serverMap[server].isNuked)
    let count = 0
    for (const server of availableServers){
      const script = count % 10 ? "grow" 
        : count % 3 ? "weaken" 
        : "hack";
      await execute(ns, server, script)
      count += 1
    }
    G.threads.free = Object.values(serverMap).reduce((acc, val) => acc + val.threads.free, 0)
    v.minSecurity = ns.getServerMinSecurityLevel(G.target.name)
    v.target = G.target.name
    v.maxMoney = G.target.maxMoney
    ns.tprint("   Server to hack: ", G.target.name)
    ns.tprint("         MaxMoney: ", G.target.maxMoney)
    ns.tprint("Available threads: ", G.threads.free)
    ns.tprint("Threads: Hack   -> ", G.threads.hack)
    ns.tprint("Threads: Grow   -> ", G.threads.grow)
    ns.tprint("Threads: Weaken -> ", G.threads.weaken)
  }
  const target = v.target
  const maxMoney = v.maxMoney
  const minSecurity = v.minSecurity
  
  if (G.threads.free) {
    const freeServers = Object.keys(serverMap).filter(server => serverMap[server].threads.free)
    let count = 0
    ns.print("FreeServers: ", freeServers)
    for (const server of freeServers) {
      const script = count % 10 ? "grow" 
        : count % 3 ? "weaken" 
        : "hack";
      await execute(ns, server, script)
      count += 1
    }
  }
  /*
  const security = ns.getServerSecurityLevel(target)
  if (security - minSecurity < 10) {
    const weakenServers = Object.keys(serverMap).filter(server => serverMap[server].threads.weaken)
    const weakenThreads = Math.floor(G.threads.weaken * 0.9)
    ns.print("Grow ", G.threads.weaken - weakenThreads, " threads from weaken")
    while(G.threads.weaken > weakenThreads){
      await execute(ns, weakenServers.pop(), "grow")
    }
  }
  const money = ns.getServerMoneyAvailable(target)
  if (money / maxMoney > 0.75 ) {
    const growServers = Object.keys(serverMap).filter(server => serverMap[server].threads.grow)
    const growThreads = Math.floor(G.threads.grow * 0.9)
    ns.print("Hack ", G.threads.grow - growThreads, " threads from grow")
    while(G.threads.grow > growThreads){
      await execute(ns, growServers.pop(), "hack")
    }
  }
  const hackChance = ns.hackAnalyzeChance(target)
  if (hackChance < 0.5) {
    const hackServers = Object.keys(serverMap).filter(server => serverMap[server].threads.hack)
    const hackThreads = Math.floor(G.threads.hack * 0.9)
    ns.print("Weaken ", G.threads.hack - hackThreads, " threads from hack")
    while(G.threads.hack > hackThreads){
      await execute(ns, hackServers.pop(), "weaken")
    }
  }
  */

  const security = ns.getServerSecurityLevel(target)
  const money = ns.getServerMoneyAvailable(target)
  const hackChance = ns.hackAnalyzeChance(target)
  ns.print("============= Hack Server ================")
  ns.print("   Money: ", money, " / ", maxMoney)
  ns.print("Security: ", security, " / ", minSecurity)
  ns.print("Hacking Chance: ", hackChance)
  ns.print("Threads: Hack   -> ", G.threads.hack)
  ns.print("Threads: Grow   -> ", G.threads.grow)
  ns.print("Threads: Weaken -> ", G.threads.weaken)
  ns.print("Threads: Free   -> ", G.threads.free)
}

async function nukeServers(ns: NS, v: Record<string, any>): Promise<void> {
  const unlockedPorts = G.portPrograms.reduce((acc, program) => acc + (ns.fileExists(program) ? 1 : 0), 0)
  if (Object.keys(v).length === 0) {
    v.nukesLeft = Object.values(serverMap).filter(v => !v.isNuked).length
  }
  if(v.nukesLeft != 0) {
    G.hackingLevel = ns.getHackingLevel()
    const toNuke = Object.keys(serverMap).filter(server =>
      !serverMap[server].isNuked &&
      serverMap[server].ports <= unlockedPorts &&
      serverMap[server].hackingLevel <= G.hackingLevel
    )
    for (const server of toNuke) {
      ns.print("Nuking  ", server)
      for (let i = 0; i < serverMap[server].ports; i++) G.ports(ns)[i](server)
      ns.nuke(server)
      serverMap[server].isNuked = true
      serverMap[server].threads.free = Math.floor(serverMap[server].ram / G.requiredRam)
      G.threads.free += serverMap[server].threads.free
      copyScripts(ns, server)
      if (G.findBestServer && serverMap[server].maxMoney > G.target.maxMoney) {
        G.target.name = server
        G.target.maxMoney = serverMap[server].maxMoney
      }
      v.nukesLeft -= 1
      await ns.sleep(100)
    }

    ns.print("============= Nuke Servers ================")
    ns.print("Servers left to be nuked: ", v.nukesLeft)
  }
}

function copyScripts(ns: NS, server: string): void {
  const scripts = ["scripts/hack.js", "scripts/grow.js", "scripts/weaken.js"]
  ns.tprint("Copy scripts ", scripts, " to server ", server)
  for (const script of scripts) {
    ns.scp(script, server)
  }
}

function getServerDetails(ns: NS, server: string): ServerDetails {
  const ram = ns.getServerMaxRam(server)
  const isNuked = ns.hasRootAccess(server)
  return {
    hackingLevel: ns.getServerRequiredHackingLevel(server),
    ports: ns.getServerNumPortsRequired(server),
    maxMoney: ns.getServerMaxMoney(server),
    threads: { grow: 0, weaken: 0, hack: 0, free: isNuked ? Math.floor(ram / G.requiredRam) : 0 },
    ram,
    isNuked,
  }
}
