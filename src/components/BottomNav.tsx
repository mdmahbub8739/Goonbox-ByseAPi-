import { NavLink } from 'react-router-dom';
import { Home, Sparkles, Flame, LayoutGrid, Clock, Zap } from 'lucide-react';
import clsx from 'clsx';

export function BottomNav() {
  const navItems = [
    { to: '/', label: 'For You', icon: Sparkles },
    { to: '/home', label: 'Home', icon: Home },
    { to: '/latest', label: 'New Release', icon: Zap },
    { to: '/trending', label: 'Trending', icon: Flame },
    { to: '/categories', label: 'Explore', icon: LayoutGrid },
    { to: '/history', label: 'History', icon: Clock },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-[48px] bg-[#0c0c0e]/95 backdrop-blur-2xl border-t border-white/[0.08] flex justify-around items-center z-50 px-1 pb-[env(safe-area-inset-bottom)] shadow-xl">
      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink 
          key={to}
          to={to} 
          className={({ isActive }) => clsx(
            "relative flex flex-col items-center justify-center gap-0.5 text-[9.5px] font-semibold flex-1 h-[40px] rounded-lg transition-all duration-200 active:scale-95",
            isActive 
              ? "text-white" 
              : "text-[#71717a] hover:text-[#d4d4d8]"
          )}
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute inset-x-2 inset-y-1 bg-white/[0.08] rounded-lg border border-white/10 shadow-sm animate-fadeIn" />
              )}
              <Icon className={clsx("w-4 h-4 transition-transform duration-150 relative z-10", isActive && "text-[#ff0033] scale-105")} />
              <span className={clsx("tracking-tight whitespace-nowrap relative z-10", isActive ? "text-[#f4f4f5] font-bold" : "text-[#71717a]")}>
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

