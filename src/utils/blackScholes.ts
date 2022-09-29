import { erf } from "mathjs";

export function stdNormalCDF(x: number): number {
  return (1.0 - erf(-x / Math.sqrt(2))) / 2.0;
}

export function stdNormal(x: number): number {
  return Math.exp((-x * x) / 2.0) / Math.sqrt(2.0 * Math.PI);
}

export function d1(
  tAnnualised: number,
  vol: number,
  spot: number,
  strike: number,
  rate: number
): number {
  return (
    (Math.log(spot / strike) + (rate + (vol * vol) / 2.0) * tAnnualised) /
    (vol * Math.sqrt(tAnnualised))
  );
}

export function d2(
  tAnnualised: number,
  vol: number,
  spot: number,
  strike: number,
  rate: number
): number {
  return (
    d1(tAnnualised, vol, spot, strike, rate) - vol * Math.sqrt(tAnnualised)
  );
}

export function PV(value: number, rate: number, tAnnualised: number): number {
  return value * Math.exp(-rate * tAnnualised);
}

export function callPrice(
  tAnnualised: number,
  vol: number,
  spot: number,
  strike: number,
  rate: number
): number {
  return (
    stdNormalCDF(d1(tAnnualised, vol, spot, strike, rate)) * spot -
    stdNormalCDF(d2(tAnnualised, vol, spot, strike, rate)) *
      PV(strike, rate, tAnnualised)
  );
}

export function putPrice(
  tAnnualised: number,
  vol: number,
  spot: number,
  strike: number,
  rate: number
): number {
  return (
    stdNormalCDF(-d2(tAnnualised, vol, spot, strike, rate)) *
      PV(strike, rate, tAnnualised) -
    stdNormalCDF(-d1(tAnnualised, vol, spot, strike, rate)) * spot
  );
}

export function optionPrices(
  timeToExpirySeconds: number,
  vol: number,
  spot: number,
  strike: number,
  rate: number
): [number, number] {
  return [
    callPrice(timeToExpirySeconds, vol, spot, strike, rate),
    putPrice(timeToExpirySeconds, vol, spot, strike, rate),
  ];
}

export function callDelta(
  tAnnualised: number,
  vol: number,
  spot: number,
  strike: number,
  rate: number
): number {
  return stdNormalCDF(d1(tAnnualised, vol, spot, strike, rate));
}

export function putDelta(
  tAnnualised: number,
  vol: number,
  spot: number,
  strike: number,
  rate: number
): number {
  return callDelta(tAnnualised, vol, spot, strike, rate) - 1.0;
}

export function vega(
  tAnnualised: number,
  vol: number,
  spot: number,
  strike: number,
  rate: number
): number {
  return (
    spot *
    stdNormal(d1(tAnnualised, vol, spot, strike, rate)) *
    Math.sqrt(tAnnualised)
  );
}
