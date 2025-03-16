import os from 'node:os'
import { join } from 'node:path'
import { cwd } from 'node:process'
import { emitter } from '../emitter'
import type { CookbookOptions } from '../utils/cookbook-dto-types'
import { spawn, type ChildProcess } from 'node:child_process'
import { env } from 'bun'

const platform = os.platform()
export const workers = new Map<string, Worker>()

export interface Worker {
  key: string
  stdout: Array<[number, number, 'stdout' | 'stderr', string]>
  state: 'running' | 'stopped'
  connect: boolean
  kill: () => Promise<void>
  run: () => void
  testConnect: (timeout?: number) => Promise<{
    success: boolean;
    error?: string;
  }>
}

export async function initWorkers(options: CookbookOptions) {
  for (const projectName in options.projects) {
    const project = options.projects[projectName]
    const worker = createWorker(projectName, { command: project.start ?? [options.general.packageManager, 'run', 'dev'], max: 0, cwd: join(cwd(), 'projects', projectName), port: project.port, connectTestUrl: project?.connectTestUrl ?? (project.type !== 'milkio' ? `http://localhost:${project.port}/` : `http://localhost:${project.port}/generate_204`) })
    workers.set(projectName, worker)
    if (project.autoStart) setTimeout(() => worker.run(), (project.autoStartDelay ?? 0) * 1000);
  }
}

let stdoutIndex = 0;

