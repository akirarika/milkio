export const __router__ = [
  {
    commands: ["dev"],
    script: () => import("./dev.ts"),
  },
  {
    commands: ["git:commit", "gc"],
    script: () => import("./git-commit.ts"),
  },
  {
    commands: ["git:pull", "gp"],
    script: () => import("./git-pull.ts"),
  },
  {
    commands: ["prisma:migrate"],
    script: () => import("./prisma-migrate.ts"),
  },
  {
    hidden: true,
    commands: ["init"],
    script: () => import("./init.ts"),
  },
  {
    hidden: true,
    commands: ["install", "i"],
    script: () => import("./install.ts"),
  },
  {
    hidden: true,
    commands: ["upgrade", "up"],
    script: () => import("./upgrade.ts"),
  },
  {
    hidden: true,
    commands: ["version"],
    script: () => import("./version.ts"),
  },
]