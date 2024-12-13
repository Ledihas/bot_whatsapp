import { TFlow } from "@builderbot/bot/dist/types";

type DebounceFunction<P = any> = 
((message?: string) => void) | // this is the endFlow type
((flow: TFlow<P>, step?: number) => Promise<void>) // this is the gotoFlow type

export function debounce(func: DebounceFunction, ms: number) {
  let timeout:NodeJS.Timeout;
  return function(...args: any[]) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), ms)
  }
}

