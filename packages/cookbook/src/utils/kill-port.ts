import kill from 'kill-port'

export async function killPort(port: number): Promise<void> {
  await kill(port, 'tcp')
}
