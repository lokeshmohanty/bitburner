import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
  const N = ns.hacknet.maxNumNodes()
  let n = ns.hacknet.numNodes()
  const max = {
    level: 200,
    ram: 4,
    cores: 16,
  }
  const nodes = []
  for (let i = 0; i < n; i++) {
    nodes.push(ns.hacknet.getNodeStats(i))
  }
  ns.print("Nodes: ", nodes)
  ns.tprint("Nodes: ", n, " / ", N)

  let upgradeIndex = 0
  let upgradeCost = 0
  while (n < N) {
    let money = ns.getServerMoneyAvailable("home") / 2
    let nodesMoney = 0
    let nextNodePrice = ns.hacknet.getPurchaseNodeCost()
    while (money - nodesMoney > 3 * nextNodePrice) {
      ns.hacknet.purchaseNode()
      nextNodePrice = ns.hacknet.getPurchaseNodeCost()
      nodesMoney += nextNodePrice
      nodes.push(ns.hacknet.getNodeStats(nodes.length))
    }
    money -= nodesMoney
    for (let i = upgradeIndex; i < nodes.length; i++) {
      upgradeCost = ns.hacknet.getRamUpgradeCost(i)
      while (nodes[i].ram < max.ram && money > upgradeCost){
        ns.hacknet.upgradeRam(i)
        nodes[i].ram *= 2
        money -= upgradeCost
        upgradeCost = ns.hacknet.getRamUpgradeCost(i)
      }
      upgradeCost = ns.hacknet.getLevelUpgradeCost(i)
      while (nodes[i].level < max.level && money > upgradeCost) {
        ns.hacknet.upgradeLevel(i)
        nodes[i].level += 1
        money -= upgradeCost
        upgradeCost = ns.hacknet.getLevelUpgradeCost(i)
      }
      upgradeCost = ns.hacknet.getCoreUpgradeCost(i)
      while (nodes[i].cores < max.cores && money > upgradeCost) {
        ns.hacknet.upgradeCore(i)
        nodes[i].cores += 1
        money -= upgradeCost
        upgradeCost = ns.hacknet.getCoreUpgradeCost(i)
      }
      if (nodes[i].level == max.level && nodes[i].ram == max.ram && nodes[i].cores == max.cores) {
        upgradeIndex = i
      }
    }
    await ns.sleep(1000 * 60 * 10)
  }
}
