import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.tsx';

export function Footer() {
  const { openTourModal } = useAuth();

  return (
    <footer className="border-t border-slate-200 bg-white py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div>
          <p className="font-display text-base font-bold text-slate-900">
            HavenStay Koramangala Executive PG
          </p>
          <p className="mt-1 text-sm text-slate-500">
            No. 42, 80 Feet Road, Koramangala 4th Block, Bengaluru 560034 · concierge@havenstay.in
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-sm text-slate-600">
          <Link to="/rooms" className="hover:text-slate-900">
            Rooms &amp; Pricing
          </Link>
          <Link to="/dining" className="hover:text-slate-900">
            Weekly Menu
          </Link>
          <Link to="/resident" className="hover:text-slate-900">
            Resident Portal
          </Link>
          <Link to="/admin" className="hover:text-slate-900">
            Admin Console
          </Link>
          <button
            type="button"
            onClick={() => openTourModal()}
            className="font-medium text-[#0f766e] hover:underline cursor-pointer"
          >
            Book a Tour
          </button>
        </div>
      </div>
    </footer>
  );
}
