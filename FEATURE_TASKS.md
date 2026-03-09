# Ardon Insights — Feature Gap Tasks
_Based on full audit of: `preview--ardon-re-underwritting-and-portfolio-manager.lovable.app`_
_Compared against current `src/` codebase — March 2026_

---

## Summary

The Lovable app has **8 pages** and several features not yet present in Ardon Insights. Below is a prioritized, page-by-page task list ready to hand to an AI coding assistant.

---

## TASK 1 — Dashboard Page Enhancements (`src/pages/DashboardPage.tsx`)

The current dashboard shows 4 KPI cards + an active deal pipeline list. The Lovable app has a much richer **Portfolio Dashboard**. Replace/extend with the following:

### 1a. Update KPI Cards
Replace current cards (Total Properties, AUM, Active Deals, Deals Closed YTD) with:
- **Total Properties** — count of all properties
- **Total Portfolio Value** — sum of current_value across all properties (formatted as $0)
- **Average Cap Rate** — average cap rate across properties (formatted as 0.00%)
- **Best Performer** — name of property with highest IRR or cap rate; show "No properties yet" if empty

### 1b. Add Portfolio Performance Chart Section
Below KPI cards, add a card titled **"Portfolio Performance"** with 3 tab views:
- **NOI Trend** — Line chart with two lines: "Actual NOI" and "Expected NOI", X-axis = months (Jan–Dec), Y-axis = $ values
- **Monthly Comparison** — Bar chart comparing current vs prior year monthly NOI
- **Property Type Mix** — Pie/donut chart showing breakdown by property type (Multifamily, Office, Retail, Industrial, etc.)

### 1c. Add Investment Metrics Comparison Chart
Add a grouped bar chart card titled **"Investment Metrics Comparison"** showing per-property bars for:
- IRR (%)
- Equity Multiple
- Cap Rate (%)

### 1d. Add Risk vs Return Matrix
Add a scatter plot card titled **"Risk vs Return Matrix"** with:
- X-axis: Risk Score (0–10)
- Y-axis: Expected Return (%)
- Color-coded dots by category: Low Risk/High Return (green), Balanced (blue), Moderate (yellow), High Risk/Low Return (red)
- Legend for the 4 categories

### 1e. Add Scenario Analysis Section
Add a card titled **"Scenario Analysis"** with 2 tabs:
- **By Property** — show scenario outcomes (Bull/Base/Bear) per individual property
- **Portfolio Scenarios** — show aggregated portfolio-level scenario outcomes

### 1f. Replace Deal Pipeline with Recent Properties
Replace the "Active Deal Pipeline" section with a **"Recent Properties"** section:
- Show the 4–6 most recently added properties as cards
- Each card shows property name, city/state, type, purchase price, cap rate
- "View All Properties →" link to `/properties`
- Empty state with "Add Your First Property" CTA button

---

## TASK 2 — New Page: Portfolios (`src/pages/PortfoliosPage.tsx`)

Create a new page at route `/portfolios` for managing named portfolio groups.

### Features:
- Page title: "Portfolios"
- **"+ New Portfolio"** button (top right) — opens a modal/dialog with: Portfolio Name, Description, optional notes
- List/grid of portfolio cards — each showing: Portfolio Name, number of properties, total value, date created
- Empty state: "No portfolios yet" + "Create Your First Portfolio" CTA button
- Clicking a portfolio card navigates to a portfolio detail view showing its properties

### AppShell nav:
Add **"Portfolios"** nav item (icon: `Briefcase` or `FolderOpen`) linking to `/portfolios`

### Router:
Add `<Route path="/portfolios" element={<PortfoliosPage />} />` in `App.tsx`

---

## TASK 3 — New Page: Properties Listing (`src/pages/PropertiesListPage.tsx`)

Create a new properties listing page at `/properties` (separate from the existing `/properties/:propertyId` detail page).

### Features:
- Page title: "Property Portfolio"
- **"+ New Property"** button (top right) — navigates to `/new-property`
- Grid or table of all properties, each card/row showing: name, address, type, purchase price, current value, cap rate, NOI
- Search bar to filter by name/address/city
- Empty state: "No properties yet" + "Add Your First Property" CTA

### New Property Form (`src/pages/NewPropertyPage.tsx`) at `/new-property`:
Full form with two sections:

**Property Information:**
- Property Name
- Address
- City, State, Zip Code (3-column row)
- Property Type (dropdown: Multifamily, Office, Retail, Industrial, Mixed Use, Land)
- Purchase Price ($)
- Current Value ($)
- Square Feet
- Units
- Year Built

**Financial Information:**

