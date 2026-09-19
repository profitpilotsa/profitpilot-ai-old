/** Monetary values are integer minor units (halalas for SAR), never floats. */
export type MinorUnit = number & { readonly __minorUnit: unique symbol };

export const money = (value: number): MinorUnit => {
  if (!Number.isSafeInteger(value)) throw new Error("Money must be a safe integer minor-unit value");
  return value as MinorUnit;
};

export const zeroMoney = money(0);
export const addMoney = (...values: MinorUnit[]) => money(values.reduce((sum, value) => sum + value, 0));
export const subtractMoney = (left: MinorUnit, right: MinorUnit) => money(left - right);
/** Basis points avoid floating-point percentage calculations: 250 = 2.5%. */
export const applyBps = (base: MinorUnit, bps: number) => money(Math.round((base * bps) / 10_000));
