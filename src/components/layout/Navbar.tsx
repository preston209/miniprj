import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.tsx';
import { Button } from '../ui/primitives.tsx';

export function Navbar() {
  const { user, logout, openTourModal } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinkClass = (path: string) =>
    `hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
      location.pathname === path ? 'text-[#0f766e] font-semibold' : ''
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <Link
          to="/"
          className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          HavenStay
        </Link>

        {/* Zone 2: 4-5 Single-line Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
          <Link to="/" className={navLinkClass('/')}>
            Overview
          </Link>
          <Link to="/rooms" className={navLinkClass('/rooms')}>
            Rooms
          </Link>
          <Link to="/dining" className={navLinkClass('/dining')}>
            Dining
          </Link>
          {user && (user.role === 'resident' || user.role === 'admin') && (
            <Link to="/resident" className={navLinkClass('/resident')}>
              Resident Portal
            </Link>
          )}
          {user && user.role === 'admin' && (
            <Link to="/admin" className={navLinkClass('/admin')}>
              Admin
            </Link>
          )}
          {!user ? (
            <Link to="/auth" className={navLinkClass('/auth')}>
              Sign In
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => logout()}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Sign Out
            </button>
          )}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <Button
            size="sm"
            onClick={() => openTourModal()}
            className="hidden sm:inline-flex"
          >
            Schedule Tour
          </Button>
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex md:hidden items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3 text-sm font-medium text-slate-700">
            <Link to="/" onClick={() => setMobileOpen(false)} className="py-1.5">
              Overview
            </Link>
            <Link to="/rooms" onClick={() => setMobileOpen(false)} className="py-1.5">
              Rooms
            </Link>
            <Link to="/dining" onClick={() => setMobileOpen(false)} className="py-1.5">
              Dining
            </Link>
            {user && (user.role === 'resident' || user.role === 'admin') && (
              <Link to="/resident" onClick={() => setMobileOpen(false)} className="py-1.5">
                Resident Portal
              </Link>
            )}
            {user && user.role === 'admin' && (
              <Link to="/admin" onClick={() => setMobileOpen(false)} className="py-1.5">
                Admin
              </Link>
            )}
            {!user ? (
              <Link to="/auth" onClick={() => setMobileOpen(false)} className="py-1.5">
                Sign In
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  logout();
                }}
                className="py-1.5 text-left text-red-600"
              >
                Sign Out ({user.name})
              </button>
            )}
            <Button
              onClick={() => {
                setMobileOpen(false);
                openTourModal();
              }}
              className="mt-1 w-full"
            >
              Schedule Tour
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
