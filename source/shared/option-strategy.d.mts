export type OptionStrategy = 'SYNT_LONG' | 'SYNT_SHORT' | 'SHORT_CALL' | 'SHORT_PUT' | 'LONG_CALL' | 'LONG_PUT' | 'OTHER'

export interface StrategyPosition {
  symbol?: string | null
  expiry?: string | null
  strike?: number | null
  optionRight?: string | null
  quantity?: number | null
}

export function assignOptionStrategies<T extends StrategyPosition>(positions: T[]): Array<T & { strategy: OptionStrategy }>