_Income:_
- Gross Rental Income (Annual $)
- Other Income (Annual $) — placeholder "Parking, laundry, etc."
- Vacancy Rate (%) — default 5

_Operating Expenses:_
- Property Taxes (Annual $)
- Insurance (Annual $)
- Property Management (Annual $)
- Maintenance & Repairs (Annual $)

Cancel / Save buttons at top right.

### Router:
- Add `<Route path="/properties" element={<PropertiesListPage />} />`
- Add `<Route path="/new-property" element={<NewPropertyPage />} />`
- Update AppShell nav to include **"Properties"** linking to `/properties`

---

## TASK 4 — Market Data Page Overhaul (`src/pages/MarketResearchPage.tsx`)

Rename/expand the existing Market Research page into a full **Market Data** page.

### Tab Structure:
Add a 2-tab layout at the top of the page:
- **Public Markets** (default active)
- **Comparable Transactions**

### Tab 1 — Public Markets:
Keep existing rate cards and charts, plus add:

**Market Indices Table** (new card at top):
- Title: "Market Indices" / subtitle: "Real-time major market index values"
- Table columns: Index | Value | Change | % Change
- Rows: S&P 500, Dow Jones, NASDAQ, Russell 2000, VIX
- Change column: green with ↑ arrow for positive, red with ↓ arrow for negative

**Market Performance YTD Chart** (new card):
- Bar or line chart showing YTD performance across the major indices

**Treasury Yields** (new card, side-by-side with Mortgage Rates):
- Line chart: X-axis = term (1mo, 3mo, 6mo, 1yr, 2yr, 5yr, 10yr, 20yr, 30yr), Y-axis = rate %
- Table below chart: Term | Rate | Change (with color-coded change)
- Rows: 2-Year, 5-Year, 10-Year, 30-Year

**Mortgage Rates** (new card, side-by-side with Treasury Yields):
- Area chart: X-axis = months, Y-axis = rate %
- Table below chart: Type | Rate | Change | Last Updated
- Rows: 30-Year Fixed, 15-Year Fixed, 5/1 ARM, 7/1 ARM

**"Refresh Data"** button (top right of page).

### Tab 2 — Comparable Transactions:
- Title: "Comparable Transactions" / subtitle: "Recent deal data for comparable properties"
- Table columns: Date | Property | Location | Price | Size (sq ft) | Price/sq ft | Cap Rate
- **"+ Add New Transaction"** button below table that opens a form/modal

---

## TASK 5 — New Page: Real Estate News (`src/pages/NewsPage.tsx`)

Create a new news page at `/news`.

### Features:
- Page title: "Real Estate News" / subtitle: "Stay updated with the latest real estate market news and insights"
- **"Refresh News"** button (top right) with trending-up icon
- **Search bar**: "Search news articles..."
- **Category filter tabs**: All | Market Trends | Commercial Real Estate | Residential | REITs | Financing | Policy Changes
- **3-column card grid** — each card contains:
  - Hero image (thumbnail)
  - Article title (bold, 2 lines max)
  - Category badge (colored pill) + date (with clock icon)
  - Short description (2–3 lines)
  - Source name (bottom left, muted text)
  - **"Read More →"** button/link (bottom right, opens in new tab)
- Clicking a category tab filters the visible cards

### Data:
Use mock/static article data or fetch from a news API (GNews, NewsAPI, etc. via a Supabase Edge Function). Include at least 6 sample articles across all categories.

### Router:
- Add `<Route path="/news" element={<NewsPage />} />`
- Add **"News"** to AppShell nav (icon: `Newspaper`)

---

## TASK 6 — New Page: Documents (`src/pages/DocumentsPage.tsx`)

Create a new documents page at `/documents`.

### Features:
- Page title: "Documents"
- **"+ Upload Document"** button (top right)
- **Search bar**: "Search documents..."
- **"All Types"** dropdown filter (options: All Types, PDF, Excel, Word, Image, Other)
- **Tabs**: All Documents (count) | Recent | AI Extracted
- Document cards or table rows showing: filename, type icon, upload date, size, associated property (if any)
- **Empty state**: document icon + "No documents found" + "Get started by uploading your first document" + Upload button
- Upload functionality: click button or drag-and-drop file input; store in Supabase Storage

### Router:
- Add `<Route path="/documents" element={<DocumentsPage />} />`
- Add **"Documents"** to AppShell nav (icon: `FileText`)

---

## TASK 7 — New Page: Sensitivity Analysis (`src/pages/SensitivityAnalysisPage.tsx`)

Create a dedicated full-page sensitivity analysis at `/sensitivity-analysis`. (Note: `IRRSensitivityMatrix.tsx` component already exists — incorporate it here.)

