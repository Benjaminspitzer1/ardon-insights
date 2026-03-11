/**
 * ARDON Insights — Excel Export Engine
 * Three workbook types: Underwriting Model, Rent Roll, Portfolio Summary
 */
import ExcelJS from 'exceljs'
import type { ProFormaYear } from './calculators'

// ─── Brand colors ───────────────────────────────────────────────────────────
const TEAL = '0D9488'
const NAVY = '0F172A'
const LIGHT_GRAY = 'F1F5F9'
const WHITE = 'FFFFFF'
const GREEN = '10B981'
const RED = 'EF4444'

function applyHeaderStyle(cell: ExcelJS.Cell, dark = true) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: dark ? `FF${NAVY}` : `FF${TEAL}` } }
  cell.font = { bold: true, color: { argb: `FF${WHITE}` }, size: 11 }
  cell.alignment = { horizontal: 'center', vertical: 'middle' }
  cell.border = { bottom: { style: 'thin', color: { argb: `FF${TEAL}` } } }
}

function applyRowStyle(cell: ExcelJS.Cell, highlight = false, isCurrency = false) {
  if (highlight) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${LIGHT_GRAY}` } }
    cell.font = { bold: true, size: 10 }
  } else {
    cell.font = { size: 10 }
  }
  if (isCurrency) {
    cell.numFmt = '$#,##0'
  }
  cell.alignment = { horizontal: isCurrency ? 'right' : 'left', vertical: 'middle' }
}

// ─── Workbook 1: Underwriting Model ─────────────────────────────────────────

export interface UWModelData {
  propertyName: string
  address: string
  propertyType: string
  units?: number
  purchasePrice: number
  loanAmount: number
  annualRate: number
  ltv: number
  capRate: number
  dscr: number
  irr: number
  equityMultiple: number
  proForma: ProFormaYear[]
  assumptions: Record<string, string | number>
}

export async function exportUWModel(data: UWModelData): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'ARDON Insights'
  wb.created = new Date()

  // ── Cover Sheet ──
  const cover = wb.addWorksheet('Cover')
  cover.getColumn(1).width = 30
  cover.getColumn(2).width = 30

  cover.mergeCells('A1:F1')
  const titleCell = cover.getCell('A1')
  titleCell.value = 'ARDON INSIGHTS — UNDERWRITING MODEL'
  titleCell.font = { bold: true, size: 18, color: { argb: `FF${WHITE}` } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${NAVY}` } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  cover.getRow(1).height = 50

  cover.mergeCells('A2:F2')
  const subCell = cover.getCell('A2')
  subCell.value = data.propertyName
  subCell.font = { bold: true, size: 14, color: { argb: `FF${TEAL}` } }
  subCell.alignment = { horizontal: 'center' }
  cover.getRow(2).height = 30

  const coverData = [
    ['Property', data.propertyName],
    ['Address', data.address],
    ['Type', data.propertyType],
    ['Units', data.units ?? 'N/A'],
    ['', ''],
    ['Purchase Price', data.purchasePrice],
    ['Loan Amount', data.loanAmount],
    ['LTV', `${(data.ltv * 100).toFixed(1)}%`],
    ['Interest Rate', `${(data.annualRate * 100).toFixed(2)}%`],
    ['', ''],
    ['Going-In Cap Rate', `${(data.capRate * 100).toFixed(2)}%`],
    ['DSCR', `${data.dscr.toFixed(2)}x`],
    ['LP IRR', `${(data.irr * 100).toFixed(1)}%`],
    ['Equity Multiple', `${data.equityMultiple.toFixed(2)}x`],
    ['', ''],
    ['Date', new Date().toLocaleDateString()],
    ['Prepared by', 'ARDON Insights'],
  ]

  coverData.forEach((row, i) => {
    const r = cover.getRow(i + 4)
    r.getCell(1).value = row[0]
    r.getCell(2).value = row[1]
    r.getCell(1).font = { bold: row[0] !== '', color: { argb: `FF${NAVY}` } }
    if (typeof row[1] === 'number' && row[1] > 1000) {
      r.getCell(2).numFmt = '$#,##0'
    }
    r.height = 20
  })

  // ── Pro Forma Sheet ──
  const pfSheet = wb.addWorksheet('Pro Forma')
  const pfCols = ['Line Item', ...data.proForma.map(y => `Year ${y.year}`)]
  pfSheet.getColumn(1).width = 28

  pfCols.forEach((col, i) => {
    pfSheet.getColumn(i + 1).width = i === 0 ? 28 : 14
    const cell = pfSheet.getCell(1, i + 1)
    cell.value = col
    applyHeaderStyle(cell, i === 0)
  })
  pfSheet.getRow(1).height = 25

  interface PFRow { label: string; key: keyof ProFormaYear; highlight: boolean; negative?: boolean }
  const pfRows: PFRow[] = [
    { label: 'Gross Potential Income', key: 'gpi', highlight: false },
    { label: 'Vacancy Loss', key: 'vacancyLoss', highlight: false, negative: true },
    { label: 'Effective Gross Income', key: 'egi', highlight: true },
    { label: 'Operating Expenses', key: 'operatingExpenses', highlight: false, negative: true },
    { label: 'Net Operating Income', key: 'noi', highlight: true },
    { label: 'Debt Service', key: 'debtService', highlight: false, negative: true },
    { label: 'Cash Flow Before Tax', key: 'cashFlow', highlight: true },
  ]

  pfRows.forEach(({ label, key, highlight, negative }, ri) => {
    const row = pfSheet.getRow(ri + 2)
    row.getCell(1).value = label
    applyRowStyle(row.getCell(1), highlight)
    data.proForma.forEach((y, ci) => {
      const val = (y[key] as number) ?? 0
      const cell = row.getCell(ci + 2)
      cell.value = negative ? -Math.abs(val) : val
      cell.numFmt = '$#,##0'
      applyRowStyle(cell, highlight, true)
      if (key === 'cashFlow') {
        cell.font = { bold: true, color: { argb: val >= 0 ? `FF${GREEN}` : `FF${RED}` } }
      }
    })
    row.height = 20
  })

  // Freeze pane on first column
  pfSheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }]

  // ── Assumptions Sheet ──
  const asSheet = wb.addWorksheet('Assumptions')
  asSheet.getColumn(1).width = 30
  asSheet.getColumn(2).width = 20

  const asHeader = asSheet.getRow(1)
  asHeader.getCell(1).value = 'Assumption'
  asHeader.getCell(2).value = 'Value'
  applyHeaderStyle(asHeader.getCell(1))
  applyHeaderStyle(asHeader.getCell(2))
  asHeader.height = 25

  Object.entries(data.assumptions).forEach(([k, v], i) => {
    const row = asSheet.getRow(i + 2)
    row.getCell(1).value = k
    row.getCell(2).value = v
    row.height = 18
  })

  // Save
  const buffer = await wb.xlsx.writeBuffer()
  downloadBlob(buffer, `${sanitize(data.propertyName)}_UW_Model.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

// ─── Workbook 2: Rent Roll ──────────────────────────────────────────────────

export interface RentRollRow {
  unit_number: string
  unit_type: string
  tenant_name: string | null
  lease_start: string | null
  lease_end: string | null
  monthly_rent: number
  sqft: number | null
  status: string
}

export async function exportRentRoll(propertyName: string, rows: RentRollRow[]): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'ARDON Insights'

  const sheet = wb.addWorksheet('Rent Roll')

  const COLS = ['Unit', 'Type', 'Tenant', 'Lease Start', 'Lease End', 'Monthly Rent', 'Annual Rent', 'SF', 'Rent/SF', 'Status']
  COLS.forEach((col, i) => {
    sheet.getColumn(i + 1).width = [8, 12, 22, 14, 14, 16, 16, 10, 10, 12][i]
    const cell = sheet.getCell(1, i + 1)
    cell.value = col
    applyHeaderStyle(cell)
  })
  sheet.getRow(1).height = 25

  let totalRent = 0
  let totalSF = 0

  rows.forEach((r, i) => {
    const row = sheet.getRow(i + 2)
    const monthlyRent = r.monthly_rent ?? 0
    const annualRent = monthlyRent * 12
    const sf = r.sqft ?? 0
    const rentPerSF = sf > 0 ? monthlyRent / sf : 0

    totalRent += monthlyRent
    totalSF += sf

    row.getCell(1).value = r.unit_number
    row.getCell(2).value = r.unit_type
    row.getCell(3).value = r.tenant_name ?? ''
    row.getCell(4).value = r.lease_start ?? ''
    row.getCell(5).value = r.lease_end ?? ''
    row.getCell(6).value = monthlyRent
    row.getCell(6).numFmt = '$#,##0'
    row.getCell(7).value = annualRent
    row.getCell(7).numFmt = '$#,##0'
    row.getCell(8).value = sf
    row.getCell(8).numFmt = '#,##0'
    row.getCell(9).value = rentPerSF
    row.getCell(9).numFmt = '$#,##0.00'
    row.getCell(10).value = r.status

    // Color status
    const statusColor = r.status === 'occupied' ? `FF${GREEN}` : r.status === 'vacant' ? `FF${RED}` : `FF${TEAL}`
    row.getCell(10).font = { color: { argb: statusColor }, bold: true }

    // Alternate row shading
    if (i % 2 === 0) {
      for (let c = 1; c <= 10; c++) {
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${LIGHT_GRAY}` } }
      }
    }
    row.height = 18
  })

  // Totals row
  const totalsRow = sheet.getRow(rows.length + 2)
  totalsRow.getCell(1).value = 'TOTAL'
  totalsRow.getCell(6).value = totalRent
  totalsRow.getCell(6).numFmt = '$#,##0'
  totalsRow.getCell(7).value = totalRent * 12
  totalsRow.getCell(7).numFmt = '$#,##0'
  totalsRow.getCell(8).value = totalSF
  totalsRow.getCell(8).numFmt = '#,##0'
  totalsRow.getCell(9).value = totalSF > 0 ? totalRent / totalSF : 0
  totalsRow.getCell(9).numFmt = '$#,##0.00'
  for (let c = 1; c <= 10; c++) {
    totalsRow.getCell(c).font = { bold: true, color: { argb: `FF${NAVY}` } }
    totalsRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${TEAL}20` } }
  }

  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.autoFilter = { from: 'A1', to: 'J1' }

  const buffer = await wb.xlsx.writeBuffer()
  downloadBlob(buffer, `${sanitize(propertyName)}_Rent_Roll.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

// ─── Workbook 3: Portfolio Summary ──────────────────────────────────────────

export interface PortfolioProperty {
  name: string
  city: string
  state: string
  property_type: string
  units: number | null
  purchase_price: number | null
  current_value: number | null
  status: string
}

export async function exportPortfolioSummary(properties: PortfolioProperty[]): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'ARDON Insights'

  const sheet = wb.addWorksheet('Portfolio')
  const COLS = ['Property', 'City', 'State', 'Type', 'Units', 'Purchase Price', 'Current Value', 'Gain/Loss', 'Status']
  COLS.forEach((col, i) => {
    sheet.getColumn(i + 1).width = [28, 16, 8, 14, 8, 16, 16, 14, 12][i]
    const cell = sheet.getCell(1, i + 1)
    cell.value = col
    applyHeaderStyle(cell)
  })
  sheet.getRow(1).height = 25

  let totalPurchase = 0
  let totalCurrent = 0

  properties.forEach((p, i) => {
    const row = sheet.getRow(i + 2)
    const gainLoss = (p.current_value ?? p.purchase_price ?? 0) - (p.purchase_price ?? 0)
    totalPurchase += p.purchase_price ?? 0
    totalCurrent += p.current_value ?? p.purchase_price ?? 0

    row.getCell(1).value = p.name
    row.getCell(2).value = p.city
    row.getCell(3).value = p.state
    row.getCell(4).value = p.property_type
    row.getCell(5).value = p.units ?? ''
    row.getCell(6).value = p.purchase_price ?? ''
    row.getCell(6).numFmt = '$#,##0'
    row.getCell(7).value = p.current_value ?? ''
    row.getCell(7).numFmt = '$#,##0'
    row.getCell(8).value = gainLoss !== 0 ? gainLoss : ''
    row.getCell(8).numFmt = '$#,##0'
    row.getCell(8).font = { color: { argb: gainLoss >= 0 ? `FF${GREEN}` : `FF${RED}` } }
    row.getCell(9).value = p.status
    row.height = 18
  })

  // Totals
  const totalsRow = sheet.getRow(properties.length + 2)
  totalsRow.getCell(1).value = 'PORTFOLIO TOTAL'
  totalsRow.getCell(6).value = totalPurchase
  totalsRow.getCell(6).numFmt = '$#,##0'
  totalsRow.getCell(7).value = totalCurrent
  totalsRow.getCell(7).numFmt = '$#,##0'
  totalsRow.getCell(8).value = totalCurrent - totalPurchase
  totalsRow.getCell(8).numFmt = '$#,##0'
  totalsRow.getCell(8).font = { color: { argb: totalCurrent >= totalPurchase ? `FF${GREEN}` : `FF${RED}` }, bold: true }
  for (let c = 1; c <= 9; c++) {
    totalsRow.getCell(c).font = { bold: true }
    totalsRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${LIGHT_GRAY}` } }
  }

  sheet.autoFilter = { from: 'A1', to: 'I1' }

  const buffer = await wb.xlsx.writeBuffer()
  downloadBlob(buffer, `ARDON_Portfolio_${new Date().toISOString().slice(0, 10)}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

// ─── Workbook 4: Unit Mix Template ──────────────────────────────────────────

export async function downloadUnitMixTemplate(): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'ARDON Insights'
  const sheet = wb.addWorksheet('Unit Mix')
  const COLS = ['Unit Type', 'Count', 'SF', 'Market Rent', 'Concession', 'Notes']
  COLS.forEach((col, i) => {
    sheet.getColumn(i + 1).width = [14, 10, 10, 14, 14, 28][i]
    const cell = sheet.getCell(1, i + 1)
    cell.value = col
    applyHeaderStyle(cell)
  })
  sheet.getRow(1).height = 25
  const ex = sheet.getRow(2)
  ex.getCell(1).value = '1BR/1BA'
  ex.getCell(2).value = 10
  ex.getCell(3).value = 750
  ex.getCell(4).value = 1500
  ex.getCell(5).value = 0
  ex.getCell(6).value = 'Example row — delete before importing'
  for (let c = 1; c <= 6; c++) {
    ex.getCell(c).font = { italic: true, color: { argb: 'FF888888' }, size: 10 }
  }
  const buffer = await wb.xlsx.writeBuffer()
  downloadBlob(buffer, 'Unit_Mix_Template.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

// ─── Workbook 5: Rent Roll Template ─────────────────────────────────────────

export async function downloadRentRollTemplate(): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'ARDON Insights'
  const sheet = wb.addWorksheet('Rent Roll')
  const COLS = ['Unit #', 'Unit Type', 'Tenant Name', 'Lease Start', 'Lease End', 'Monthly Rent', 'SF', 'Status']
  COLS.forEach((col, i) => {
    sheet.getColumn(i + 1).width = [10, 12, 22, 14, 14, 16, 10, 12][i]
    const cell = sheet.getCell(1, i + 1)
    cell.value = col
    applyHeaderStyle(cell)
  })
  sheet.getRow(1).height = 25
  const ex = sheet.getRow(2)
  ex.getCell(1).value = '101'
  ex.getCell(2).value = '1BR'
  ex.getCell(3).value = 'Jane Smith'
  ex.getCell(4).value = '2025-01-01'
  ex.getCell(5).value = '2025-12-31'
  ex.getCell(6).value = 1500
  ex.getCell(6).numFmt = '$#,##0'
  ex.getCell(7).value = 750
  ex.getCell(8).value = 'occupied'
  for (let c = 1; c <= 8; c++) {
    ex.getCell(c).font = { italic: true, color: { argb: 'FF888888' }, size: 10 }
  }
  const buffer = await wb.xlsx.writeBuffer()
  downloadBlob(buffer, 'Rent_Roll_Template.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

// ─── Workbook 6: Pro Forma Export ────────────────────────────────────────────

export async function exportProFormaTable(propertyName: string, rows: ProFormaYear[]): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'ARDON Insights'
  const sheet = wb.addWorksheet('Pro Forma')
  const pfCols = ['Line Item', ...rows.map(y => `Year ${y.year}`)]
  pfCols.forEach((col, i) => {
    sheet.getColumn(i + 1).width = i === 0 ? 28 : 14
    const cell = sheet.getCell(1, i + 1)
    cell.value = col
    applyHeaderStyle(cell, i === 0)
  })
  sheet.getRow(1).height = 25

  interface PFRow { label: string; key: keyof ProFormaYear; highlight: boolean; negative?: boolean }
  const pfRows: PFRow[] = [
    { label: 'Gross Potential Income', key: 'gpi', highlight: false },
    { label: 'Vacancy Loss', key: 'vacancyLoss', highlight: false, negative: true },
    { label: 'Effective Gross Income', key: 'egi', highlight: true },
    { label: 'Operating Expenses', key: 'operatingExpenses', highlight: false, negative: true },
    { label: 'Net Operating Income', key: 'noi', highlight: true },
    { label: 'Debt Service', key: 'debtService', highlight: false, negative: true },
    { label: 'Cash Flow Before Tax', key: 'cashFlow', highlight: true },
  ]
  pfRows.forEach(({ label, key, highlight, negative }, ri) => {
    const row = sheet.getRow(ri + 2)
    row.getCell(1).value = label
    applyRowStyle(row.getCell(1), highlight)
    rows.forEach((y, ci) => {
      const val = (y[key] as number) ?? 0
      const cell = row.getCell(ci + 2)
      cell.value = negative ? -Math.abs(val) : val
      cell.numFmt = '$#,##0'
      applyRowStyle(cell, highlight, true)
      if (key === 'cashFlow') {
        cell.font = { bold: true, color: { argb: val >= 0 ? `FF${GREEN}` : `FF${RED}` } }
      }
    })
    row.height = 20
  })
  sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }]
  const buffer = await wb.xlsx.writeBuffer()
  downloadBlob(buffer, `${sanitize(propertyName)}_Pro_Forma.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function downloadBlob(data: ExcelJS.Buffer, filename: string, mimeType: string) {
  const blob = new Blob([data], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_').slice(0, 50)
}
