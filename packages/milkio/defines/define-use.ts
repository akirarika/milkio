export const defineUse = <CreatorFn extends () => Promise<unknown> | unknown>(creatorFn: CreatorFn): (() => Promise<Awaited<ReturnType<CreatorFn>>>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let use: any | undefined

  const getUse = async () => {
    if (use === undefined) {
      use = await creatorFn()
    }
    return use
  }

  return getUse
}
