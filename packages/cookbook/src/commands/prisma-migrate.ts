import { exit } from 'node:process'
import { defineCookbookCommand } from '@milkio/cookbook-command'
import { selectProject } from '../utils/select-project'
import consola from 'consola'
import { $ } from 'bun'
import { join } from 'node:path'

export default await defineCookbookCommand(async (utils) => {
    const cookbookToml = await utils.getCookbookToml()
    const project = await selectProject(cookbookToml)
    if (!project) exit(0)
    const command = `${cookbookToml.general.packageManager} run prisma ${project?.prismaMigrateMode === 'push' ? 'push' : 'migrate dev'}`
    consola.log(command)
    try {
        await $`${command}`
    } catch (error: any) {
        if (!(error?.stderr?.includes('command not found'))) throw error;
        consola.warn('Prisma CLI not detected! Let\'s fix this:');
        consola.log(`1. Add script to ${join(project.path, 'package.json')}:\n   "scripts": { "prisma": "prisma" }\n`);
        consola.log(`2. Install dependencies:\n   cd "${join(project.path, 'package.json')}"\n   ${cookbookToml.general.packageManager} i prisma @prisma/client\n`);
        consola.log(`3. If the project has not yet configured prisma, refer to the official prisma website to configure: https://www.prisma.io/docs/getting-started\n`);
        consola.log(`4. Try again.`);
        consola.warn('Prisma CLI not detected!');
    }
    exit(0)
})