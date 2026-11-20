import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import data from '../data.json';
const { namesData } = data;
import { useTranslation } from '../context/LanguageContext';
import { useLikes } from '../context/LikesContext';
import { useTheme } from '../context/ThemeContext';
import { Search, X, ArrowUpRight, Heart, Shuffle } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { getNameMetrics, normalizeSearch, formatRankNum } from '../utils/nameHelpers';

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function Home() {
  const { t, lang } = useTranslation();
  const { isLiked, toggleLike } = useLikes();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [featuredIdx, setFeaturedIdx] = useState(0);
  const [prevFeaturedIdx, setPrevFeaturedIdx] = useState(null);
  const [transitionStage, setTransitionStage] = useState('idle');
  const [featuredPaused, setFeaturedPaused] = useState(false);

  const enriched = useMemo(
    () => namesData.map((n) => getNameMetrics(n, lang)),
    [lang]
  );

  // Common rising names balanced across Female, Male, and Unisex
  const { featuredPool, spotlightNames } = useMemo(() => {
    const byCommon = (a, b) => b.totalCount - a.totalCount || a.bestRank - b.bestRank;
    const rising = enriched.filter((n) => n.trend === 'up').sort(byCommon);
    const fallback = enriched.filter((n) => n.trend !== 'up').sort(byCommon);

    const buckets = {
      female: rising.filter((n) => n.gender === 'female'),
      male: rising.filter((n) => n.gender === 'male'),
      unisex: rising.filter((n) => n.gender === 'unisex'),
    };

    const balanced = [];
    const seen = new Set();
    let idx = 0;
    while (balanced.length < 12 && (buckets.female[idx] || buckets.male[idx] || buckets.unisex[idx])) {
      for (const g of ['female', 'male', 'unisex']) {
        if (balanced.length >= 12) break;
        const c = buckets[g][idx];
        if (c && !seen.has(c.Name)) {
          balanced.push(c);
          seen.add(c.Name);
        }
      }
      idx++;
    }
    for (const c of [...rising, ...fallback]) {
      if (balanced.length >= 12) break;
      if (!seen.has(c.Name)) {
        balanced.push(c);
        seen.add(c.Name);
      }
    }

    return {
      featuredPool: balanced.slice(0, 6),
      spotlightNames: balanced.length >= 12 ? balanced.slice(6, 12) : balanced.slice(0, 6),
    };
  }, [enriched]);

  // Balanced Female / Male / Unisex marquee (most common + random mix)
  const marqueeNames = useMemo(() => {
    const byPop = (a, b) => b.totalCount - a.totalCount;
    const buckets = {
      female: enriched.filter((n) => n.gender === 'female').sort(byPop),
      male: enriched.filter((n) => n.gender === 'male').sort(byPop),
      unisex: enriched.filter((n) => n.gender === 'unisex').sort(byPop),
    };
    const quotas = { female: 9, male: 9, unisex: 6 };
    const picked = { female: [], male: [], unisex: [] };

    ['female', 'male', 'unisex'].forEach((g) => {
      const list = buckets[g];
      const target = Math.min(quotas[g], list.length);
      const popCount = Math.round(target * 0.67);
      const top = list.slice(0, popCount);
      const rand = shuffleArray(list.slice(popCount)).slice(0, target - popCount);
      picked[g] = shuffleArray([...top, ...rand]);
    });

    const interleaved = [];
    const maxLen = Math.max(picked.female.length, picked.male.length, picked.unisex.length);
    for (let i = 0; i < maxLen; i++) {
      if (picked.female[i]) interleaved.push(picked.female[i]);
      if (picked.male[i]) interleaved.push(picked.male[i]);
      if (picked.unisex[i]) interleaved.push(picked.unisex[i]);
    }
    return interleaved;
  }, [enriched]);

  // Sequential whoosh cycle (exit finishes before enter begins)
  useEffect(() => {
    if (featuredPaused || featuredPool.length <= 1 || transitionStage !== 'idle') return;
    const timer = setInterval(() => {
      setFeaturedIdx((prev) => {
        setPrevFeaturedIdx(prev);
        setTransitionStage('exiting');
        return (prev + 1) % featuredPool.length;
      });
    }, 4800);
    return () => clearInterval(timer);
  }, [featuredPaused, featuredPool.length, transitionStage]);

  useEffect(() => {
    if (transitionStage !== 'exiting') return;
    const exitTimer = setTimeout(() => {
      setPrevFeaturedIdx(null);
      setTransitionStage('entering');
    }, 380);
    return () => clearTimeout(exitTimer);
  }, [transitionStage]);

  useEffect(() => {
    if (transitionStage !== 'entering') return;
    const enterTimer = setTimeout(() => setTransitionStage('idle'), 440);
    return () => clearTimeout(enterTimer);
  }, [transitionStage]);

  const featuredEntry = featuredPool[featuredIdx % Math.max(1, featuredPool.length)] || enriched[0];
  const prevFeaturedEntry =
    prevFeaturedIdx !== null ? featuredPool[prevFeaturedIdx % Math.max(1, featuredPool.length)] : null;
  const activeDisplayEntry =
    transitionStage === 'exiting' && prevFeaturedEntry ? prevFeaturedEntry : featuredEntry;

  const quickMatches = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return [];
    return enriched
      .filter(
        (n) =>
          normalizeSearch(n.Name).includes(q) ||
          normalizeSearch(n.currentMeaning).includes(q) ||
          n.etymologies.some((e) => normalizeSearch(e).includes(q))
      )
      .slice(0, 6);
  }, [query, enriched]);

  const openRandom = () => {
    if (!namesData.length) return;
    const pick = namesData[Math.floor(Math.random() * namesData.length)];
    navigate(`/name/${encodeURIComponent(pick.Name)}`);
  };

  const spotlightThemes = [
    'bg-[#B84A32] text-[#FAF7F1] border-[#B84A32]',
    'bg-[#4E6553] text-[#FAF7F1] border-[#4E6553]',
    'bg-[#3F556B] text-[#FAF7F1] border-[#3F556B]',
    'bg-[#C4923D] text-[#161513] border-[#C4923D]',
    'bg-[#FAF7F1] dark:bg-[#1D1B18] text-[#161513] dark:text-[#F2EDE4] border-[#D8D1C5] dark:border-[#332F29]',
    'bg-[#22201D] dark:bg-[#282520] text-[#F2EDE4] border-[#22201D] dark:border-[#3A352E]',
  ];

  const trendLabel = (tr) =>
    tr === 'up' ? t.trendUp : tr === 'steady' ? t.trendSteady : t.trendDown;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-16 space-y-16 sm:space-y-24 animate-fade-in">
      {/* HERO */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
        <div className="lg:col-span-7 space-y-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#B84A32] dark:text-[#DF735B]">
            {t.atlasKicker}
          </p>
          <h1 className="font-editorial text-5xl sm:text-6xl lg:text-[68px] font-medium tracking-[-0.02em] leading-[1.04] text-[#161513] dark:text-[#F2EDE4]">
            {t.heroTitle}
          </h1>
          <p className="text-base sm:text-lg text-[#57524A] dark:text-[#A8A095] max-w-xl leading-relaxed">
            {t.heroSubtitle}
          </p>

          {/* Search */}
          <div className="relative max-w-xl pt-2">
            <div
              className={`flex items-center gap-3 bg-[#FAF7F1] dark:bg-[#1D1B18] border transition-colors px-4 py-3.5 ${
                focused
                  ? 'border-[#B84A32] dark:border-[#DF735B]'
                  : 'border-[#161513] dark:border-[#5C554B]'
              }`}
            >
              <Search className="w-4 h-4 text-[#6E675E] shrink-0" />
              <input
                type="text"
                value={query}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 180)}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && query.trim()) {
                    navigate(`/list?q=${encodeURIComponent(query.trim())}`);
                  }
                }}
                placeholder={t.search}
                className="w-full bg-transparent text-sm sm:text-base text-[#161513] dark:text-[#F2EDE4] placeholder:text-[#878075] focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="text-[#878075] hover:text-[#161513] dark:hover:text-[#F2EDE4]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {focused && query.trim().length > 0 && (
              <div className="absolute left-0 right-0 mt-1 border border-[#161513] dark:border-[#5C554B] bg-[#FAF7F1] dark:bg-[#1D1B18] z-30">
                {quickMatches.length > 0 ? (
                  quickMatches.map((item) => (
                    <button
                      key={item.Name}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        navigate(`/name/${encodeURIComponent(item.Name)}`);
                      }}
                      className="group w-full flex items-center justify-between gap-4 px-4 py-3 text-left border-b last:border-b-0 border-[#E2DBD0] dark:border-[#2C2823] hover:bg-[#EAE4D8]/70 dark:hover:bg-[#26231F] transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2.5">
                          <span className="font-editorial text-lg font-medium text-[#161513] dark:text-[#F2EDE4]">
                            {item.Name}
                          </span>
                          <span className="text-[11px] uppercase tracking-[0.1em] text-[#878075]">
                            {t[item.gender]} · #{formatRankNum(item.bestRank)}
                          </span>
                        </div>
                        <p className="text-xs text-[#57524A] dark:text-[#A8A095] truncate mt-0.5">
                          {item.currentMeaning || t.noMeaning}
                        </p>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-[#878075] group-hover:text-[#B84A32] shrink-0" />
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-4 text-xs text-[#57524A] dark:text-[#A8A095]">
                    {t.noCriteria}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-1">
            <button
              type="button"
              onClick={() => navigate('/list')}
              className="group inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-[#161513] dark:text-[#F2EDE4] border-b border-[#161513] dark:border-[#F2EDE4] pb-1 hover:text-[#B84A32] hover:border-[#B84A32] transition-colors"
            >
              <span>{t.exploreAll}</span>
              <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
            <button
              type="button"
              onClick={openRandom}
              className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-[#57524A] dark:text-[#A8A095] hover:text-[#161513] dark:hover:text-[#F2EDE4] pb-1 transition-colors"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>{t.random}</span>
            </button>
          </div>
        </div>

        {/* Auto-Rotating Whoosh Featured Card */}
        {activeDisplayEntry && (
          <div
            onClick={() => navigate(`/name/${encodeURIComponent(activeDisplayEntry.Name)}`)}
            onMouseEnter={() => setFeaturedPaused(true)}
            onMouseLeave={() => setFeaturedPaused(false)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate(`/name/${encodeURIComponent(activeDisplayEntry.Name)}`);
              }
            }}
            className="lg:col-span-5 relative overflow-hidden group cursor-pointer bg-[#FAF7F1] dark:bg-[#1D1B18] border border-[#161513] dark:border-[#443F37] p-6 sm:p-7 flex flex-col justify-between transition-colors hover:border-[#B84A32] dark:hover:border-[#DF735B]"
          >
            <div
              key={`${activeDisplayEntry.Name}-${transitionStage}`}
              className={`flex flex-col justify-between ${
                transitionStage === 'exiting'
                  ? 'animate-whoosh-out'
                  : transitionStage === 'entering'
                  ? 'animate-whoosh-in'
                  : ''
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.14em] text-[#57524A] dark:text-[#A8A095] pb-4 border-b border-[#E2DBD0] dark:border-[#2C2823]">
                  <span>{t.featuredLabel}</span>
                  <span className="tabular-nums text-[#B84A32] dark:text-[#DF735B]">
                    #{formatRankNum(activeDisplayEntry.bestRank)} / {trendLabel(activeDisplayEntry.trend)}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-4 mt-5">
                  <div>
                    <h2 className="font-editorial text-4xl sm:text-5xl font-medium text-[#161513] dark:text-[#F2EDE4] leading-none">
                      {activeDisplayEntry.Name}
                    </h2>
                    <p className="text-xs uppercase tracking-[0.1em] text-[#878075] mt-2">
                      {activeDisplayEntry.etymologies.join(' / ') || '—'} · {t[activeDisplayEntry.gender]}
                    </p>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-[#161513] dark:text-[#F2EDE4] shrink-0 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-[#B84A32]" />
                </div>

                <p className="mt-4 text-sm text-[#57524A] dark:text-[#A8A095] leading-relaxed line-clamp-2 min-h-[2.75rem]">
                  {activeDisplayEntry.currentMeaning || t.noMeaning}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#E2DBD0] dark:border-[#2C2823]">
                <div className="w-full h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activeDisplayEntry.eraData} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke={isDark ? '#D96B52' : '#B84A32'}
                        strokeWidth={2}
                        fill={isDark ? '#D96B52' : '#B84A32'}
                        fillOpacity={0.1}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.1em] text-[#878075] mt-1 tabular-nums">
                  <span>1923</span>
                  <span className="text-[#161513] dark:text-[#F2EDE4] font-medium">
                    {t.readProfile} ↗
                  </span>
                  <span>2008+</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* TYPOGRAPHIC MARQUEE */}
      {marqueeNames.length > 0 && (
        <div className="border-y border-[#D8D1C5] dark:border-[#332F29] py-3 overflow-hidden marquee-mask">
          <div className="marquee-track flex items-center w-max">
            {['a', 'b'].map((suffix) => (
              <div key={suffix} className="flex items-center shrink-0" aria-hidden={suffix === 'b'}>
                {marqueeNames.map((item) => (
                  <span key={`${item.Name}-${suffix}`} className="inline-flex items-center shrink-0">
                    <button
                      type="button"
                      onClick={() => navigate(`/name/${encodeURIComponent(item.Name)}`)}
                      className="inline-flex items-baseline gap-2 px-3 py-1 text-[#161513] dark:text-[#F2EDE4] hover:text-[#B84A32] dark:hover:text-[#DF735B] transition-colors"
                    >
                      <span className="font-editorial text-lg sm:text-xl font-medium">{item.Name}</span>
                      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#878075] tabular-nums">
                        #{formatRankNum(item.bestRank)}
                      </span>
                    </button>
                    <span className="text-[#C8C0B2] dark:text-[#443F37] select-none px-1">·</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TWO DIRECTIONAL EDITORIAL PORTALS */}
      <section className="grid grid-cols-1 md:grid-cols-2 border-y border-[#161513] dark:border-[#443F37] divide-y md:divide-y-0 md:divide-x divide-[#161513] dark:divide-[#443F37]">
        <button
          type="button"
          onClick={() => navigate('/list')}
          className="group text-left py-8 md:pr-10 flex items-start justify-between gap-6 hover:bg-[#EAE4D8]/50 dark:hover:bg-[#1D1B18] px-2 sm:px-4 transition-colors"
        >
          <div>
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#B84A32] dark:text-[#DF735B] tabular-nums">
              01 / {t.dashboard}
            </span>
            <h2 className="font-editorial text-3xl sm:text-4xl font-medium text-[#161513] dark:text-[#F2EDE4] mt-2">
              {t.findTitle}
            </h2>
            <p className="text-sm text-[#57524A] dark:text-[#A8A095] mt-2 max-w-md leading-relaxed">
              {t.findDesc}
            </p>
          </div>
          <ArrowUpRight className="w-6 h-6 text-[#161513] dark:text-[#F2EDE4] shrink-0 mt-1 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-[#B84A32]" />
        </button>

        <button
          type="button"
          onClick={() => navigate('/graph')}
          className="group text-left py-8 md:pl-10 flex items-start justify-between gap-6 hover:bg-[#EAE4D8]/50 dark:hover:bg-[#1D1B18] px-2 sm:px-4 transition-colors"
        >
          <div>
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#536B58] dark:text-[#8FB096] tabular-nums">
              02 / {t.graph}
            </span>
            <h2 className="font-editorial text-3xl sm:text-4xl font-medium text-[#161513] dark:text-[#F2EDE4] mt-2">
              {t.discoverTitle}
            </h2>
            <p className="text-sm text-[#57524A] dark:text-[#A8A095] mt-2 max-w-md leading-relaxed">
              {t.discoverDesc}
            </p>
          </div>
          <ArrowUpRight className="w-6 h-6 text-[#161513] dark:text-[#F2EDE4] shrink-0 mt-1 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-[#536B58]" />
        </button>
      </section>

      {/* SPOTLIGHT NAMES: SOLID-COLOR VISUAL CENTERPIECE */}
      <section className="space-y-6">
        <div className="flex items-end justify-between gap-4 border-b border-[#D8D1C5] dark:border-[#332F29] pb-4">
          <h2 className="font-editorial text-3xl sm:text-4xl font-medium text-[#161513] dark:text-[#F2EDE4]">
            {t.spotlightTitle}
          </h2>
          <button
            type="button"
            onClick={() => navigate('/list')}
            className="group inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.14em] text-[#161513] dark:text-[#F2EDE4] hover:text-[#B84A32] transition-colors"
          >
            <span>{t.exploreAll}</span>
            <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {spotlightNames.map((item, idx) => {
            const themeClass = spotlightThemes[idx % spotlightThemes.length];
            const liked = isLiked(item.Name);
            return (
              <div
                key={item.Name}
                onClick={() => navigate(`/name/${encodeURIComponent(item.Name)}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/name/${encodeURIComponent(item.Name)}`);
                  }
                }}
                className={`group cursor-pointer border p-6 sm:p-8 flex flex-col justify-between min-h-[220px] transition-colors ${themeClass}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium uppercase tracking-[0.14em] opacity-80 tabular-nums">
                      {formatRankNum(item.bestRank)} / {trendLabel(item.trend)}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLike(item.Name);
                        }}
                        className="p-1 opacity-75 hover:opacity-100"
                        aria-label={liked ? t.saved : t.save}
                      >
                        <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
                      </button>
                      <ArrowUpRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-1" />
                    </div>
                  </div>

                  <h3 className="font-editorial text-4xl sm:text-5xl font-medium mt-5 leading-none transition-transform duration-200 group-hover:translate-x-0.5">
                    {item.Name}
                  </h3>
                  <p className="mt-3 text-sm opacity-85 line-clamp-2 max-w-md leading-relaxed">
                    {item.currentMeaning || t.noMeaning}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-current/20 flex items-baseline justify-between text-xs uppercase tracking-[0.1em]">
                  <span className="opacity-80">
                    {t[item.gender]} · {item.etymologies.join(' / ') || '—'}
                  </span>
                  <span className="font-editorial text-xl font-medium tabular-nums">
                    #{formatRankNum(item.bestRank)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}