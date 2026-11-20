import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { useLikes } from '../context/LikesContext';
import { useTheme } from '../context/ThemeContext';
import { namesData } from '../data';
import { Search, ArrowUp, ArrowDown, Trash2, ArrowUpRight } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import SearchableSelect from '../components/SearchableSelect';
import { getNameMetrics, normalizeSearch, formatRankNum } from '../utils/nameHelpers';

const COMPARE_COLORS = ['#B84A32', '#3F556B', '#536B58', '#B88635', '#7A4E6D'];
const COMPARE_DASHES = ['', '6 3', '2 2', '8 3 2 3', '4 4'];

export default function LikedNames() {
  const { t, lang } = useTranslation();
  const { likedNames, toggleLike, moveLike } = useLikes();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ gender: 'all', origin: 'all' });

  const myNames = useMemo(() => {
    return likedNames
      .map((nameStr) => {
        const raw = namesData.find((d) => d.Name === nameStr);
        return raw ? getNameMetrics(raw, lang) : null;
      })
      .filter(Boolean);
  }, [likedNames, lang]);

  const filteredData = useMemo(() => {
    const q = normalizeSearch(search);
    return myNames.filter((n) => {
      if (q && !normalizeSearch(n.Name).includes(q)) return false;
      if (filters.gender !== 'all' && n.gender !== filters.gender) return false;
      if (filters.origin !== 'all' && !n.etymologies.includes(filters.origin)) return false;
      return true;
    });
  }, [myNames, search, filters]);

  const uniqueOrigins = useMemo(() => {
    const all = myNames.map((n) => n.etymologies).flat().filter(Boolean);
    return [...new Set(all)].sort();
  }, [myNames]);

  const compareItems = myNames.slice(0, 5);
  const compareChartData = useMemo(() => {
    if (compareItems.length < 2) return [];
    const eras = compareItems[0].eraData;
    return eras.map((era, idx) => {
      const row = { era: lang === 'tr' ? era.labelTr : era.labelEn };
      compareItems.forEach((item) => {
        row[item.Name] = item.eraData[idx]?.count || 0;
      });
      return row;
    });
  }, [compareItems, lang]);

  if (likedNames.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 animate-fade-in">
        <div className="max-w-xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#B84A32] dark:text-[#DF735B]">
            0 / {t.favorites}
          </p>
          <h1 className="font-editorial text-4xl sm:text-5xl font-medium mt-2">{t.noFavorites}</h1>
          <p className="text-sm sm:text-base text-[#57524A] dark:text-[#A8A095] mt-3 leading-relaxed">
            {t.addFavorites}
          </p>
          <Link
            to="/list"
            className="mt-6 inline-flex items-center gap-2 px-5 py-3 text-xs font-medium uppercase tracking-[0.12em] bg-[#161513] text-[#FAF7F1] dark:bg-[#F2EDE4] dark:text-[#141311] hover:bg-[#B84A32] transition-colors"
          >
            <span>{t.exploreAll}</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-16 space-y-10 animate-fade-in">
      <div className="border-b border-[#161513] dark:border-[#443F37] pb-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#B84A32] dark:text-[#DF735B] tabular-nums">
          {likedNames.length} / {t.favorites}
        </p>
        <h1 className="font-editorial text-4xl sm:text-5xl font-medium mt-1">{t.favorites}</h1>
        <p className="text-sm text-[#57524A] dark:text-[#A8A095] mt-2">{t.rankHelp}</p>
      </div>

      {/* Comparison Chart */}
      {compareItems.length >= 2 ? (
        <section className="border border-[#D8D1C5] dark:border-[#332F29] bg-[#FAF7F1] dark:bg-[#1D1B18] p-5 sm:p-7">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#B84A32] dark:text-[#DF735B]">
            {t.compareTitle}
          </p>
          <p className="text-xs text-[#57524A] dark:text-[#A8A095] mt-1 mb-5">{t.compareSub}</p>
          <div className="w-full h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={compareChartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid stroke={isDark ? '#2C2823' : '#E2DBD0'} vertical={false} />
                <XAxis dataKey="era" stroke={isDark ? '#9A9287' : '#6E675E'} fontSize={12} tickLine={false} />
                <YAxis stroke={isDark ? '#9A9287' : '#6E675E'} fontSize={12} tickLine={false} axisLine={false} width={52} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#1D1B18' : '#FAF7F1',
                    borderColor: isDark ? '#332F29' : '#D8D1C5',
                    borderRadius: '0px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                {compareItems.map((item, idx) => (
                  <Line
                    key={item.Name}
                    type="monotone"
                    dataKey={item.Name}
                    stroke={COMPARE_COLORS[idx % COMPARE_COLORS.length]}
                    strokeDasharray={COMPARE_DASHES[idx % COMPARE_DASHES.length]}
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : (
        <p className="text-sm text-[#57524A] dark:text-[#A8A095] border-l-2 border-[#B84A32] pl-4">
          {t.singleCompareHint}
        </p>
      )}

      {/* Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative flex items-center bg-[#FAF7F1] dark:bg-[#1D1B18] border border-[#D8D1C5] dark:border-[#332F29]">
          <Search className="w-4 h-4 text-[#878075] ml-3" />
          <input
            type="text"
            placeholder={t.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2.5 bg-transparent text-sm focus:outline-none"
          />
        </div>
        <SearchableSelect
          allLabel={t.all}
          options={[
            { value: 'female', label: t.female },
            { value: 'male', label: t.male },
            { value: 'unisex', label: t.unisex },
          ]}
          value={filters.gender}
          onChange={(val) => setFilters({ ...filters, gender: val })}
        />
        <SearchableSelect
          allLabel={t.all}
          options={uniqueOrigins}
          value={filters.origin}
          onChange={(val) => setFilters({ ...filters, origin: val })}
        />
      </div>

      {/* Rearrangeable List */}
      <div className="divide-y divide-[#D8D1C5] dark:divide-[#2C2823] border-y border-[#D8D1C5] dark:border-[#2C2823]">
        {filteredData.map((name) => {
          const realIndex = likedNames.indexOf(name.Name);
          return (
            <div
              key={name.Name}
              className="py-5 flex items-center justify-between gap-4 hover:bg-[#EAE4D8]/50 dark:hover:bg-[#1D1B18] px-2 transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <span
                  className="w-2.5 h-2.5 shrink-0"
                  style={{
                    backgroundColor:
                      realIndex < 5 ? COMPARE_COLORS[realIndex] : '#878075',
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-3">
                    <Link
                      to={`/name/${encodeURIComponent(name.Name)}`}
                      className="font-editorial text-3xl font-medium hover:text-[#B84A32] dark:hover:text-[#DF735B] transition-colors"
                    >
                      {name.Name}
                    </Link>
                    <span className="text-xs uppercase tracking-[0.1em] text-[#878075] tabular-nums">
                      #{formatRankNum(name.bestRank)} · {t[name.gender]} · {name.etymologies.join(' / ')}
                    </span>
                  </div>
                  <p className="text-sm text-[#57524A] dark:text-[#A8A095] truncate mt-1">
                    {name.currentMeaning || t.noMeaning}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => moveLike(realIndex, realIndex - 1)}
                  disabled={realIndex === 0 || search !== ''}
                  className="p-1.5 text-[#878075] hover:text-[#161513] dark:hover:text-[#F2EDE4] disabled:opacity-25"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveLike(realIndex, realIndex + 1)}
                  disabled={realIndex === likedNames.length - 1 || search !== ''}
                  className="p-1.5 text-[#878075] hover:text-[#161513] dark:hover:text-[#F2EDE4] disabled:opacity-25"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleLike(name.Name)}
                  className="p-1.5 text-[#878075] hover:text-[#B84A32]"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}