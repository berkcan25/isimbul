import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { useLikes } from '../context/LikesContext';
import { namesData } from '../data';
import {
  Search,
  ArrowUpRight,
  ArrowRight,
  ArrowDownRight,
  ArrowLeft,
  Heart,
  BookOpen,
  X,
} from 'lucide-react';
import SearchableSelect from '../components/SearchableSelect';
import { getNameMetrics, normalizeSearch, formatRankNum } from '../utils/nameHelpers';

export default function NameList() {
  const { t, lang } = useTranslation();
  const { isLiked, toggleLike } = useLikes();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [showLikedOnly, setShowLikedOnly] = useState(false);
  const [sortBy, setSortBy] = useState('bestRank');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  const [filters, setFilters] = useState({
    gender: 'all',
    origin: 'all',
    cluster: 'all',
    isQuranic: false,
  });

  const processedData = useMemo(
    () => namesData.map((n) => getNameMetrics(n, lang)),
    [lang]
  );

  const uniqueOrigins = useMemo(() => {
    const allOrigins = namesData.map((n) => n.Etymology).flat().filter(Boolean);
    return [...new Set(allOrigins)].sort((a, b) => a.localeCompare(b, lang));
  }, [lang]);

  const uniqueClusters = useMemo(
    () => [...new Set(namesData.map((n) => n.clusterName).filter(Boolean))].sort(),
    []
  );

  const filteredData = useMemo(() => {
    const q = normalizeSearch(search);
    return processedData
      .filter((n) => {
        if (q) {
          const hit =
            normalizeSearch(n.Name).includes(q) ||
            normalizeSearch(n.currentMeaning).includes(q) ||
            n.etymologies.some((e) => normalizeSearch(e).includes(q));
          if (!hit) return false;
        }
        if (filters.gender !== 'all' && n.gender !== filters.gender) return false;
        if (filters.origin !== 'all' && !n.etymologies.includes(filters.origin)) return false;
        if (filters.cluster !== 'all' && n.clusterName !== filters.cluster) return false;
        if (filters.isQuranic && !n.Is_Quranic) return false;
        if (showLikedOnly && !isLiked(n.Name)) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'bestRank') return a.bestRank - b.bestRank;
        if (sortBy === 'totalCount') return b.totalCount - a.totalCount;
        return a.Name.localeCompare(b.Name, 'tr');
      });
  }, [processedData, search, filters, showLikedOnly, isLiked, sortBy]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filters, showLikedOnly, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredData.slice(start, start + PAGE_SIZE);
  }, [filteredData, currentPage]);

  const renderTrend = (trend) => {
    if (trend === 'up') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[#B84A32] dark:text-[#DF735B]">
          <ArrowUpRight className="w-3.5 h-3.5" /> {t.trendUp}
        </span>
      );
    }
    if (trend === 'steady') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[#536B58] dark:text-[#8FB096]">
          <ArrowRight className="w-3.5 h-3.5" /> {t.trendSteady}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[#6E675E] dark:text-[#9A9287]">
        <ArrowDownRight className="w-3.5 h-3.5" /> {t.trendDown}
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-16 space-y-8 animate-fade-in">
      <div className="border-b border-[#161513] dark:border-[#443F37] pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#B84A32] dark:text-[#DF735B]">
            {t.atlasKicker}
          </p>
          <h1 className="font-editorial text-4xl sm:text-5xl font-medium text-[#161513] dark:text-[#F2EDE4] mt-1">
            {t.dashboard}
          </h1>
        </div>
        <div className="text-xs uppercase tracking-[0.12em] text-[#57524A] dark:text-[#A8A095] tabular-nums">
          <strong className="text-[#161513] dark:text-[#F2EDE4]">
            {filteredData.length.toLocaleString()}
          </strong>{' '}
          / {namesData.length.toLocaleString()} {t.results}
        </div>
      </div>

      {/* Filter Controls */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-5 flex items-center bg-[#FAF7F1] dark:bg-[#1D1B18] border border-[#D8D1C5] dark:border-[#332F29] focus-within:border-[#161513] dark:focus-within:border-[#F2EDE4]">
            <Search className="w-4 h-4 text-[#878075] ml-3.5 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.search}
              className="w-full px-3 py-2.5 bg-transparent text-sm text-[#161513] dark:text-[#F2EDE4] placeholder:text-[#878075] focus:outline-none"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="pr-3 text-[#878075]">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="lg:col-span-4 inline-flex border border-[#D8D1C5] dark:border-[#332F29] bg-[#FAF7F1] dark:bg-[#1D1B18]">
            {['all', 'female', 'male', 'unisex'].map((g, i) => (
              <button
                key={g}
                type="button"
                onClick={() => setFilters({ ...filters, gender: g })}
                className={`flex-1 py-2.5 text-xs font-medium uppercase tracking-[0.08em] transition-colors ${
                  i > 0 ? 'border-l border-[#D8D1C5] dark:border-[#332F29]' : ''
                } ${
                  filters.gender === g
                    ? 'bg-[#161513] text-[#FAF7F1] dark:bg-[#F2EDE4] dark:text-[#141311]'
                    : 'text-[#57524A] dark:text-[#A8A095] hover:text-[#161513] dark:hover:text-[#F2EDE4]'
                }`}
              >
                {g === 'all' ? t.all : t[g]}
              </button>
            ))}
          </div>

          <div className="lg:col-span-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full h-full px-3 py-2.5 bg-[#FAF7F1] dark:bg-[#1D1B18] border border-[#D8D1C5] dark:border-[#332F29] text-xs font-medium uppercase tracking-[0.06em] text-[#161513] dark:text-[#F2EDE4] focus:outline-none"
            >
              <option value="bestRank">{t.rank}</option>
              <option value="totalCount">{t.count}</option>
              <option value="Name">{t.name} (A–Z)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end border-b border-[#D8D1C5] dark:border-[#332F29] pb-5">
          <SearchableSelect
            label={t.filter_origin}
            allLabel={t.all}
            options={uniqueOrigins}
            value={filters.origin}
            onChange={(val) => setFilters({ ...filters, origin: val })}
          />
          <SearchableSelect
            label={t.meaning}
            allLabel={t.all}
            options={uniqueClusters}
            value={filters.cluster}
            onChange={(val) => setFilters({ ...filters, cluster: val })}
          />
          <button
            type="button"
            onClick={() => setFilters({ ...filters, isQuranic: !filters.isQuranic })}
            className={`h-[42px] px-3 border text-xs font-medium uppercase tracking-[0.08em] inline-flex items-center justify-center gap-2 transition-colors ${
              filters.isQuranic
                ? 'bg-[#536B58] border-[#536B58] text-[#FAF7F1]'
                : 'bg-[#FAF7F1] dark:bg-[#1D1B18] border-[#D8D1C5] dark:border-[#332F29] text-[#57524A] dark:text-[#A8A095]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{t.filter_quranic}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowLikedOnly((v) => !v)}
            className={`h-[42px] px-3 border text-xs font-medium uppercase tracking-[0.08em] inline-flex items-center justify-center gap-2 transition-colors ${
              showLikedOnly
                ? 'bg-[#B84A32] border-[#B84A32] text-[#FAF7F1]'
                : 'bg-[#FAF7F1] dark:bg-[#1D1B18] border-[#D8D1C5] dark:border-[#332F29] text-[#57524A] dark:text-[#A8A095]'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${showLikedOnly ? 'fill-current' : ''}`} />
            <span>{t.favorites}</span>
          </button>
        </div>
      </div>

      {/* Desktop Editorial Index */}
      <div className="hidden md:block">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#161513] dark:border-[#443F37] text-[11px] font-medium uppercase tracking-[0.12em] text-[#57524A] dark:text-[#A8A095]">
              <th className="py-3 pr-4">{t.name}</th>
              <th className="py-3 px-4">{t.meaning} & {t.origin}</th>
              <th className="py-3 px-4">{t.gender}</th>
              <th className="py-3 px-4 text-right">{t.rank}</th>
              <th className="py-3 px-4 text-right">{t.count}</th>
              <th className="py-3 px-4">{t.trajectory}</th>
              <th className="py-3 pl-4 text-right">{t.save}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D8D1C5] dark:divide-[#2C2823]">
            {paginatedData.map((item) => (
              <tr
                key={item.Name}
                onClick={() => navigate(`/name/${encodeURIComponent(item.Name)}`)}
                className="group cursor-pointer hover:bg-[#EAE4D8]/70 dark:hover:bg-[#1D1B18] transition-colors"
              >
                <td className="py-4 pr-4">
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-editorial text-2xl font-medium text-[#161513] dark:text-[#F2EDE4] group-hover:text-[#B84A32] dark:group-hover:text-[#DF735B] transition-colors">
                      {item.Name}
                    </span>
                    {item.Is_Quranic && (
                      <span className="text-[10px] uppercase tracking-[0.1em] text-[#536B58] dark:text-[#8FB096]">
                        {t.isQuranic}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-4 px-4 max-w-sm">
                  <p className="text-sm text-[#161513] dark:text-[#E5DFD5] truncate">
                    {item.currentMeaning || <span className="italic text-[#878075]">{t.noMeaning}</span>}
                  </p>
                  <span className="text-[11px] uppercase tracking-[0.08em] text-[#878075]">
                    {item.etymologies.join(' / ') || '—'}
                  </span>
                </td>
                <td className="py-4 px-4 text-xs uppercase tracking-[0.08em] text-[#57524A] dark:text-[#A8A095]">
                  {t[item.gender]}
                </td>
                <td className="py-4 px-4 text-right font-editorial text-lg font-medium tabular-nums">
                  #{formatRankNum(item.bestRank)}
                </td>
                <td className="py-4 px-4 text-right text-sm text-[#57524A] dark:text-[#A8A095] tabular-nums">
                  {item.totalCount.toLocaleString()}
                </td>
                <td className="py-4 px-4">{renderTrend(item.trend)}</td>
                <td className="py-4 pl-4 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLike(item.Name);
                      }}
                      className={`p-1 ${
                        isLiked(item.Name)
                          ? 'text-[#B84A32] dark:text-[#DF735B]'
                          : 'text-[#878075] hover:text-[#161513] dark:hover:text-[#F2EDE4]'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${isLiked(item.Name) ? 'fill-current' : ''}`} />
                    </button>
                    <ArrowUpRight className="w-4 h-4 text-[#B84A32] opacity-0 group-hover:opacity-100 transition-all" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Compact Two-Line Entries */}
      <div className="md:hidden divide-y divide-[#D8D1C5] dark:divide-[#2C2823] border-y border-[#D8D1C5] dark:border-[#2C2823]">
        {paginatedData.map((item) => (
          <div
            key={item.Name}
            onClick={() => navigate(`/name/${encodeURIComponent(item.Name)}`)}
            className="py-3.5 flex items-center justify-between gap-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="font-editorial text-2xl font-medium">{item.Name}</span>
                <span className="text-xs text-[#878075] tabular-nums">#{formatRankNum(item.bestRank)}</span>
                <span className="text-[11px] uppercase tracking-[0.08em] text-[#878075]">{t[item.gender]}</span>
              </div>
              <p className="text-xs text-[#57524A] dark:text-[#A8A095] truncate mt-0.5">
                {item.currentMeaning || t.noMeaning}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLike(item.Name);
                }}
                className={isLiked(item.Name) ? 'p-1.5 text-[#B84A32]' : 'p-1.5 text-[#878075]'}
              >
                <Heart className={`w-4 h-4 ${isLiked(item.Name) ? 'fill-current' : ''}`} />
              </button>
              <ArrowUpRight className="w-4 h-4 text-[#878075]" />
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-6 border-t border-[#D8D1C5] dark:border-[#332F29]">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => {
              setCurrentPage((p) => Math.max(1, p - 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium uppercase tracking-[0.1em] border border-[#161513] dark:border-[#443F37] disabled:opacity-35"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {t.page} {Math.max(1, currentPage - 1)}
          </button>
          <span className="text-xs uppercase tracking-[0.12em] text-[#57524A] dark:text-[#A8A095] tabular-nums">
            {t.page} {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => {
              setCurrentPage((p) => Math.min(totalPages, p + 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium uppercase tracking-[0.1em] border border-[#161513] dark:border-[#443F37] disabled:opacity-35"
          >
            {t.page} {Math.min(totalPages, currentPage + 1)} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}