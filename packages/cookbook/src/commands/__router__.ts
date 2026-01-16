export const __router__ = [
  {
    commands: ["dev"],
    script: () => import("./dev.ts"),
  },
  {
    commands: ["drizzle"],
    script: () => import("./drizzle.ts"),
  },
  {
    hidden: true,
    commands: ["test"],
    script: () => import("./test.ts"),
  },
  {
    hidden: true,
    commands: ["create"],
    script: () => import("./create.ts"),
  },
  {
    hidden: true,
    commands: ["x", "dlx"],
    script: () => import("./download-and-execute.ts"),
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
    commands: ["upgrade", "up"],
    script: () => import("./upgrade.ts"),
  },
  {
    hidden: true,
    commands: ["version"],
    script: () => import("./version.ts"),
  },
  {
    hidden: true,
    commands: ["generate"],
    script: () => import("./generate.ts"),
  },
];
