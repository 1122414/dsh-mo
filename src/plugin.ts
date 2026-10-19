import type { DshContext } from './adapter.js';
import { startApp } from './app.js';
export const name = 'dsh-mo';
export const inject = ['uiSession', 'connection'];
const OWNER = Symbol.for('dsh-mo.client.owner');
export function apply(ctx: DshContext): void {
  if (typeof document === 'undefined') return;
  if (typeof ctx.effect !== 'function') throw new Error('dsh-mo requires Cordis lifecycle effects');
  ctx.effect(() => {
    const owners = window as unknown as Record<symbol, (() => void) | undefined>;
    owners[OWNER]?.();
    const stop = startApp(ctx);
    const dispose = () => { stop(); if (owners[OWNER] === dispose) delete owners[OWNER]; };
    owners[OWNER] = dispose;
    return dispose;
  }, 'dsh-mo: passive client meter');
}
