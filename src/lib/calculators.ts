/**
 * ARDON Insights — Financial Calculators
 * 28 pure functions for CRE underwriting
 */

// ─── NOI & Cash Flow ───────────────────────────────────────────────────────

export function calcGPI(units: number, avgMonthlyRent: number): number {
  return units * avgMonthlyRent * 12
}

export function calcEGI(gpi: number, vacancyRate: number, otherIncome = 0): number {
  return gpi * (1 - vacancyRate) + otherIncome
}

export function calcNOI(egi: number, operatingExpenses: number): number {
  return egi - operatingExpenses
}

export function calcExpenseRatio(operatingExpenses: number, egi: number): number {
  return egi === 0 ? 0 : operatingExpenses / egi
}

export function calcCapRate(noi: number, purchasePrice: number): number {
  return purchasePrice === 0 ? 0 : noi / purchasePrice
}

export function calcGRM(purchasePrice: number, annualRentIncome: number): number {
  return annualRentIncome === 0 ? 0 : purchasePrice / annualRentIncome
}

// ─── Debt & Leverage ───────────────────────────────────────────────────────

export function calcLTV(loanAmount: number, propertyValue: number): number {
  return propertyValue === 0 ? 0 : loanAmount / propertyValue
}

export function calcDSCR(noi: number, annualDebtService: number): number {
  return annualDebtService === 0 ? 0 : noi / annualDebtService
}

/** Monthly mortgage payment (P&I) */
export function calcMonthlyPayment(principal: number, annualRate: number, amortYears: number): number {
  const r = annualRate / 12
  const n = amortYears * 12
  if (r === 0) return principal / n
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

export function calcAnnualDebtService(
  loanAmount: number,
  annualRate: number,
  amortYears: number,
  ioPeriodYears = 0,
  currentYear = 1
): number {
  if (currentYear <= ioPeriodYears) {
    // Interest-only period
    return loanAmount * annualRate
  }
  return calcMonthlyPayment(loanAmount, annualRate, amortYears) * 12
}

export function calcBreakevenOccupancy(operatingExpenses: number, debtService: number, gpi: number): number {
  return gpi === 0 ? 0 : (operatingExpenses + debtService) / gpi
}

// ─── Returns ───────────────────────────────────────────────────────────────

export function calcCashOnCash(annualCashFlow: number, equityInvested: number): number {
  return equityInvested === 0 ? 0 : annualCashFlow / equityInvested
}

/** IRR via Newton's method on NPV */
export function calcIRR(cashFlows: number[], guess = 0.1): number {
  const MAX_ITER = 1000
  const TOLERANCE = 1e-7
  let rate = guess

  for (let i = 0; i < MAX_ITER; i++) {
    let npv = 0
    let dnpv = 0
    for (let t = 0; t < cashFlows.length; t++) {
      const factor = Math.pow(1 + rate, t)
      npv += cashFlows[t] / factor
      dnpv -= (t * cashFlows[t]) / (factor * (1 + rate))
    }
    if (Math.abs(dnpv) < 1e-10) break
    const newRate = rate - npv / dnpv
    if (Math.abs(newRate - rate) < TOLERANCE) return newRate
    rate = newRate
  }
  return rate
}

export function calcNPV(cashFlows: number[], discountRate: number): number {
  return cashFlows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + discountRate, t), 0)
}

export function calcEquityMultiple(totalDistributions: number, equityInvested: number): number {
  return equityInvested === 0 ? 0 : totalDistributions / equityInvested
}

// ─── Valuation ─────────────────────────────────────────────────────────────

export function calcValueByCapRate(noi: number, capRate: number): number {
  return capRate === 0 ? 0 : noi / capRate
}

export function calcExitValue(exitYearNOI: number, exitCapRate: number): number {
  return calcValueByCapRate(exitYearNOI, exitCapRate)
}

export function calcNetSaleProceeds(grossSalePrice: number, sellingCosts = 0.02): number {
  return grossSalePrice * (1 - sellingCosts)
}

// ─── Pro Forma Projection ─────────────────────────────────────────────────

export interface ProFormaYear {
  year: number
  gpi: number
  vacancyLoss: number
  egi: number
  operatingExpenses: number
  noi: number
  debtService: number
  cashFlow: number
  exitValue?: number
}

