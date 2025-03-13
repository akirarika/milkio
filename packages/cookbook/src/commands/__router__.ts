export const __router__ = [
  {
    commands: ["dev"],
    script: () => import("./dev.ts"),
  },
  {
    commands: ["init"],
    script: () => import("./init.ts"),
  },
  {
    commands: ["upgrade", "up"],
    script: () => import("./upgrade.ts"),
  },
  {
    commands: ["git:commit", "gc"],
    script: () => import("./git-commit.ts"),
  },
]