import { useState } from 'react'
import { Clock, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const MOCK_ARTICLES = [
  {
    id: '1',
    title: 'Fed Signals Rate Pause Amid CRE Debt Refinancing Pressure',
    category: 'Financing',
    date: '2026-03-07',
    description: 'The Federal Reserve held rates steady this week as commercial real estate borrowers face a wave of loan maturities in 2026, putting pressure on refinancing conditions.',
    source: 'Wall Street Journal',
    url: '#',
    image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=200&fit=crop',
  },
  {
    id: '2',
    title: 'Multifamily Rents Stabilize After Three Years of Volatility',
    category: 'Market Trends',
    date: '2026-03-06',
    description: 'National multifamily rents have plateaued, with Sun Belt markets seeing slight corrections while gateway cities hold steady heading into spring leasing season.',
    source: 'CoStar News',
    url: '#',
    image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&h=200&fit=crop',
  },
  {
    id: '3',
    title: 'Industrial REIT Earnings Beat Expectations on E-Commerce Demand',
    category: 'REITs',
    date: '2026-03-05',
    description: 'Major industrial REITs reported strong Q4 results, driven by persistent e-commerce logistics demand and persistent supply constraints in key distribution corridors.',
    source: 'Bloomberg',
    url: '#',
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&h=200&fit=crop',
  },
  {
    id: '4',
    title: 'Office Conversion Projects Accelerate in Major Metros',
    category: 'Commercial Real Estate',
    date: '2026-03-04',
    description: 'Cities are fast-tracking approvals for office-to-residential conversions as downtown vacancy rates remain elevated and municipalities seek new tax revenue strategies.',
    source: 'Bisnow',
    url: '#',
    image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=200&fit=crop',
  },
  {
    id: '5',
    title: 'New Opportunity Zone Regulations Expand Investment Criteria',
    category: 'Policy Changes',
    date: '2026-03-03',
    description: 'Treasury Department released updated guidance on Opportunity Zone investments, broadening eligible property types and extending the reinvestment window for qualifying gains.',
    source: 'Reuters',
    url: '#',
    image: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=200&fit=crop',
  },
  {
    id: '6',
    title: 'Single-Family Build-to-Rent Sector Attracts Institutional Capital',
    category: 'Residential',
    date: '2026-03-02',
    description: 'Institutional investors are increasing allocations to the build-to-rent sector as single-family rental demand outpaces supply in suburban growth markets.',
    source: 'GlobeSt',
    url: '#',
    image: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=400&h=200&fit=crop',
  },
  {
    id: '7',
    title: 'Cap Rate Compression Expected in Sun Belt Multifamily in 2026',
    category: 'Market Trends',
    date: '2026-03-01',
    description: 'Analysts project cap rate compression of 25-50 bps in select Sun Belt multifamily markets as declining interest rates improve deal economics and buyer demand returns.',
    source: 'Marcus & Millichap',
    url: '#',
    image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=200&fit=crop',
  },
  {
    id: '8',
    title: 'CMBS Issuance Recovers as Spreads Tighten Through Q1',
    category: 'Financing',
    date: '2026-02-28',
    description: 'Commercial mortgage-backed securities issuance is recovering as credit spreads tighten and investor appetite for structured CRE debt returns to pre-2023 levels.',
    source: 'Commercial Observer',
    url: '#',
    image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=200&fit=crop',
  },
]

const CATEGORIES = ['All', 'Market Trends', 'Commercial Real Estate', 'Residential', 'REITs', 'Financing', 'Policy Changes']

const BADGE_VARIANTS: Record<string, 'teal' | 'purple' | 'success' | 'warning' | 'danger' | 'secondary'> = {
  'Financing': 'purple',
  'Market Trends': 'teal',
  'REITs': 'success',
  'Residential': 'warning',
  'Policy Changes': 'danger',
  'Commercial Real Estate': 'secondary',
}

export default function NewsPage() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')

  const filtered = MOCK_ARTICLES.filter(a => {
    const matchesCategory = activeCategory === 'All' || a.category === activeCategory
    const q = search.toLowerCase()
    const matchesSearch = !q || a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.source.toLowerCase().includes(q)
    return matchesCategory && matchesSearch
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Real Estate News</h1>
          <p className="text-sm text-muted-foreground">Stay updated with the latest real estate market news and insights</p>
        </div>
        <Button variant="outline" className="gap-2">
          <TrendingUp className="h-4 w-4" />
          Refresh News
        </Button>
      </div>

      <Input
        placeholder="Search news articles..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'rounded-full px-4 py-1 text-sm font-medium transition-colors',
              activeCategory === cat
                ? 'bg-brand-teal text-white'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No articles match your search.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(article => (
            <Card key={article.id} className="flex flex-col overflow-hidden">
              <img
                src={article.image}
                alt={article.title}
                className="h-40 w-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <CardContent className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-center gap-2">
                  <Badge variant={BADGE_VARIANTS[article.category] ?? 'secondary'} className="text-xs">
                    {article.category}
                  </Badge>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {article.date}
                  </span>
                </div>
                <p className="line-clamp-2 font-semibold leading-snug">{article.title}</p>
                <p className="line-clamp-3 flex-1 text-sm text-muted-foreground">{article.description}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{article.source}</span>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-brand-teal-light hover:underline"
                  >
                    Read More →
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
