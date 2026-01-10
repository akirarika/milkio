export const mainPackage = "milkio" as const;
export const childPackages = [
  // 这些包将会被发布，不在列表中的包不会被发布
  "cookbook",
  "create-cookbook",
  "milkio-electron",
  "cookbook-command",
  "milkio-astra",
  "milkio-redis",
  "milkio-stargate",
  "milkio-stargate-worker",
  "vite-plugin-milkio",
  "template-milkio",
  "template-cookbook",
] as const;

// 直接build dist让后publish的包
export const distPackages = [
  "milkio",
  "cookbook-command",
  "milkio-astra",
  "milkio-redis",
  "milkio-stargate",
  "milkio-stargate-worker",
  "vite-plugin-milkio",
] as const;

export const templatePackages = ["template-milkio", "template-cookbook"] as const;

export const directPackages = ["cookbook", "create-cookbook", "milkio-electron"] as const;

export type ChildPackage = (typeof childPackages)[number];
export type DistPackage = (typeof distPackages)[number];
export type TemplatePackage = (typeof templatePackages)[number];
export type DirectPackage = (typeof directPackages)[number];