export function buildProForma(params: {
  initialNOI: number
  revenueGrowth: number
  expenseGrowth: number
  vacancyRate: number
  operatingExpenseRatio: number
  holdYears: number
  exitCapRate: number
  loanAmount: number
  annualRate: number
  amortYears: number
  ioPeriod: number
  purchasePrice: number
}): ProFormaYear[] {
  const years: ProFormaYear[] = []
  let noi = params.initialNOI

  for (let yr = 1; yr <= params.holdYears; yr++) {
    if (yr > 1) noi *= (1 + params.revenueGrowth)
    const gpi = noi / (1 - params.operatingExpenseRatio - params.vacancyRate)
    const vacancyLoss = gpi * params.vacancyRate
    const egi = gpi - vacancyLoss
    const opex = egi * params.operatingExpenseRatio
    const ds = calcAnnualDebtService(params.loanAmount, params.annualRate, params.amortYears, params.ioPeriod, yr)
    const cf = noi - ds
    const row: ProFormaYear = { year: yr, gpi, vacancyLoss, egi, operatingExpenses: opex, noi, debtService: ds, cashFlow: cf }
    if (yr === params.holdYears) {
      row.exitValue = calcExitValue(noi * (1 + params.revenueGrowth), params.exitCapRate)
    }
    years.push(row)
  }
  return years
}

// ─── Waterfall ─────────────────────────────────────────────────────────────

export interface WaterfallResult {
  lpDistribution: number
  gpDistribution: number
  lpIRR: number
  gpIRR: number
  lpEquityMultiple: number
}

export function calcWaterfall(params: {
  totalEquity: number
  lpShare: number
  gpShare: number
  cashFlows: number[]
  exitProceeds: number
  preferredReturn: number
  gpPromote: number
  hurdle1: number
  hurdle1LPSplit: number
  hurdle2?: number
  hurdle2LPSplit?: number
}): WaterfallResult {
  const { totalEquity, lpShare, gpShare, cashFlows, exitProceeds, preferredReturn, gpPromote, hurdle1, hurdle1LPSplit } = params
  const lpEquity = totalEquity * lpShare
  const gpEquity = totalEquity * gpShare
  const allCFs = [...cashFlows, exitProceeds]
  const totalPool = allCFs.reduce((a, b) => a + b, 0)

  // Simplified waterfall: preferred return first, then promote
  const preferredAmount = lpEquity * preferredReturn
  const lpPref = Math.min(totalPool, preferredAmount)
  const remaining = Math.max(0, totalPool - lpPref)
  const gpPromoteAmount = remaining * gpPromote
  const lpResidual = remaining - gpPromoteAmount

  const lpTotal = lpPref + lpResidual
  const gpTotal = gpEquity + gpPromoteAmount

  const lpCFs = [...cashFlows.map(cf => cf * lpShare), lpTotal]
  const gpCFs = [...cashFlows.map(cf => cf * gpShare), gpTotal]
  lpCFs[0] -= lpEquity
  gpCFs[0] -= gpEquity

  return {
    lpDistribution: lpTotal,
    gpDistribution: gpTotal,
    lpIRR: calcIRR([-lpEquity, ...cashFlows.map(cf => cf * lpShare), lpTotal]),
    gpIRR: calcIRR([-gpEquity, ...cashFlows.map(cf => cf * gpShare), gpTotal]),
    lpEquityMultiple: calcEquityMultiple(lpTotal, lpEquity),
  }
}

// ─── Sensitivity Matrix ─────────────────────────────────────────────────────

export interface SensitivityCell {
  exitCapRate: number
  rentGrowth: number
  irr: number
  equityMultiple: number
}

export function buildSensitivityMatrix(params: {
  baseParams: Parameters<typeof buildProForma>[0]
  equityInvested: number
  capRateRange: number[]
  growthRange: number[]
}): SensitivityCell[] {
  const result: SensitivityCell[] = []
  for (const exitCapRate of params.capRateRange) {
    for (const rentGrowth of params.growthRange) {
      const pf = buildProForma({ ...params.baseParams, exitCapRate, revenueGrowth: rentGrowth })
      const cashFlows = [-params.equityInvested, ...pf.map(y => y.cashFlow)]
      const lastYear = pf[pf.length - 1]
      if (lastYear.exitValue) {
        const netSale = calcNetSaleProceeds(lastYear.exitValue) - (params.baseParams.loanAmount * 0.85)
        cashFlows[cashFlows.length - 1] += netSale
      }
      const irr = calcIRR(cashFlows)
      const em = calcEquityMultiple(cashFlows.slice(1).reduce((a, b) => a + b, 0), params.equityInvested)
      result.push({ exitCapRate, rentGrowth, irr, equityMultiple: em })
    }
  }
  return result
}

// ─── Misc ──────────────────────────────────────────────────────────────────

export function calcPricePerUnit(price: number, units: number): number {
  return units === 0 ? 0 : price / units
}

export function calcPricePerSF(price: number, sf: number): number {
  return sf === 0 ? 0 : price / sf
}

export function calcRentPerSF(monthlyRent: number, sf: number): number {
  return sf === 0 ? 0 : monthlyRent / sf
}

export function calcLoanConstant(annualRate: number, amortYears: number): number {
  const monthly = calcMonthlyPayment(1, annualRate, amortYears)
  return monthly * 12
}

export function calcDebtYield(noi: number, loanAmount: number): number {
  return loanAmount === 0 ? 0 : noi / loanAmount
}