export function createWorker(
  key: string,
  options: {
    command: string[]
    cwd?: string
    env?: NodeJS.ProcessEnv
    stdout?: 'pipe' | 'ignore'
    max?: number
    connectTestUrl?: string
    port?: number
  },
): Worker {
  const textDecoder = new TextDecoder()
  let spawnProcess: ChildProcess | null = null

  const handleExit = (code: number | null, signal: string) => {
    const message = 'Process exited with:' + (code ?? null)
    process.stdout.write(message)
    worker.stdout.push([stdoutIndex++, Date.now(), 'stdout', message])
    if (code !== 0 && options.stdout !== 'ignore' && options.max !== 0) {
      const message = `\n-- code: ${code ?? signal}\n`
      emitter.emit('data', { type: 'workers@stdout', key, chunk: message })
    }

    emitter.emit('data', { type: 'workers@state', key, state: 'stopped', code })
    worker.state = 'stopped'
  }

  const worker: Worker = {
    key,
    stdout: [],
    state: 'stopped',
    connect: false,
    kill: async () => {
      if (worker.state === 'stopped') return
      emitter.emit('data', { type: 'workers@state', key, state: 'stopped', code: 'kill' })
      if (!spawnProcess) return Promise.resolve()
      const message = `\n--------------------------------\n# Stop ${key}\n--------------------------------`
      worker.stdout.push([stdoutIndex++, Date.now(), 'stdout', message])
      emitter.emit('data', { type: 'workers@stdout', key, chunk: message })
      await new Promise((resolve) => {
        spawnProcess?.once('exit', () => resolve(undefined))
        try {
          spawnProcess?.kill('SIGINT')
        } catch (error) {
        }
      })
      worker.state = 'stopped'
    },
    run: () => {
      if (worker.state === 'running') return
      const message = `\n--------------------------------\n# Start ${key}\n--------------------------------`
      emitter.emit('data', { type: 'workers@stdout', key, chunk: message })
      worker.stdout.push([stdoutIndex++, Date.now(), 'stdout', message])
      try {
        spawnProcess = spawn(platform === 'win32' ? "powershell.exe" : "bash", ['-c', options.command.join(' ')], {
          cwd: options.cwd,
          env: { ...env, ...(options.env ?? {}), MILKIO_DEVELOP: "ENABLE" },
          stdio: [
            'ignore',
            options.stdout !== 'ignore' ? 'pipe' : 'ignore',
            'pipe'
          ]
        })

        const handleStreamError = (err: Error) => {
          console.error('Stream error:', err)
          handleExit(1, 'SIGERR')
        }

        const handleMessage = (chunk: ArrayBuffer) => {
          const str = textDecoder.decode(chunk)
          worker.stdout.push([stdoutIndex++, Date.now(), 'stdout', str])
          process.stdout.write(str)
          emitter.emit('data', { type: 'workers@stdout', key, chunk: str })
          if (worker.stdout.length >= (options.max ?? 1024 * 64)) {
            worker.stdout.splice(0, Math.ceil((options.max ?? 1024 * 64) * 0.2))
          }
        }

        const handleError = (chunk: ArrayBuffer) => {
          const str = textDecoder.decode(chunk)
          worker.stdout.push([stdoutIndex++, Date.now(), 'stderr', str])
          emitter.emit('data', { type: 'workers@stdout', key, chunk: str })
          if (worker.stdout.length >= (options.max ?? 1024 * 64)) {
            worker.stdout.splice(0, Math.ceil((options.max ?? 1024 * 64) * 0.2))
          }
        }

        if (spawnProcess.stdout) {
          spawnProcess.stdout
            .on('data', handleMessage)
            .on('error', handleStreamError)
        }
        if (spawnProcess.stderr) {
          spawnProcess.stderr
            .on('data', handleError)
            .on('error', handleStreamError)
        }
        spawnProcess
          .on('error', (err) => {
            console.error('Process error:', err)
            handleExit(null, 'SIGERR')
          })
          .on('exit', handleExit)

        emitter.emit('data', { type: 'workers@state', key, state: 'running', code: 'running' })
        worker.state = 'running'
      } catch (err) {
        console.error('Spawn error:', err)
        handleExit(1, 'SIGERR')
      }
    },
    testConnect: async (timeout?: number) => {
      const connectTestUrl = options.connectTestUrl
      if (!connectTestUrl) {
        worker.connect = false
        return {
          success: false,
          error: 'connectTestUrl is not defined',
        }
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout ?? 4096);
      try {
        const response = await fetch(connectTestUrl, {
          ...options,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (response.status >= 500) {
          worker.connect = false
          return {
            success: false,
            error: `The HTTP status code is ${response.status}.`,
          };
        }
        worker.connect = true
        return {
          success: true,
        };
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          worker.connect = false
          return {
            success: false,
            error: `The request timed out.`,
          };
        }
        worker.connect = false
        return {
          success: false,
          error: (error?.toString() ?? JSON.stringify(error)) || 'Unknown error',
        };
      }
    }
  }

  return worker
}

// export function createWorkers(key: string, options: { command: Array<string>, cwd: string, env?: Record<string, string>, stdout?: 'ignore' | 'pipe', max?: number }): Worker {
//   options.env = { ...env, ...options.env } as Record<string, string>
//   options.env.MILKIO_DEVELOP = 'ENABLE'

//   let firstRun = true

//   const worker: Worker = {
//     key,
//     stdout: [] as Array<string>,
//     state: 'stopped',
//     kill: async () => {
//       if (worker.state === 'stopped') return
//       firstRun = false
//       emitter.emit('data', { type: 'workers@state', key, state: 'stopped', code: 'kill' })
//       worker.state = 'stopped'
//       spawn.kill(1)
//       try {
//         spawn.kill(1)
//       }
//       catch (error) {}
//       try {
//         kill(spawn.pid, 'SIGINT')
//       }
//       catch (error) {}
//       await spawn.exited
//     },
//     run: () => {
//       if (worker.state === 'running') return
//       spawn = Bun.spawn(options.command, {
//         ...options,
//         stdin: 'ignore',
//         stderr: 'ignore',
//         stdout: options.stdout !== 'ignore' ? 'pipe' : 'ignore',
//         env: options.env,
//         onExit: (_proc, _code, _signalCode, error) => {
//           if (_code !== 0 && options.stdout !== 'ignore' && options.max !== 0) {
//             const message = `\n-- code: ${_code}\n`
//             emitter.emit('data', { type: 'workers@stdout', key, chunk: message })
//           }

//           if (firstRun) {
//             consola.error(`\n\n🚨🚨🚨 ABNORMAL PROCESS EXIT (code: ${_code}) 🚨🚨🚨\n\nTo ensure that the command executes normally! you can try to run:\n\`\`\`\`\ncd ${options.cwd}\n${options.command.join(' ')}\n\`\`\`\`\nThen, fix any errors you encounter until the program starts correctly.\n`)
//             exit(1)
//           }

//           emitter.emit('data', { type: 'workers@state', key, state: 'stopped', code: _code })
//           worker.state = 'stopped'
//         },
//       })
//       if (options.stdout !== 'ignore') {
//         spawn.stdout.pipeTo(
//           new WritableStream({
//             write: (chunk) => {
//               const str = textDecoder.decode(chunk)
//               process.stdout.write(str)
//               worker.stdout.push(str)
//               if (options.max !== 0) emitter.emit('data', { type: 'workers@stdout', key, chunk: str })
//               if (worker.stdout.length >= (options.max ?? 1024 * 64)) worker.stdout.splice(0, Math.ceil((options.max ?? 1024 * 64) * 0.2))
//             },
//           }),
//         )
//       }

//       emitter.emit('data', { type: 'workers@state', key, state: 'running', code: 'running' })
//       worker.state = 'running'
//     },
//   }

//   let spawn: Subprocess<'ignore', 'pipe', 'inherit'>
//   workers.set(key, worker)

//   return worker
// }
