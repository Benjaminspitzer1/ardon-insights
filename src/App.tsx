import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import AppShell from '@/components/layout/AppShell'
import AuthPage from '@/pages/AuthPage'
import DashboardPage from '@/pages/DashboardPage'
import DealFlowPage from '@/pages/DealFlowPage'
import PropertyPage from '@/pages/PropertyPage'
import UnderwritingPage from '@/pages/UnderwritingPage'
import MarketResearchPage from '@/pages/MarketResearchPage'
import DealInboxPage from '@/pages/DealInboxPage'
import SettingsPage from '@/pages/SettingsPage'
import PortfoliosPage from '@/pages/PortfoliosPage'
import PropertiesListPage from '@/pages/PropertiesListPage'
import NewPropertyPage from '@/pages/NewPropertyPage'
import NewsPage from '@/pages/NewsPage'
import DocumentsPage from '@/pages/DocumentsPage'
import SensitivityAnalysisPage from '@/pages/SensitivityAnalysisPage'
import CashFlowPage from '@/pages/CashFlowPage'
import FinancingPage from '@/pages/FinancingPage'
import OperatingExpensesPage from '@/pages/OperatingExpensesPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-teal border-t-transparent" /></div>
  if (!session) return <Navigate to="/auth" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <AppShell>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/portfolios" element={<PortfoliosPage />} />
                <Route path="/properties" element={<PropertiesListPage />} />
                <Route path="/new-property" element={<NewPropertyPage />} />
                <Route path="/deal-flow" element={<DealFlowPage />} />
                <Route path="/deal-flow/:dealId" element={<UnderwritingPage />} />
                <Route path="/properties/:propertyId" element={<PropertyPage />} />
                <Route path="/market-research" element={<MarketResearchPage />} />
                <Route path="/news" element={<NewsPage />} />
                <Route path="/documents" element={<DocumentsPage />} />
                <Route path="/sensitivity-analysis" element={<SensitivityAnalysisPage />} />
                <Route path="/deal-flow/:dealId/sensitivity" element={<SensitivityAnalysisPage />} />
                <Route path="/properties/:propertyId/sensitivity" element={<SensitivityAnalysisPage />} />
                <Route path="/cash-flow" element={<CashFlowPage />} />
                <Route path="/financing" element={<FinancingPage />} />
                <Route path="/operating-expenses" element={<OperatingExpensesPage />} />
                <Route path="/deal-inbox" element={<DealInboxPage />} />
                <Route path="/settings/*" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppShell>
          </RequireAuth>
        }
      />
    </Routes>
  )
}
