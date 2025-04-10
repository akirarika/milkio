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
    commands: ["prisma"],
    script: () => import("./prisma.ts"),
  },
  {
    hidden: true,
    commands: ["init"],
    script: () => import("./init.ts"),
  },
  {
    hidden: true,
    commands: ["install", "i", "add"],
    script: () => import("./install.ts"),
  },
  {
    hidden: true,
    commands: ["uninstall", "remove", "rm"],
    script: () => import("./uninstall.ts"),
  },
  {
    hidden: true,
    commands: ["build"],
    script: () => import("./build.ts"),
  },
  {
    hidden: true,
    commands: ["version"],
    script: () => import("./version.ts"),
  },
];
