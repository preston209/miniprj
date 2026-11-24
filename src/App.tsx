import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ConciergeDrawer } from './components/ai/ConciergeDrawer.tsx';
import { Footer } from './components/layout/Footer.tsx';
import { Navbar } from './components/layout/Navbar.tsx';
import { TourBookingModal } from './components/public/TourBookingModal.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { AdminDashboardPage } from './pages/AdminDashboardPage.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { DiningPage } from './pages/DiningPage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { ResidentPortalPage } from './pages/ResidentPortalPage.tsx';
import { RoomsPage } from './pages/RoomsPage.tsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <div className="flex min-h-screen flex-col bg-[#f8fafc] text-slate-900">
            <Navbar />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/rooms" element={<RoomsPage />} />
                <Route path="/dining" element={<DiningPage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/resident" element={<ResidentPortalPage />} />
                <Route path="/admin" element={<AdminDashboardPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <Footer />
            <TourBookingModal />
            <ConciergeDrawer />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
