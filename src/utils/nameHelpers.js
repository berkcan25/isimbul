export function normalizeSearch(str) {
  if (!str) return '';
  return String(str)
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/Ğ/g, 'g')
    .replace(/ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/ü/g, 'u')
    .replace(/Ş/g, 's')
    .replace(/ş/g, 's')
    .replace(/Ö/g, 'o')
    .replace(/ö/g, 'o')
    .replace(/Ç/g, 'c')
    .replace(/ç/g, 'c')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function formatRankNum(n) {
  if (!n || n >= 999999) return '—';
  return n < 10 ? `0${n}` : n.toLocaleString();
}

export function getNameMetrics(n, lang = 'tr') {
  const mStats = n.Statistics?.Count?.male || {};
  const fStats = n.Statistics?.Count?.female || {};

  const mTotal = Number(mStats.total?.total || 0);
  const m1923 = Number(mStats.post1923?.total || 0);
  const m1980 = Number(mStats.post1980?.total || 0);
  const m2008 = Number(mStats.post2008?.total || 0);

  const fTotal = Number(fStats.total?.total || 0);
  const f1923 = Number(fStats.post1923?.total || 0);
  const f1980 = Number(fStats.post1980?.total || 0);
  const f2008 = Number(fStats.post2008?.total || 0);

  const totalCount = mTotal + fTotal;

  let gender = 'unisex';
  if (mTotal > fTotal * 10) gender = 'male';
  else if (fTotal > mTotal * 10) gender = 'female';

  const maleRank = n.Statistics?.Rank?.male || 999999;
  const femaleRank = n.Statistics?.Rank?.female || 999999;
  const bestRank =
    gender === 'male'
      ? maleRank
      : gender === 'female'
      ? femaleRank
      : Math.min(maleRank, femaleRank);

  const eraData = [
    {
      key: 'pre1923',
      labelEn: 'Pre-1923',
      labelTr: '1923 Öncesi',
      male: Math.max(0, mTotal - m1923),
      female: Math.max(0, fTotal - f1923),
    },
    {
      key: '1923_1979',
      labelEn: '1923–1979',
      labelTr: '1923–1979',
      male: Math.max(0, m1923 - m1980),
      female: Math.max(0, f1923 - f1980),
    },
    {
      key: '1980_2007',
      labelEn: '1980–2007',
      labelTr: '1980–2007',
      male: Math.max(0, m1980 - m2008),
      female: Math.max(0, f1980 - f2008),
    },
    {
      key: 'post2008',
      labelEn: '2008+',
      labelTr: '2008+',
      male: Math.max(0, m2008),
      female: Math.max(0, f2008),
    },
  ].map((e) => ({ ...e, count: e.male + e.female }));

  const rates = [
    { era: lang === 'tr' ? '1923 Öncesi' : 'Pre-1923', rate: eraData[0].count / 35 },
    { era: '1923–1979', rate: eraData[1].count / 57 },
    { era: '1980–2007', rate: eraData[2].count / 28 },
    { era: '2008+', rate: eraData[3].count / 17 },
  ];
  const peakEra = rates.reduce((best, r) => (r.rate > best.rate ? r : best), rates[0]).era;

  let trend = 'steady';
  if (rates[3].rate > rates[2].rate * 1.25 && eraData[3].count >= 10) trend = 'up';
  else if (rates[3].rate < rates[2].rate * 0.6 || (eraData[3].count === 0 && totalCount > 0)) {
    trend = 'down';
  }

  const etymologies = Array.isArray(n.Etymology)
    ? n.Etymology.filter(Boolean)
    : n.Etymology
    ? [n.Etymology]
    : [];

  const meaning =
    lang === 'tr'
      ? n.Meaning_TR || n.Meaning_EN || ''
      : n.Meaning_EN || n.Meaning_TR || '';

  const usageStats = {
    single: Number(mStats.total?.single || 0) + Number(fStats.total?.single || 0),
    start: Number(mStats.total?.start || 0) + Number(fStats.total?.start || 0),
    end: Number(mStats.total?.end || 0) + Number(fStats.total?.end || 0),
  };

  return {
    ...n,
    totalCount,
    maleCount: mTotal,
    femaleCount: fTotal,
    maleRank,
    femaleRank,
    bestRank,
    gender,
    eraData,
    peakEra,
    trend,
    etymologies,
    currentMeaning: meaning,
    usageStats,
    syllables: Math.max(1, (String(n.Name || '').match(/[aeıioöuüAEIİOÖUÜ]/g) || []).length),
  };
}