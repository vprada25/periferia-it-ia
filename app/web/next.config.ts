import type { NextConfig } from "next"

const config: NextConfig = {
  // The shared contracts package ships TypeScript sources.
  transpilePackages: ["@oc/contracts"],
  poweredByHeader: false,
  agentRules: false,
  async rewrites() {
    return [{ source: "/.well-known/agent-card.json", destination: "/a2a/agent-card" }]
  },
}

export default config
