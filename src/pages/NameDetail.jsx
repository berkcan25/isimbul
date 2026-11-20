import { useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { useLikes } from '../context/LikesContext';
import { useTheme } from '../context/ThemeContext';
import namesData from '../data.json';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ArrowLeft, ArrowUpRight, Heart, Share2, Check } from 'lucide-react';
import { getNameMetrics, formatRankNum } from '../utils/nameHelpers';

export default function NameDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, lang } = useTranslation();
  const { isLiked, toggleLike } = useLikes();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [chartMode, setChartMode] = useState('total');
  const [copied, setCopied] = useState(false);

  const decodedId = decodeURIComponent(id || '');
  const raw = namesData.find((n) => n.Name === decodedId);

  const item = useMemo(() => (raw ? getNameMetrics(raw, lang) : null), [raw, lang]);

  const similarNames = useMemo(() => {
    if (!item || typeof item.x !== 'number' || typeof item.y !== 'number') return [];
    return namesData
      .filter((n) => n.Name !== item.Name && typeof n.x === 'number' && typeof n.y === 'number')
      .map((n) => ({ n, dist: Math.hypot(n.x - item.x, n.y - item.y) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 4)
      .map(({ n }) => getNameMetrics(n, lang));
  }, [item, lang]);

  if (!item) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <p className="font-editorial text-3xl">{t.noCriteria}</p>
        <Link to="/list" className="inline-flex items-center gap-2 mt-4 text-xs uppercase tracking-[0.12em] text-[#B84A32]">
          <ArrowLeft className="w-3.5 h-3.5" /> {t.back}
        </Link>
      </div>
    );
  }

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Ignore clipboard failure
    }
  };

  const chartRows = item.eraData.map((d) => ({
    ...d,
    eraLabel: lang === 'tr' ? d.labelTr : d.labelEn,
  }));

  const usageTotal = item.usageStats.single + item.usageStats.start + item.usageStats.end;
  const liked = isLiked(item.Name);

  return (
    <article className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-16 space-y-12 animate-fade-in">
      <title>{item.Name} | İsimBul</title>

      <div>
        <Link
          to="/list"
          className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-[#57524A] dark:text-[#A8A095] hover:text-[#161513] dark:hover:text-[#F2EDE4]"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> {t.back}
        </Link>
      </div>

      {/* Header */}
      <header className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
        <div className="lg:col-span-8">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[#57524A] dark:text-[#A8A095] mb-3">
            <span>{t[item.gender]}</span>
            {item.etymologies.length > 0 && (
              <>
                <span>·</span>
                <span>{item.etymologies.join(' / ')}</span>
              </>
            )}
            {item.clusterName && (
              <>
                <span>·</span>
                <span>{item.clusterName}</span>
              </>
            )}
            {item.Is_Quranic && (
              <>
                <span>·</span>
                <span className="text-[#536B58] dark:text-[#8FB096]">{t.isQuranic}</span>
              </>
            )}
          </div>

          <h1 className="font-editorial text-6xl sm:text-7xl lg:text-8xl font-medium tracking-[-0.025em] leading-[0.98]">
            {item.Name}
          </h1>

          <p className="mt-6 font-editorial text-xl sm:text-2xl text-[#36322D] dark:text-[#D5CEC2] leading-snug max-w-2xl">
            {item.currentMeaning || <span className="italic text-[#878075]">{t.noMeaning}</span>}
          </p>
        </div>

        <div className="lg:col-span-4 flex flex-col lg:items-end justify-between gap-6">
          <div className="lg:text-right">
            <span className="block text-[11px] uppercase tracking-[0.14em] text-[#878075]">{t.rank}</span>
            <span className="font-editorial text-5xl sm:text-6xl font-medium text-[#B84A32] dark:text-[#DF735B] tabular-nums leading-none">
              #{formatRankNum(item.bestRank)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => toggleLike(item.Name)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium uppercase tracking-[0.1em] border transition-colors ${
                liked
                  ? 'bg-[#B84A32] border-[#B84A32] text-[#FAF7F1]'
                  : 'border-[#161513] dark:border-[#F2EDE4] hover:bg-[#161513] hover:text-[#FAF7F1] dark:hover:bg-[#F2EDE4] dark:hover:text-[#141311]'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-current' : ''}`} />
              <span>{liked ? t.saved : t.save}</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium uppercase tracking-[0.1em] border border-[#D8D1C5] dark:border-[#332F29] hover:border-[#161513] dark:hover:border-[#F2EDE4] transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#536B58]" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copied ? t.linkCopied : t.share}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Metadata Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 border-y border-[#161513] dark:border-[#443F37] divide-x divide-[#D8D1C5] dark:divide-[#2C2823]">
        <div className="py-5 pr-4">
          <span className="block text-[11px] uppercase tracking-[0.12em] text-[#878075]">{t.peakEra}</span>
          <span className="block font-editorial text-3xl font-medium mt-1 tabular-nums">{item.peakEra}</span>
        </div>
        <div className="py-5 px-4">
          <span className="block text-[11px] uppercase tracking-[0.12em] text-[#878075]">{t.count}</span>
          <span className="block font-editorial text-3xl font-medium mt-1 tabular-nums">{item.totalCount.toLocaleString()}</span>
        </div>
        <div className="py-5 px-4">
          <span className="block text-[11px] uppercase tracking-[0.12em] text-[#878075]">{t.syllables}</span>
          <span className="block font-editorial text-3xl font-medium mt-1 tabular-nums">{item.syllables}</span>
        </div>
        <div className="py-5 pl-4">
          <span className="block text-[11px] uppercase tracking-[0.12em] text-[#878075]">{t.trajectory}</span>
          <span className="block text-sm font-medium uppercase tracking-[0.1em] mt-2 text-[#B84A32] dark:text-[#DF735B]">
            {item.trend === 'up' ? t.trendUp : item.trend === 'steady' ? t.trendSteady : t.trendDown}
          </span>
        </div>
      </section>

      {/* Era Popularity Chart */}
      <section className="py-8 border-b border-[#D8D1C5] dark:border-[#332F29]">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#B84A32] dark:text-[#DF735B]">
              {t.usage_chart}
            </p>
          </div>
          <div className="inline-flex border border-[#D8D1C5] dark:border-[#332F29]">
            <button
              type="button"
              onClick={() => setChartMode('total')}
              className={`px-3.5 py-1.5 text-xs font-medium uppercase tracking-[0.08em] ${
                chartMode === 'total'
                  ? 'bg-[#161513] text-[#FAF7F1] dark:bg-[#F2EDE4] dark:text-[#141311]'
                  : 'text-[#57524A] dark:text-[#A8A095]'
              }`}
            >
              {t.modeTotal}
            </button>
            <button
              type="button"
              onClick={() => setChartMode('gender')}
              className={`px-3.5 py-1.5 text-xs font-medium uppercase tracking-[0.08em] border-l border-[#D8D1C5] dark:border-[#332F29] ${
                chartMode === 'gender'
                  ? 'bg-[#161513] text-[#FAF7F1] dark:bg-[#F2EDE4] dark:text-[#141311]'
                  : 'text-[#57524A] dark:text-[#A8A095]'
              }`}
            >
              {t.modeGender}
            </button>
          </div>
        </div>

        <div className="w-full h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid stroke={isDark ? '#2C2823' : '#E2DBD0'} vertical={false} />
              <XAxis dataKey="eraLabel" stroke={isDark ? '#9A9287' : '#6E675E'} fontSize={12} tickLine={false} />
              <YAxis stroke={isDark ? '#9A9287' : '#6E675E'} fontSize={12} tickLine={false} axisLine={false} width={54} />
              <Tooltip
                cursor={{ fill: isDark ? '#26231F' : '#EAE4D8', opacity: 0.6 }}
                contentStyle={{
                  backgroundColor: isDark ? '#1D1B18' : '#FAF7F1',
                  borderColor: isDark ? '#332F29' : '#D8D1C5',
                  borderRadius: '0px',
                  fontSize: '12px',
                }}
              />
              {chartMode === 'total' ? (
                <Bar dataKey="count" name={t.total} fill={isDark ? '#D96B52' : '#B84A32'} maxBarSize={64} />
              ) : (
                <>
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                  <Bar dataKey="male" name={t.male} fill={isDark ? '#6B88A6' : '#3F556B'} maxBarSize={40} />
                  <Bar dataKey="female" name={t.female} fill={isDark ? '#D96B52' : '#B84A32'} maxBarSize={40} />
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Compound Usage & Gender Split */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {usageTotal > 0 && (
          <div className="bg-[#FAF7F1] dark:bg-[#1D1B18] border border-[#D8D1C5] dark:border-[#332F29] p-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#B84A32] dark:text-[#DF735B]">
              {t.compoundUsage}
            </p>
            <div className="mt-5 h-3 w-full flex bg-[#EAE4D8] dark:bg-[#2C2823]">
              <div style={{ width: `${(item.usageStats.single / usageTotal) * 100}%` }} className="bg-[#B84A32]" />
              <div style={{ width: `${(item.usageStats.start / usageTotal) * 100}%` }} className="bg-[#B88635]" />
              <div style={{ width: `${(item.usageStats.end / usageTotal) * 100}%` }} className="bg-[#3F556B]" />
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4 text-xs tabular-nums">
              <div>
                <span className="text-[#878075] block">{t.usageSingle}</span>
                <strong className="font-editorial text-xl">
                  {Math.round((item.usageStats.single / usageTotal) * 100)}%
                </strong>
              </div>
              <div>
                <span className="text-[#878075] block">{t.usageStart}</span>
                <strong className="font-editorial text-xl">
                  {Math.round((item.usageStats.start / usageTotal) * 100)}%
                </strong>
              </div>
              <div>
                <span className="text-[#878075] block">{t.usageEnd}</span>
                <strong className="font-editorial text-xl">
                  {Math.round((item.usageStats.end / usageTotal) * 100)}%
                </strong>
              </div>
            </div>
          </div>
        )}

        <div className="bg-[#FAF7F1] dark:bg-[#1D1B18] border border-[#D8D1C5] dark:border-[#332F29] p-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#3F556B] dark:text-[#86A4C2]">
            {t.genderSplit}
          </p>
          <div className="grid grid-cols-2 gap-6 mt-5">
            <div>
              <span className="text-xs uppercase tracking-[0.1em] text-[#878075]">{t.male}</span>
              <div className="font-editorial text-3xl mt-1 tabular-nums">{item.maleCount.toLocaleString()}</div>
              <span className="text-xs text-[#878075] tabular-nums">#{formatRankNum(item.maleRank)}</span>
            </div>
            <div>
              <span className="text-xs uppercase tracking-[0.1em] text-[#878075]">{t.female}</span>
              <div className="font-editorial text-3xl mt-1 tabular-nums">{item.femaleCount.toLocaleString()}</div>
              <span className="text-xs text-[#878075] tabular-nums">#{formatRankNum(item.femaleRank)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Variants & Derivations */}
      {(item.Variants?.length > 0 || item.Derivations?.length > 0) && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-[#D8D1C5] dark:border-[#332F29] pt-8">
          {item.Variants?.length > 0 && (
            <div>
              <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#878075] mb-3">
                {t.variants}
              </h2>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {item.Variants.map((v) => (
                  <span key={v} className="font-editorial text-xl">
                    {v}
                  </span>
                ))}
              </div>
            </div>
          )}
          {item.Derivations?.length > 0 && (
            <div>
              <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#878075] mb-3">
                {t.derivations}
              </h2>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {item.Derivations.map((v) => (
                  <Link
                    key={v}
                    to={`/name/${encodeURIComponent(v)}`}
                    className="font-editorial text-xl text-[#B84A32] dark:text-[#DF735B] hover:underline"
                  >
                    {v} ↗
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Similar Names (Semantic Coordinates) */}
      {similarNames.length > 0 && (
        <section>
          <div className="border-b border-[#D8D1C5] dark:border-[#332F29] pb-3 mb-5">
            <h2 className="font-editorial text-2xl sm:text-3xl font-medium">{t.similar_names}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {similarNames.map((sim) => (
              <button
                key={sim.Name}
                type="button"
                onClick={() => navigate(`/name/${encodeURIComponent(sim.Name)}`)}
                className="group text-left bg-[#FAF7F1] dark:bg-[#1D1B18] border border-[#D8D1C5] dark:border-[#332F29] hover:border-[#161513] dark:hover:border-[#F2EDE4] p-5 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-editorial text-2xl font-medium group-hover:text-[#B84A32] transition-colors">
                    {sim.Name}
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-[#878075] group-hover:text-[#B84A32]" />
                </div>
                <p className="text-xs text-[#57524A] dark:text-[#A8A095] line-clamp-2 mt-2">
                  {sim.currentMeaning || t.noMeaning}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}