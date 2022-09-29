export type AvalonMMVConfig = {
  [market: string]: {
    LYRA: number,
    OP: number,
    x: number,
    totalStkScaleFactor: number,
    ignoreList: string[],
  },
}
