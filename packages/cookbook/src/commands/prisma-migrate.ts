import { cwd, exit, platform } from 'node:process'
import { defineCookbookCommand } from '@milkio/cookbook-command'
import { selectProject } from '../utils/select-project'
import consola from 'consola'
import { $ } from 'bun'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { exists } from 'node:fs/promises'

export default await defineCookbookCommand(async (utils) => {
    const cookbookToml = await utils.getCookbookToml()
    const project = await selectProject(cookbookToml, async (project) => await exists(join(cwd(), 'projects', project.value, 'prisma')))
    if (!project) exit(0)
    const command = `${cookbookToml.general.packageManager} run prisma ${project?.prismaMigrateMode === 'push' ? 'db push' : 'migrate dev'}`
    consola.start(join(project.path), command)
    execFileSync(platform === 'win32' ? "powershell.exe" : "bash", ["-c", command], {
      shell: true,
      stdio: 'inherit',
      cwd: project.path
    });
    exit(0)
})