### Section 1 — Key Parameter Adjustments:
Card with 3 interactive **range sliders**:
- **Exit Cap Rate (%)** — range 3.0%–12.0%, step 0.25, default 6.5%
- **Annual Rent Growth (%)** — range 0%–10%, step 0.5, default 3.0%
- **Vacancy Rate (%)** — range 0%–25%, step 0.5, default 5.0%
- Each slider shows its current value on the right side
- Changing sliders updates the charts below in real time

### Section 2 — Scenario Analysis (3 tabs):

**Tab 1 — IRR Analysis:**
- Multi-line chart
- X-axis: Exit Cap Rate (5.50%–7.50%)
- Y-axis: IRR (%)
- One line per rent growth scenario: 1%, 2%, 3%, 4%, 5%
- Legend: "Rent Growth 1%" through "Rent Growth 5%"

**Tab 2 — Sensitivity Table:**
- Matrix/grid table
- Rows: Exit Cap Rate values (5.50%, 5.75%, 6.00%, 6.25%, 6.50%, 6.75%, 7.00%, 7.25%, 7.50%)
- Columns: Rent Growth scenarios (1% Growth, 2% Growth, 3% Growth, 4% Growth, 5% Growth)
- Each cell = calculated IRR %
- Color-code cells: green for high IRR, yellow for moderate, red for low

**Tab 3 — Custom Scenario:**
- Dual-axis line chart
- X-axis: Annual Rent Growth (1%–5%)
- Left Y-axis: IRR (%)
- Right Y-axis: Equity Multiple
- Two lines: IRR (blue/purple) and Equity Multiple (green)
- Tooltip on hover showing both values

### Router:
- Add `<Route path="/sensitivity-analysis" element={<SensitivityAnalysisPage />} />`
- Add **"Sensitivity"** to AppShell nav (icon: `TrendingUp`)

---

## TASK 8 — Settings Security Tab

Update `src/pages/SettingsPage.tsx` — the Security tab currently shows "Coming Soon".

### Implement Change Password form:
- Section title: "Change Password" / subtitle: "Update your password to keep your account secure."
- Fields:
  - Current Password (password input)
  - New Password (password input)
  - Confirm New Password (password input)
- **"Change Password"** button
- On submit: call `supabase.auth.updateUser({ password: newPassword })` after verifying current password matches and new passwords match
- Show success/error toast feedback

---

## TASK 9 — AppShell Navigation Update (`src/components/layout/AppShell.tsx`)

Update `NAV_ITEMS` array to include all new pages in this order:

```ts
const NAV_ITEMS = [
  { href: '/',                    icon: LayoutDashboard, label: 'My Portfolio' },
  { href: '/portfolios',          icon: FolderOpen,      label: 'Portfolios' },
  { href: '/properties',          icon: Building2,       label: 'Properties' },
  { href: '/deal-flow',           icon: Briefcase,       label: 'Deals' },
  { href: '/market-research',     icon: BarChart3,       label: 'Market Data' },
  { href: '/news',                icon: Newspaper,       label: 'News' },
  { href: '/documents',           icon: FileText,        label: 'Documents' },
  { href: '/sensitivity-analysis',icon: TrendingUp,      label: 'Sensitivity' },
  { href: '/deal-inbox',          icon: Mail,            label: 'Deal Inbox' },
  { href: '/settings',            icon: Settings,        label: 'Settings' },
]
```

Import any new icons from `lucide-react` as needed (`Newspaper`, `FolderOpen`).

---

## TASK 10 — Dark Mode Toggle in Header

The Lovable app has a dark/light mode toggle button (moon/sun icon) in the top-right header bar.

Add a header bar to `AppShell.tsx` above the main content area with:
- App name / breadcrumb (left side)
- Dark mode toggle button using a moon/sun icon (right side)
- User avatar/profile button (right side, next to dark mode toggle)

Wire the toggle to switch between light and dark Tailwind class on the root `<html>` element.

---

## Priority Order

| Priority | Task | Effort |
|----------|------|--------|
| 1 | Task 9 — Nav update | Low |
| 2 | Task 5 — News page | Medium |
| 3 | Task 3 — Properties listing + New Property form | Medium |
| 4 | Task 4 — Market Data overhaul | Medium |
| 5 | Task 7 — Sensitivity Analysis page | Medium |
| 6 | Task 1 — Dashboard enhancements | High |
| 7 | Task 6 — Documents page | Medium |
| 8 | Task 2 — Portfolios page | Medium |
| 9 | Task 8 — Settings Security tab | Low |
| 10 | Task 10 — Dark mode toggle | Low |
