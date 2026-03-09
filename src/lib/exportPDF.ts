/**
 * ARDON Insights — PDF One-Pager Export
 * Generates a deal summary PDF using jsPDF
 */
import jsPDF from 'jspdf'
import { formatCurrency, formatPercent } from './utils'

// Brand colors (RGB)
const TEAL = [13, 148, 136] as const
const NAVY = [15, 23, 42] as const
const LIGHT = [241, 245, 249] as const
const MUTED = [100, 116, 139] as const
const WHITE = [255, 255, 255] as const

interface DealOnePagerData {
  propertyName: string
  address: string
  city: string
  state: string
  propertyType: string
  units?: number
  sf?: number
  yearBuilt?: number

  purchasePrice: number
  loanAmount: number
  equity: number
  ltv: number
  capRate: number
  dscr: number
  irr: number
  equityMultiple: number
  cashOnCash: number

  noi: number
  gpi: number
  vacancyRate: number
  opexRatio: number

  brokerName?: string
  brokerEmail?: string
  stage: string

  notes?: string
}

export async function exportDealOnePager(data: DealOnePagerData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })

  const W = 215.9  // letter width mm
  const margin = 15
  const colW = (W - margin * 2 - 5) / 2

  // ── Header bar ──
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, 28, 'F')

  doc.setTextColor(...WHITE)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('ARDON INSIGHTS', margin, 12)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Deal One-Pager', margin, 18)
  doc.text(`Generated ${new Date().toLocaleDateString()}`, W - margin, 18, { align: 'right' })

  // ── Property title ──
  doc.setFillColor(...TEAL)
  doc.rect(0, 28, W, 18, 'F')

  doc.setTextColor(...WHITE)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(data.propertyName, margin, 39)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`${data.address}, ${data.city}, ${data.state}  ·  ${data.propertyType}${data.units ? `  ·  ${data.units} units` : ''}`, margin, 44)

  let y = 54

  // ── Key Metrics row ──
  const metrics = [
    { label: 'Purchase Price', value: formatCurrency(data.purchasePrice) },
    { label: 'Going-In Cap Rate', value: formatPercent(data.capRate) },
    { label: 'LTV', value: formatPercent(data.ltv) },
    { label: 'DSCR', value: `${data.dscr.toFixed(2)}x` },
    { label: 'LP IRR', value: formatPercent(data.irr) },
    { label: 'Equity Multiple', value: `${data.equityMultiple.toFixed(2)}x` },
  ]

  const metricW = (W - margin * 2) / 3
  metrics.forEach(({ label, value }, i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    const x = margin + col * metricW
    const my = y + row * 18

    doc.setFillColor(...LIGHT)
    doc.roundedRect(x, my, metricW - 2, 15, 2, 2, 'F')

    doc.setTextColor(...MUTED)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(label.toUpperCase(), x + 4, my + 5)

    doc.setTextColor(...NAVY)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(value, x + 4, my + 12)
  })

  y += 42

  // ── Two-column section ──
  function sectionHeader(title: string, sx: number, sy: number, sw: number) {
    doc.setFillColor(...TEAL)
    doc.rect(sx, sy, sw, 7, 'F')
    doc.setTextColor(...WHITE)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text(title, sx + 3, sy + 5)
  }

  function dataRow(label: string, value: string, sx: number, sy: number) {
    doc.setTextColor(...MUTED)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(label, sx + 3, sy)
    doc.setTextColor(...NAVY)
    doc.setFont('helvetica', 'bold')
    doc.text(value, sx + colW - 3, sy, { align: 'right' })
  }

  // Left column — Income
  sectionHeader('INCOME & EXPENSES', margin, y, colW)
  y += 10
  const incomeRows = [
    ['Gross Potential Income', formatCurrency(data.gpi)],
    ['Vacancy Rate', formatPercent(data.vacancyRate)],
    ['Effective Gross Income', formatCurrency(data.gpi * (1 - data.vacancyRate))],
    ['Operating Expense Ratio', formatPercent(data.opexRatio)],
    ['Net Operating Income', formatCurrency(data.noi)],
    ['Loan Amount', formatCurrency(data.loanAmount)],
    ['Equity Invested', formatCurrency(data.equity)],
    ['Cash-on-Cash Return', formatPercent(data.cashOnCash)],
  ]
  incomeRows.forEach(([label, value], i) => {
    if (i % 2 === 0) {
      doc.setFillColor(...LIGHT)
      doc.rect(margin, y - 3, colW, 6, 'F')
    }
    dataRow(label, value, margin, y)
    y += 7
  })

  // Reset y for right column
  y = 54 + 42 + 10
  const rx = margin + colW + 5

  sectionHeader('DEAL DETAILS', rx, y - 10, colW)
  const detailRows = [
    ['Stage', data.stage.replace('_', ' ').toUpperCase()],
    ['Property Type', data.propertyType],
    ...(data.units ? [['Units', String(data.units)]] : []),
    ...(data.sf ? [['Square Feet', data.sf.toLocaleString()]] : []),
    ...(data.yearBuilt ? [['Year Built', String(data.yearBuilt)]] : []),
    ...(data.brokerName ? [['Broker', data.brokerName]] : []),
    ...(data.brokerEmail ? [['Broker Email', data.brokerEmail]] : []),
  ]
  detailRows.forEach(([label, value], i) => {
    if (i % 2 === 0) {
      doc.setFillColor(...LIGHT)
      doc.rect(rx, y - 3, colW, 6, 'F')
    }
    dataRow(label, value, rx, y)
    y += 7
  })

  // ── Notes ──
  if (data.notes) {
    y = Math.max(y, 170)
    sectionHeader('NOTES / INVESTMENT THESIS', margin, y, W - margin * 2)
    y += 9
    doc.setTextColor(...NAVY)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(data.notes, W - margin * 2 - 6)
    doc.text(lines, margin + 3, y)
  }

  // ── Footer ──
  doc.setFillColor(...NAVY)
  doc.rect(0, 270, W, 10, 'F')
  doc.setTextColor(...MUTED)
  doc.setFontSize(7)
  doc.text('Confidential — ARDON Insights  ·  For internal use only', margin, 276)
  doc.text('ardoninsights.com', W - margin, 276, { align: 'right' })

  doc.save(`${data.propertyName.replace(/\s+/g, '_')}_Deal_OnePager.pdf`)
}

export async function exportDealMemo(elementId: string, filename: string): Promise<void> {
  const { default: html2canvas } = await import('html2canvas')
  const element = document.getElementById(elementId)
  if (!element) return

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#0F172A',
  })

  const imgData = canvas.toDataURL('image/png')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const W = 215.9
  const H = (canvas.height * W) / canvas.width

  doc.addImage(imgData, 'PNG', 0, 0, W, H)
  doc.save(filename)
}
