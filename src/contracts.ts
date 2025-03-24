import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
  // ns.codingcontract.createDummyContract(type)
  const cc = ns.codingcontract
  const types = cc.getContractTypes()
  ns.tprint(types)
  const contracts = ns.ls("home", ".cct")
  ns.tprint(contracts)
  for (const type of types) {
    const name = cc.createDummyContract(type)
    ns.tprint(cc.getContract(name))
  }
  for (const file of contracts) {
    ns.tprint(file)
    ns.rm(file)
  }
}
