import { existsSync, lstatSync, readdirSync, rmdirSync, unlinkSync } from "node:fs"
import path from "node:path"

export function removeDir(pathstr: string, skips: Array<string> = []) {
  if (!existsSync(pathstr)) return
  const files = readdirSync(pathstr)
  files.forEach((file) => {
    const dirname = path.resolve(pathstr, file)
    const stats = lstatSync(dirname)
    for (const skip of skips) {
      if (dirname.startsWith(skip)) return
    }
    if (stats.isDirectory()) {
      removeDir(dirname)
    } else {
      unlinkSync(dirname)
    }
  })
  try {
    rmdirSync(pathstr)
  } catch (error) {}
}
