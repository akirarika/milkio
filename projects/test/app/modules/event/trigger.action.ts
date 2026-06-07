import type { MilkioContext } from "../../../.milkio/declares.ts";

type Params = {
  mode: 'emit' | 'emitAllApproved' | 'emitAnyApproved'
}

type Result = {
  received: string[]
  approved: boolean | null
}

export async function handler(context: MilkioContext, params: Params): Promise<Result> {
  const eventData = {
    message: 'hello',
    received: [] as string[],
    allow: false,
  };

  if (params.mode === 'emit') {
    await context.emit('event:notify', { message: eventData.message, received: eventData.received });
    return { received: eventData.received, approved: null };
  }

  if (params.mode === 'emitAllApproved') {
    const approved = await context.emitAllApproved('event:approve', eventData);
    return { received: eventData.received, approved };
  }

  if (params.mode === 'emitAnyApproved') {
    const approved = await context.emitAnyApproved('event:approve', eventData);
    return { received: eventData.received, approved };
  }

  throw context.reject('REQUEST_FAIL', 'Invalid mode');
}