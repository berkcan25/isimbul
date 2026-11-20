import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { LanguageProvider, useTranslation } from './context/LanguageContext';
import { LikesProvider, useLikes } from './context/LikesContext';
import { namesData } from './data';
import { Sun, Moon, Shuffle, Menu, X } from 'lucide-react';

import BrandWordmark from './components/BrandWordmark';
import Home from './pages/Home';
import NameList from './pages/NameList';
import NameDetail from './pages/NameDetail';
import ClusterView from './pages/ClusterView';
import LikedNames from './pages/LikedNames';
import About from './pages/About';
import Games from './pages/Games';

function AppShell() {
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang, t } = useTranslation();
  const { likedNames } = useLikes();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const openRandom = () => {
    if (!namesData.length) return;
    const pick = namesData[Math.floor(Math.random() * namesData.length)];
    setMobileOpen(false);
    navigate(`/name/${encodeURIComponent(pick.Name)}`);
  };

  const navItems = [
    { to: '/', label: t.home, end: true },
    { to: '/list', label: t.dashboard },
    { to: '/graph', label: t.graph },
    { to: '/favorites', label: t.favorites, badge: likedNames.length },
    { to: '/games', label: t.games },
    { to: '/about', label: t.about },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F0E8] dark:bg-[#141311] text-[#161513] dark:text-[#F2EDE4] transition-colors duration-200">
      <header className="sticky top-0 z-40 bg-[#F4F0E8]/95 dark:bg-[#141311]/95 backdrop-blur-sm border-b border-[#D8D1C5] dark:border-[#2C2823]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <NavLink to="/" onClick={() => setMobileOpen(false)}>
            <BrandWordmark />
          </NavLink>

          <nav className="hidden md:flex items-center gap-7">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `text-xs font-medium uppercase tracking-[0.12em] py-1 transition-colors inline-flex items-center gap-1.5 ${
                    isActive
                      ? 'text-[#B84A32] dark:text-[#DF735B] border-b-2 border-[#B84A32] dark:border-[#DF735B]'
                      : 'text-[#57524A] dark:text-[#A8A095] hover:text-[#161513] dark:hover:text-[#F2EDE4]'
                  }`
                }
              >
                <span>{item.label}</span>
                {item.badge > 0 && (
                  <span className="tabular-nums text-[10px] font-semibold">({item.badge})</span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openRandom}
              title={t.random}
              className="p-2 text-[#57524A] dark:text-[#A8A095] hover:text-[#B84A32] transition-colors"
            >
              <Shuffle className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setLang(lang === 'tr' ? 'en' : 'tr')}
              className="text-xs font-semibold uppercase tracking-[0.12em] px-2.5 py-1 border border-[#D8D1C5] dark:border-[#332F29] hover:border-[#161513] dark:hover:border-[#F2EDE4] transition-colors"
            >
              {lang === 'tr' ? 'EN' : 'TR'}
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-2 text-[#57524A] dark:text-[#A8A095] hover:text-[#161513] dark:hover:text-[#F2EDE4] transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              className="md:hidden p-2"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-[#D8D1C5] dark:border-[#2C2823] bg-[#FAF7F1] dark:bg-[#1D1B18] px-4 py-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `block py-2.5 px-2 text-xs font-medium uppercase tracking-[0.14em] ${
                    isActive ? 'text-[#B84A32] font-semibold' : ''
                  }`
                }
              >
                {item.label} {item.badge > 0 ? `(${item.badge})` : ''}
              </NavLink>
            ))}
          </div>
        )}
      </header>

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/list" element={<NameList />} />
          <Route path="/name/:id" element={<NameDetail />} />
          <Route path="/graph" element={<ClusterView />} />
          <Route path="/favorites" element={<LikedNames />} />
          <Route path="/about" element={<About />} />
          <Route path="/games" element={<Games />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <LikesProvider>
          <BrowserRouter>
            <AppShell />
          </BrowserRouter>
        </LikesProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}