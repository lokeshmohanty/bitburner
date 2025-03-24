import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
  const target: string = ns.args[0] as string
  while(true) {
    await ns.grow(target)
  }
}

