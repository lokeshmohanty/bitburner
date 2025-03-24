import { NS } from "@ns";

enum file {
  serverMap = 'server-map.json',
  serverParent = 'server-parent.json'
}

enum commands {
  con = 'con',
  det = 'det',
  nuked = 'nuked',
}


export async function main(ns: NS): Promise<void> {
  const command = ns.args[0] as commands
  const target = ns.args[1] as string


  if (command === commands.con) {
    ns.tprint('Trying to connect to ', target)
    const serverParent = JSON.parse(ns.read(file.serverParent))
    if (!serverParent[target]) {
      ns.tprint(`${target} is not a valid server`)
      ns.exit()
    }
    const graph = [target]
    while (serverParent[graph[0]] != "home") {
      graph.unshift(serverParent[graph[0]])
    }
    ns.tprint('Server Path: ', graph)
    const connectString = graph.map(server => `connect ${server};`).join("")
    ns.tprint('ConnectString: ', connectString)

  } else if (command === commands.det) {
    const serverMap = JSON.parse(ns.read(file.serverMap))
    if (!serverMap[target]) {
      ns.tprint(`${target} is not a valid server`)
      ns.exit()
    }
    ns.tprint(serverMap[target])
    ns.tprint("============================")
    ns.tprint(ns.getServer(target))

  } else if (command === commands.nuked) {
    const serverMap = JSON.parse(ns.read(file.serverMap))
    ns.tprint(Object.keys(serverMap).filter(k => serverMap[k].isNuked))
  }
}

