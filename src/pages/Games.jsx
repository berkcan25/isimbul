import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { namesData } from '../data';
import { useTranslation } from '../context/LanguageContext';
import { useLikes } from '../context/LikesContext';
import { getNameMetrics, formatRankNum } from '../utils/nameHelpers';
import {
  Delete,
  RotateCcw,
  Share2,
  Check,
  X,
  Trophy,
  Flame,
  HelpCircle,
  BarChart2,
  Sparkles,
  ArrowUpRight,
  Heart,
} from 'lucide-react';

/* ============================================================================
 * 1. TURKISH ALPHABET & GAME CONSTANTS
 * ============================================================================ */
function toTurkishUpper(str) {
  if (!str) return '';
  return String(str).trim().toLocaleUpperCase('tr-TR');
}

const VALID_TR_LETTERS = new Set('ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ'.split(''));

const KEYBOARD_ROWS = [
  ['E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'Ğ', 'Ü'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ş', 'İ'],
  ['ENTER', 'Z', 'C', 'V', 'B', 'N', 'M', 'Ö', 'Ç', 'BACK'],
];

const WORD_LENGTH = 5;
const MAX_ATTEMPTS = 6;
const FLIP_STEP_MS = 220;
const FLIP_TOTAL_MS = WORD_LENGTH * FLIP_STEP_MS + 340;
const DAILY_POOL_SIZE = 400;
const DAILY_SHUFFLE_SEED = 20250101;

/* ============================================================================
 * 2. DETERMINISTIC DAILY ENGINE (ISTANBUL TIME, UTC+3)
 * ============================================================================ */
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;
const EPOCH_UTC_MS = Date.UTC(2025, 0, 1, 0, 0, 0);

function getIstanbulDayInfo() {
  const shifted = new Date(Date.now() + ISTANBUL_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  const dayStartUtc = Date.UTC(year, month, day, 0, 0, 0);
  const dayNumber = Math.max(1, Math.floor((dayStartUtc - EPOCH_UTC_MS) / 86400000) + 1);
  const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { dayNumber, dateKey };
}

function shuffleWithSeed(arr, seed) {
  const copy = [...arr];
  let s = seed >>> 0;
  for (let i = copy.length - 1; i > 0; i--) {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function evaluateGuess(guess, target) {
  const gChars = Array.from(guess);
  const tChars = Array.from(target);
  const result = new Array(WORD_LENGTH).fill('absent');
  const remaining = {};

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (gChars[i] === tChars[i]) {
      result[i] = 'correct';
    } else {
      remaining[tChars[i]] = (remaining[tChars[i]] || 0) + 1;
    }
  }
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === 'correct') continue;
    const ch = gChars[i];
    if (remaining[ch] > 0) {
      result[i] = 'present';
      remaining[ch] -= 1;
    }
  }
  return result;
}

function copyTextSafely(text) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
    return true;
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  } catch {
    return false;
  }
}

/* ============================================================================
 * 3. BONUS QUIZ BUILDER (ORIGIN + MEANING FROM 3 OTHER RANDOM NAMES)
 * ============================================================================ */
function buildBonusQuiz(targetItem, pool, seed) {
  const correctOrigin = targetItem.primaryOrigin;
  const uniqueOrigins = [...new Set(pool.map((n) => n.primaryOrigin))].filter(
    (o) => o && o !== correctOrigin
  );
  const distractorOrigins = shuffleWithSeed(uniqueOrigins, seed * 31 + 17).slice(0, 3);
  const originOptions = shuffleWithSeed(
    [
      { label: correctOrigin, isCorrect: true },
      ...distractorOrigins.map((o) => ({ label: o, isCorrect: false })),
    ],
    seed * 19 + 7
  );

  const otherMeanings = pool.filter(
    (n) =>
      n.Name !== targetItem.Name &&
      n.currentMeaning &&
      n.currentMeaning.toLowerCase() !== targetItem.currentMeaning.toLowerCase()
  );
  const distractorNames = shuffleWithSeed(otherMeanings, seed * 53 + 11).slice(0, 3);
  const meaningOptions = shuffleWithSeed(
    [
      { label: targetItem.currentMeaning, ownerName: targetItem.Name, isCorrect: true },
      ...distractorNames.map((n) => ({
        label: n.currentMeaning,
        ownerName: n.Name,
        isCorrect: false,
      })),
    ],
    seed * 29 + 13
  );

  return { originOptions, meaningOptions };
}

/* ============================================================================
 * 4. BILINGUAL UI COPY
 * ============================================================================ */
const COPY = {
  tr: {
    kicker: 'İSİMBUL / GÜNLÜK OYUN',
    title: 'İsimle',
    daily: 'Günlük',
    endless: 'Sınırsız',
    rulesTitle: 'Nasıl Oynanır?',
    rule1: '5 harfli Türkçe ismi 6 denemede tahmin edin.',
    rule2: 'Her tahminden sonra kutuların rengi harflerin doğruluğunu gösterir.',
    exCorrect: 'Harf isimde var ve doğru yerde.',
    exPresent: 'Harf isimde var ama farklı yerde.',
    exAbsent: 'Harf isimde yok.',
    ruleBonus: 'Oyun bittiğinde köken dili ve anlam sorularıyla +300 bonus puan kazanın.',
    gotIt: 'Başla',
    needFive: '5 harf girin',
    notAValidName: 'Geçerli bir isim değil',
    wonMsgs: ['Efsane!', 'Muhteşem!', 'Harika!', 'Çok İyi!', 'Güzel!', 'Son Anda!'],
    lostPrefix: 'Doğru isim:',
    bonusBadge: 'Bonus Bilgi Turu',
    q1Title: (name) => `${name} isminin köken dili hangisidir?`,
    q2Title: (name) => `${name} isminin anlamı hangisidir?`,
    belongsTo: 'Şu isme ait:',
    wordlePts: 'İsimle',
    bonusPts: 'Bonus',
    totalPts: 'Toplam',
    shareScore: 'Skoru Paylaş',
    copied: 'Skor panoya kopyalandı!',
    nextWord: 'Yeni İsim',
    tryEndless: 'Sınırsız Oyna',
    viewResults: 'Bonus & Skor',
    openProfile: 'Profili aç',
    statsTitle: 'İstatistikler',
    played: 'Oyun',
    winRate: 'Kazanma',
    streak: 'Seri',
    maxStreak: 'En İyi Seri',
    points: 'Toplam Puan',
    enter: 'GİR',
    noEligible: 'Veri setinde uygun 5 harfli isim bulunamadı.',
  },
  en: {
    kicker: 'İSİMBUL / DAILY GAME',
    title: 'İsimle',
    daily: 'Daily',
    endless: 'Endless',
    rulesTitle: 'How to Play',
    rule1: 'Guess the 5-letter Turkish name in 6 tries.',
    rule2: 'After each guess, the tile colors show how close you are.',
    exCorrect: 'Letter is in the name and in the right spot.',
    exPresent: 'Letter is in the name, but in another spot.',
    exAbsent: 'Letter is not in the name.',
    ruleBonus: 'Finish the board to unlock 2 bonus questions (+300 pts) on origin & meaning.',
    gotIt: 'Play',
    needFive: 'Not enough letters',
    notAValidName: 'Not in name list',
    wonMsgs: ['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!'],
    lostPrefix: 'The name was:',
    bonusBadge: 'Bonus Knowledge Round',
    q1Title: (name) => `What is the language of origin of ${name}?`,
    q2Title: (name) => `Which meaning belongs to ${name}?`,
    belongsTo: 'Belongs to:',
    wordlePts: 'Wordle',
    bonusPts: 'Bonus',
    totalPts: 'Total',
    shareScore: 'Share Score',
    copied: 'Score copied to clipboard!',
    nextWord: 'Next Name',
    tryEndless: 'Play Endless',
    viewResults: 'Bonus & Score',
    openProfile: 'Open profile',
    statsTitle: 'Statistics',
    played: 'Played',
    winRate: 'Win %',
    streak: 'Streak',
    maxStreak: 'Best Streak',
    points: 'Total Pts',
    enter: 'ENTER',
    noEligible: 'No eligible 5-letter names found in dataset.',
  },
};

const DEFAULT_STATS = {
  played: 0,
  wins: 0,
  streak: 0,
  maxStreak: 0,
  totalPoints: 0,
};

/* ============================================================================
 * 5. MAIN İSİMLE PAGE COMPONENT
 * ============================================================================ */
export default function Games() {
  const { lang, t: globalT } = useTranslation();
  const { isLiked, toggleLike } = useLikes();
  const ui = COPY[lang] || COPY.tr;

  const { dayNumber, dateKey } = useMemo(() => getIstanbulDayInfo(), []);

  // Build deterministic pool of recognizable 5-letter target names AND full legal-guess dictionary
  const { dailyPool, fullPool, validGuessSet } = useMemo(() => {
    const allowedSet = new Set();
    const eligible = [];

    namesData.forEach((raw) => {
      // 1. Add every 5-letter name and variant in namesData to the legal-guess dictionary
      const upperName = toTurkishUpper(raw.Name);
      const nameChars = Array.from(upperName);
      const isValidFiveLetter =
        nameChars.length === WORD_LENGTH &&
        nameChars.every((c) => VALID_TR_LETTERS.has(c));

      if (isValidFiveLetter) {
        allowedSet.add(upperName);
      }

      if (Array.isArray(raw.Variants)) {
        raw.Variants.forEach((variant) => {
          const upperVar = toTurkishUpper(variant);
          const varChars = Array.from(upperVar);
          if (
            varChars.length === WORD_LENGTH &&
            varChars.every((c) => VALID_TR_LETTERS.has(c))
          ) {
            allowedSet.add(upperVar);
          }
        });
      }

      // 2. Only include names with a recorded meaning & origin as puzzle answers
      if (!isValidFiveLetter) return;
      const m = getNameMetrics(raw, lang);
      const hasMeaning = Boolean(m.currentMeaning && m.currentMeaning.length > 3);
      const primaryOrigin = m.etymologies[0] || '';
      if (!hasMeaning || !primaryOrigin) return;

      eligible.push({ ...m, upper: upperName, primaryOrigin });
    });

    eligible.sort(
      (a, b) => b.totalCount - a.totalCount || a.Name.localeCompare(b.Name, 'tr')
    );

    const topCommon = eligible.slice(0, Math.min(DAILY_POOL_SIZE, eligible.length));
    return {
      dailyPool: shuffleWithSeed(topCommon, DAILY_SHUFFLE_SEED),
      fullPool: eligible,
      validGuessSet: allowedSet,
    };
  }, [lang]);

  const dailyIndex = dailyPool.length > 0 ? (dayNumber - 1) % dailyPool.length : 0;

  const [mode, setMode] = useState('daily'); // 'daily' | 'endless'
  const [endlessIndex, setEndlessIndex] = useState(() =>
    dailyPool.length > 1 ? (dailyIndex + 7) % dailyPool.length : 0
  );
  const [roundSeed, setRoundSeed] = useState(dayNumber);

  const [guesses, setGuesses] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [gameStatus, setGameStatus] = useState('playing'); // 'playing' | 'won' | 'lost'
  const [revealingRow, setRevealingRow] = useState(null);
  const [bounceRow, setBounceRow] = useState(null);
  const [shakeRow, setShakeRow] = useState(false);

  const [toast, setToast] = useState('');
  const [showRules, setShowRules] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showPostGame, setShowPostGame] = useState(false);

  // Bonus Quiz State
  const [originAnswerIdx, setOriginAnswerIdx] = useState(null);
  const [meaningAnswerIdx, setMeaningAnswerIdx] = useState(null);
  const [baseStatsRecorded, setBaseStatsRecorded] = useState(false);
  const [bonusPointsRecorded, setBonusPointsRecorded] = useState(false);

  // Persistent Stats & Streak in localStorage
  const [stats, setStats] = useState(() => {
    try {
      const saved = localStorage.getItem('isimle_stats_v2');
      return saved ? { ...DEFAULT_STATS, ...JSON.parse(saved) } : DEFAULT_STATS;
    } catch {
      return DEFAULT_STATS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('isimle_stats_v2', JSON.stringify(stats));
    } catch {
      // Ignore storage errors
    }
  }, [stats]);

  // Load saved Daily state for today's Istanbul dateKey
  useEffect(() => {
    if (mode !== 'daily') return;
    try {
      const savedDaily = localStorage.getItem(`isimle_daily_${dateKey}`);
      if (savedDaily) {
        const parsed = JSON.parse(savedDaily);
        setGuesses(parsed.guesses || []);
        setGameStatus(parsed.gameStatus || 'playing');
        setOriginAnswerIdx(parsed.originAnswerIdx ?? null);
        setMeaningAnswerIdx(parsed.meaningAnswerIdx ?? null);
        setBaseStatsRecorded(Boolean(parsed.baseStatsRecorded));
        setBonusPointsRecorded(Boolean(parsed.bonusPointsRecorded));
        setRoundSeed(dayNumber);
        if (parsed.gameStatus && parsed.gameStatus !== 'playing') {
          setShowPostGame(true);
        }
      } else {
        setGuesses([]);
        setCurrentInput('');
        setGameStatus('playing');
        setOriginAnswerIdx(null);
        setMeaningAnswerIdx(null);
        setBaseStatsRecorded(false);
        setBonusPointsRecorded(false);
        setRoundSeed(dayNumber);
        setShowPostGame(false);
      }
    } catch {
      // Ignore storage errors
    }
  }, [mode, dateKey, dayNumber]);

  // Save Daily state whenever it updates
  useEffect(() => {
    if (mode !== 'daily') return;
    try {
      localStorage.setItem(
        `isimle_daily_${dateKey}`,
        JSON.stringify({
          guesses,
          gameStatus,
          originAnswerIdx,
          meaningAnswerIdx,
          baseStatsRecorded,
          bonusPointsRecorded,
        })
      );
    } catch {
      // Ignore storage errors
    }
  }, [mode, dateKey, guesses, gameStatus, originAnswerIdx, meaningAnswerIdx, baseStatsRecorded, bonusPointsRecorded]);

  const targetItem =
    mode === 'daily'
      ? dailyPool[dailyIndex]
      : dailyPool[endlessIndex % Math.max(1, dailyPool.length)];

  const bonusQuiz = useMemo(() => {
    if (!targetItem) return { originOptions: [], meaningOptions: [] };
    return buildBonusQuiz(targetItem, fullPool, mode === 'daily' ? dayNumber : roundSeed);
  }, [targetItem, fullPool, mode, dayNumber, roundSeed]);

  const showNotice = useCallback((msg, duration = 2000) => {
    setToast(msg);
    setTimeout(() => setToast(''), duration);
  }, []);

  const startEndlessNext = useCallback(() => {
    if (!dailyPool.length) return;
    let nextIdx = Math.floor(Math.random() * dailyPool.length);
    if (nextIdx === endlessIndex) nextIdx = (nextIdx + 1) % dailyPool.length;
    setMode('endless');
    setEndlessIndex(nextIdx);
    setGuesses([]);
    setCurrentInput('');
    setGameStatus('playing');
    setRevealingRow(null);
    setBounceRow(null);
    setShowPostGame(false);
    setOriginAnswerIdx(null);
    setMeaningAnswerIdx(null);
    setBaseStatsRecorded(false);
    setBonusPointsRecorded(false);
    setRoundSeed((s) => s + 17);
  }, [dailyPool.length, endlessIndex]);

  const switchMode = (nextMode) => {
    if (nextMode === mode) return;
    if (nextMode === 'daily') {
      setMode('daily');
      setRevealingRow(null);
      setBounceRow(null);
      setCurrentInput('');
    } else {
      startEndlessNext();
    }
  };

  // Points
  const wordlePoints =
    gameStatus === 'won' ? Math.max(100, (MAX_ATTEMPTS - guesses.length + 1) * 100) : 0;
  const originBonus =
    originAnswerIdx !== null && bonusQuiz.originOptions[originAnswerIdx]?.isCorrect ? 150 : 0;
  const meaningBonus =
    meaningAnswerIdx !== null && bonusQuiz.meaningOptions[meaningAnswerIdx]?.isCorrect ? 150 : 0;
  const bonusPoints = originBonus + meaningBonus;
  const totalRoundPoints = wordlePoints + bonusPoints;
  const bothBonusAnswered = originAnswerIdx !== null && meaningAnswerIdx !== null;

  // Record base Wordle streak on round end
  useEffect(() => {
    if (gameStatus !== 'playing' && !baseStatsRecorded) {
      setStats((prev) => {
        const nextStreak = gameStatus === 'won' ? prev.streak + 1 : 0;
        return {
          ...prev,
          played: prev.played + 1,
          wins: prev.wins + (gameStatus === 'won' ? 1 : 0),
          streak: nextStreak,
          maxStreak: Math.max(prev.maxStreak, nextStreak),
          totalPoints: prev.totalPoints + wordlePoints,
        };
      });
      setBaseStatsRecorded(true);
    }
  }, [gameStatus, baseStatsRecorded, wordlePoints]);

  // Add bonus points once both questions are answered
  useEffect(() => {
    if (gameStatus !== 'playing' && bothBonusAnswered && !bonusPointsRecorded) {
      if (bonusPoints > 0) {
        setStats((prev) => ({ ...prev, totalPoints: prev.totalPoints + bonusPoints }));
      }
      setBonusPointsRecorded(true);
    }
  }, [gameStatus, bothBonusAnswered, bonusPointsRecorded, bonusPoints]);

  // Keyboard colors (revealed only after tile flip finishes)
  const keyStatuses = useMemo(() => {
    const priority = { absent: 1, present: 2, correct: 3 };
    const map = {};
    guesses.forEach(({ word, states }, rowIdx) => {
      if (rowIdx === revealingRow) return;
      Array.from(word).forEach((ch, idx) => {
        const st = states[idx];
        if (!map[ch] || priority[st] > priority[map[ch]]) {
          map[ch] = st;
        }
      });
    });
    return map;
  }, [guesses, revealingRow]);

  const handleKeyAction = useCallback(
    (key) => {
      if (!targetItem || gameStatus !== 'playing' || revealingRow !== null) return;

      if (key === 'BACK') {
        setCurrentInput((prev) => Array.from(prev).slice(0, -1).join(''));
        return;
      }

      if (key === 'ENTER') {
        const chars = Array.from(currentInput);
        if (chars.length < WORD_LENGTH) {
          setShakeRow(true);
          showNotice(ui.needFive, 1400);
          setTimeout(() => setShakeRow(false), 450);
          return;
        }

        // Legal name check against all 5-letter names & variants in namesData
        if (!validGuessSet.has(currentInput)) {
          setShakeRow(true);
          showNotice(ui.notAValidName, 1600);
          setTimeout(() => setShakeRow(false), 450);
          return;
        }

        const states = evaluateGuess(currentInput, targetItem.upper);
        const submittedRowIdx = guesses.length;
        const nextGuesses = [...guesses, { word: currentInput, states }];
        const didWin = currentInput === targetItem.upper;
        const didLose = !didWin && nextGuesses.length >= MAX_ATTEMPTS;

        setGuesses(nextGuesses);
        setCurrentInput('');
        setRevealingRow(submittedRowIdx);

        setTimeout(() => {
          setRevealingRow(null);
          if (didWin) {
            setGameStatus('won');
            setBounceRow(submittedRowIdx);
            showNotice(ui.wonMsgs[submittedRowIdx] || ui.wonMsgs[0], 2200);
            setTimeout(() => setShowPostGame(true), 900);
          } else if (didLose) {
            setGameStatus('lost');
            showNotice(`${ui.lostPrefix} ${targetItem.Name}`, 2600);
            setTimeout(() => setShowPostGame(true), 950);
          }
        }, FLIP_TOTAL_MS);
        return;
      }

      if (VALID_TR_LETTERS.has(key)) {
        setCurrentInput((prev) => {
          const chars = Array.from(prev);
          if (chars.length >= WORD_LENGTH) return prev;
          return prev + key;
        });
      }
    },
    [targetItem, gameStatus, revealingRow, currentInput, guesses, validGuessSet, showNotice, ui]
  );

  // Physical Keyboard Listener
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || showRules || showStatsModal || showPostGame) return;
      if (e.key === 'Backspace') {
        e.preventDefault();
        handleKeyAction('BACK');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleKeyAction('ENTER');
      } else if (e.key.length === 1) {
        const upper = toTurkishUpper(e.key);
        if (VALID_TR_LETTERS.has(upper)) {
          e.preventDefault();
          handleKeyAction(upper);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleKeyAction, showRules, showStatsModal, showPostGame]);

  const handleShare = () => {
    const grid = guesses
      .map((g) =>
        g.states.map((s) => (s === 'correct' ? '🟩' : s === 'present' ? '🟨' : '⬛')).join('')
      )
      .join('\n');
    const bonusMarks = bothBonusAnswered
      ? ` · Bonus: ${originBonus > 0 ? '✅' : '❌'}${meaningBonus > 0 ? '✅' : '❌'}`
      : '';
    const streakText = stats.streak > 0 ? ` · 🔥${stats.streak}` : '';
    const puzzleLabel = mode === 'daily' ? `#${dayNumber} (${dateKey})` : `(${ui.endless})`;
    const header = `İsimle ${puzzleLabel} ${
      gameStatus === 'won' ? guesses.length : 'X'
    }/${MAX_ATTEMPTS}${bonusMarks}${streakText} · ${totalRoundPoints} pts`;
    copyTextSafely(`${header}\n\n${grid}`);
    showNotice(ui.copied, 2200);
  };

  const getTileColors = (state, filled) => {
    if (state === 'correct') return 'bg-[#4E6553] dark:bg-[#587A5F] border-[#4E6553] dark:border-[#587A5F] text-[#FAF7F1]';
    if (state === 'present') return 'bg-[#C4923D] dark:bg-[#B88635] border-[#C4923D] dark:border-[#B88635] text-[#FAF7F1]';
    if (state === 'absent') return 'bg-[#6E675E] dark:bg-[#3A352E] border-[#6E675E] dark:border-[#3A352E] text-[#FAF7F1]';
    if (filled) return 'bg-[#FAF7F1] dark:bg-[#1D1B18] border-[#161513] dark:border-[#A8A095] text-[#161513] dark:text-[#F2EDE4]';
    return 'bg-[#FAF7F1] dark:bg-[#1D1B18] border-[#D8D1C5] dark:border-[#332F29] text-[#161513] dark:text-[#F2EDE4]';
  };

  const getKeyColors = (key) => {
    const st = keyStatuses[key];
    if (st === 'correct') return 'bg-[#4E6553] dark:bg-[#587A5F] text-[#FAF7F1] border-[#4E6553] dark:border-[#587A5F]';
    if (st === 'present') return 'bg-[#C4923D] dark:bg-[#B88635] text-[#FAF7F1] border-[#C4923D] dark:border-[#B88635]';
    if (st === 'absent') return 'bg-[#6E675E] dark:bg-[#3A352E] text-[#FAF7F1] border-[#6E675E] dark:border-[#3A352E]';
    return 'bg-[#E5DFD3] dark:bg-[#2A2621] text-[#161513] dark:text-[#F2EDE4] border-[#D8D1C5] dark:border-[#3A352E] hover:bg-[#DBD3C4] dark:hover:bg-[#34302A]';
  };

  if (!targetItem) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-sm text-[#57524A] dark:text-[#A8A095]">
        {ui.noEligible}
      </div>
    );
  }

  const winPct = stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0;
  const liked = isLiked(targetItem.Name);

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-6 pt-5 sm:pt-8 pb-12 flex flex-col min-h-[calc(100vh-64px)] animate-fade-in">
      {/* EDITORIAL GAME HEADER */}
      <header className="border-b border-[#161513] dark:border-[#443F37] pb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#B84A32] dark:text-[#DF735B] tabular-nums">
            {ui.kicker} {mode === 'daily' ? `· #${dayNumber}` : ''}
          </p>
          <h1 className="font-editorial text-3xl sm:text-4xl font-medium leading-none mt-1">
            {ui.title}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="inline-flex border border-[#D8D1C5] dark:border-[#332F29] bg-[#FAF7F1] dark:bg-[#1D1B18]">
            <button
              type="button"
              onClick={() => switchMode('daily')}
              className={`px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.1em] transition-colors ${
                mode === 'daily'
                  ? 'bg-[#161513] text-[#FAF7F1] dark:bg-[#F2EDE4] dark:text-[#141311]'
                  : 'text-[#57524A] dark:text-[#A8A095] hover:text-[#161513] dark:hover:text-[#F2EDE4]'
              }`}
            >
              {ui.daily}
            </button>
            <button
              type="button"
              onClick={() => switchMode('endless')}
              className={`px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.1em] border-l border-[#D8D1C5] dark:border-[#332F29] transition-colors ${
                mode === 'endless'
                  ? 'bg-[#161513] text-[#FAF7F1] dark:bg-[#F2EDE4] dark:text-[#141311]'
                  : 'text-[#57524A] dark:text-[#A8A095] hover:text-[#161513] dark:hover:text-[#F2EDE4]'
              }`}
            >
              {ui.endless}
            </button>
          </div>

          {stats.streak > 0 && (
            <button
              type="button"
              onClick={() => setShowStatsModal(true)}
              title={ui.streak}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-[#B84A32] text-[#B84A32] dark:text-[#DF735B] bg-[#FAF7F1] dark:bg-[#1D1B18] text-xs font-semibold tabular-nums"
            >
              <Flame className="w-3.5 h-3.5 fill-current" />
              <span>{stats.streak}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowStatsModal(true)}
            aria-label={ui.statsTitle}
            className="p-2 border border-[#D8D1C5] dark:border-[#332F29] bg-[#FAF7F1] dark:bg-[#1D1B18] text-[#57524A] dark:text-[#A8A095] hover:border-[#161513] dark:hover:border-[#F2EDE4] transition-colors"
          >
            <BarChart2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowRules(true)}
            aria-label={ui.rulesTitle}
            className="p-2 border border-[#D8D1C5] dark:border-[#332F29] bg-[#FAF7F1] dark:bg-[#1D1B18] text-[#57524A] dark:text-[#A8A095] hover:border-[#161513] dark:hover:border-[#F2EDE4] transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* TOAST */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 bg-[#161513] dark:bg-[#F2EDE4] text-[#FAF7F1] dark:text-[#141311] text-xs font-semibold uppercase tracking-[0.1em] shadow-md anim-modal">
          {toast}
        </div>
      )}

      {/* CENTERED WORDLE BOARD & KEYBOARD */}
      <div className="flex-1 flex flex-col items-center justify-between py-6 gap-6">
        {/* 6×5 GRID */}
        <div className="flex-1 flex items-center justify-center">
          <div className="grid grid-rows-6 gap-1.5">
            {Array.from({ length: MAX_ATTEMPTS }).map((_, rowIdx) => {
              const submitted = guesses[rowIdx];
              const isCurrentRow = rowIdx === guesses.length && gameStatus === 'playing';
              const rowChars = submitted
                ? Array.from(submitted.word)
                : isCurrentRow
                ? Array.from(currentInput)
                : [];
              const isFlipping = revealingRow === rowIdx;
              const isBouncing = bounceRow === rowIdx;

              return (
                <div
                  key={rowIdx}
                  className={`grid grid-cols-5 gap-1.5 ${
                    isCurrentRow && shakeRow ? 'anim-shake' : ''
                  }`}
                >
                  {Array.from({ length: WORD_LENGTH }).map((__, colIdx) => {
                    const ch = rowChars[colIdx] || '';
                    const state = submitted ? submitted.states[colIdx] : null;
                    const tileStyle = isFlipping
                      ? {
                          animationDelay: `${colIdx * FLIP_STEP_MS}ms`,
                          '--flip-color': `var(--isimle-${state})`,
                        }
                      : isBouncing
                      ? { animationDelay: `${colIdx * 90}ms` }
                      : undefined;

                    return (
                      <div
                        key={colIdx}
                        style={tileStyle}
                        className={`w-[54px] h-[54px] sm:w-[62px] sm:h-[62px] border-2 flex items-center justify-center text-2xl sm:text-3xl font-bold uppercase select-none ${
                          isFlipping
                            ? 'anim-flip'
                            : `transition-colors duration-200 ${getTileColors(state, Boolean(ch))}`
                        } ${!submitted && ch ? 'anim-pop' : ''} ${
                          isBouncing ? 'anim-bounce' : ''
                        }`}
                      >
                        {ch}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* POST-ROUND ACTION BAR (WHEN MODAL IS CLOSED) */}
        {gameStatus !== 'playing' && !showPostGame && (
          <div className="flex flex-wrap items-center justify-center gap-2.5 anim-modal">
            <button
              type="button"
              onClick={() => setShowPostGame(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#B84A32] hover:bg-[#9E3D27] text-[#FAF7F1] text-xs font-medium uppercase tracking-[0.12em] transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{ui.viewResults}</span>
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#161513] dark:bg-[#F2EDE4] text-[#FAF7F1] dark:text-[#141311] text-xs font-medium uppercase tracking-[0.12em] hover:opacity-90 transition-opacity"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{ui.shareScore}</span>
            </button>
          </div>
        )}

        {/* ON-SCREEN TURKISH KEYBOARD */}
        <div className="w-full max-w-lg space-y-1.5 select-none">
          {KEYBOARD_ROWS.map((row, rIdx) => (
            <div key={rIdx} className="flex justify-center gap-1 sm:gap-1.5">
              {row.map((key) => {
                const isWide = key === 'ENTER' || key === 'BACK';
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleKeyAction(key)}
                    className={`h-[50px] sm:h-[54px] border font-semibold flex items-center justify-center transition-all active:scale-95 ${
                      isWide
                        ? 'px-2.5 sm:px-3.5 text-[11px] tracking-[0.06em] min-w-[46px] sm:min-w-[58px]'
                        : 'flex-1 max-w-[44px] text-sm sm:text-base'
                    } ${getKeyColors(key)}`}
                  >
                    {key === 'BACK' ? (
                      <Delete className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : key === 'ENTER' ? (
                      ui.enter
                    ) : (
                      key
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ====================================================================
       * POST-GAME MODAL: BONUS QUIZ (ORIGIN + MEANING) + STREAK + SHARE
       * ==================================================================== */}
      {showPostGame && gameStatus !== 'playing' && (
        <div
          onClick={() => setShowPostGame(false)}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#FAF7F1] dark:bg-[#1D1B18] border border-[#161513] dark:border-[#5C554B] max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-7 space-y-5 anim-modal"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-[#D8D1C5] dark:border-[#2C2823] pb-4">
              <div>
                <span
                  className={`inline-block text-[11px] font-semibold uppercase tracking-[0.14em] ${
                    gameStatus === 'won'
                      ? 'text-[#4E6553] dark:text-[#8FB096]'
                      : 'text-[#B84A32] dark:text-[#DF735B]'
                  }`}
                >
                  {gameStatus === 'won'
                    ? `${ui.wonMsgs[guesses.length - 1] || ui.wonMsgs[0]} · ${guesses.length}/${MAX_ATTEMPTS}`
                    : `${ui.lostPrefix} ${targetItem.Name}`}
                </span>
                <div className="flex items-baseline gap-3 mt-1.5">
                  <h2 className="font-editorial text-4xl font-medium leading-none">
                    {targetItem.Name}
                  </h2>
                  <span className="text-xs text-[#878075] tabular-nums">
                    #{formatRankNum(targetItem.bestRank)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleLike(targetItem.Name)}
                  aria-label={liked ? globalT.saved : globalT.save}
                  className={`p-1.5 ${
                    liked
                      ? 'text-[#B84A32] dark:text-[#DF735B]'
                      : 'text-[#878075] hover:text-[#161513] dark:hover:text-[#F2EDE4]'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowPostGame(false)}
                  className="p-1.5 text-[#878075] hover:text-[#161513] dark:hover:text-[#F2EDE4]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Score & Streak Strip */}
            <div className="grid grid-cols-4 border border-[#D8D1C5] dark:border-[#332F29] divide-x divide-[#D8D1C5] dark:divide-[#332F29] bg-[#F4F0E8] dark:bg-[#141311] text-center">
              <div className="py-2.5">
                <div className="font-editorial text-2xl font-medium tabular-nums">{wordlePoints}</div>
                <div className="text-[10px] uppercase tracking-[0.1em] text-[#878075]">{ui.wordlePts}</div>
              </div>
              <div className="py-2.5">
                <div className="font-editorial text-2xl font-medium text-[#4E6553] dark:text-[#8FB096] tabular-nums">
                  +{bonusPoints}
                </div>
                <div className="text-[10px] uppercase tracking-[0.1em] text-[#878075]">{ui.bonusPts}</div>
              </div>
              <div className="py-2.5">
                <div className="font-editorial text-2xl font-medium tabular-nums">{totalRoundPoints}</div>
                <div className="text-[10px] uppercase tracking-[0.1em] text-[#878075]">{ui.totalPts}</div>
              </div>
              <div className="py-2.5">
                <div className="font-editorial text-2xl font-medium text-[#B84A32] dark:text-[#DF735B] flex items-center justify-center gap-0.5 tabular-nums">
                  <Flame className="w-4 h-4 fill-current" />
                  {stats.streak}
                </div>
                <div className="text-[10px] uppercase tracking-[0.1em] text-[#878075]">{ui.streak}</div>
              </div>
            </div>

            {/* BONUS QUIZ */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#C4923D] dark:text-[#D9A74E]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{ui.bonusBadge} (+150 pts)</span>
              </div>

              {/* Q1: Language of Origin */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">
                  1. {ui.q1Title(targetItem.Name)}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {bonusQuiz.originOptions.map((opt, idx) => {
                    const answered = originAnswerIdx !== null;
                    const picked = originAnswerIdx === idx;
                    let cls =
                      'bg-[#F4F0E8] dark:bg-[#141311] border-[#D8D1C5] dark:border-[#332F29] hover:border-[#161513] dark:hover:border-[#F2EDE4]';
                    if (answered) {
                      if (opt.isCorrect) {
                        cls = 'bg-[#4E6553] border-[#4E6553] text-[#FAF7F1]';
                      } else if (picked) {
                        cls = 'bg-[#B84A32] border-[#B84A32] text-[#FAF7F1]';
                      } else {
                        cls = 'bg-[#F4F0E8] dark:bg-[#141311] border-[#D8D1C5] dark:border-[#2C2823] opacity-45';
                      }
                    }
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        disabled={answered}
                        onClick={() => setOriginAnswerIdx(idx)}
                        className={`px-3.5 py-2.5 border text-left text-xs sm:text-sm font-medium flex items-center justify-between transition-colors ${cls}`}
                      >
                        <span>{opt.label}</span>
                        {answered && opt.isCorrect && <Check className="w-4 h-4 shrink-0" />}
                        {answered && picked && !opt.isCorrect && <X className="w-4 h-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Q2: Meaning (from 3 other random names) */}
              <div className="space-y-2 pt-3 border-t border-[#E2DBD0] dark:border-[#2C2823]">
                <h3 className="text-sm font-semibold">
                  2. {ui.q2Title(targetItem.Name)}
                </h3>
                <div className="space-y-2">
                  {bonusQuiz.meaningOptions.map((opt, idx) => {
                    const answered = meaningAnswerIdx !== null;
                    const picked = meaningAnswerIdx === idx;
                    let cls =
                      'bg-[#F4F0E8] dark:bg-[#141311] border-[#D8D1C5] dark:border-[#332F29] hover:border-[#161513] dark:hover:border-[#F2EDE4]';
                    if (answered) {
                      if (opt.isCorrect) {
                        cls = 'bg-[#4E6553] border-[#4E6553] text-[#FAF7F1]';
                      } else if (picked) {
                        cls = 'bg-[#B84A32] border-[#B84A32] text-[#FAF7F1]';
                      } else {
                        cls = 'bg-[#F4F0E8] dark:bg-[#141311] border-[#D8D1C5] dark:border-[#2C2823] opacity-60';
                      }
                    }
                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={answered}
                        onClick={() => setMeaningAnswerIdx(idx)}
                        className={`w-full px-3.5 py-2.5 border text-left text-xs sm:text-sm flex items-start justify-between gap-3 transition-colors ${cls}`}
                      >
                        <div>
                          <p className="leading-snug">{opt.label}</p>
                          {answered && !opt.isCorrect && (
                            <p className="text-[11px] opacity-80 mt-1">
                              {ui.belongsTo} <strong>{opt.ownerName}</strong>
                            </p>
                          )}
                        </div>
                        {answered && opt.isCorrect && <Check className="w-4 h-4 shrink-0 mt-0.5" />}
                        {answered && picked && !opt.isCorrect && <X className="w-4 h-4 shrink-0 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-4 border-t border-[#D8D1C5] dark:border-[#2C2823] space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#4E6553] hover:bg-[#3F5344] text-[#FAF7F1] text-xs font-semibold uppercase tracking-[0.12em] transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{ui.shareScore}</span>
                </button>
                <button
                  type="button"
                  onClick={startEndlessNext}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#161513] dark:bg-[#F2EDE4] text-[#FAF7F1] dark:text-[#141311] text-xs font-semibold uppercase tracking-[0.12em] hover:opacity-90 transition-opacity"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{mode === 'daily' ? ui.tryEndless : ui.nextWord}</span>
                </button>
              </div>

              <Link
                to={`/name/${encodeURIComponent(targetItem.Name)}`}
                className="w-full py-2.5 border border-[#D8D1C5] dark:border-[#332F29] hover:border-[#B84A32] text-xs font-medium uppercase tracking-[0.12em] text-[#B84A32] dark:text-[#DF735B] flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>{ui.openProfile}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
       * STATS MODAL
       * ==================================================================== */}
      {showStatsModal && (
        <div
          onClick={() => setShowStatsModal(false)}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#FAF7F1] dark:bg-[#1D1B18] border border-[#161513] dark:border-[#5C554B] max-w-sm w-full p-6 space-y-5 anim-modal"
          >
            <div className="flex items-center justify-between border-b border-[#D8D1C5] dark:border-[#2C2823] pb-3">
              <h2 className="font-editorial text-2xl font-medium flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[#C4923D]" />
                {ui.statsTitle}
              </h2>
              <button
                type="button"
                onClick={() => setShowStatsModal(false)}
                className="p-1 text-[#878075] hover:text-[#161513] dark:hover:text-[#F2EDE4]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-4 border border-[#D8D1C5] dark:border-[#332F29] divide-x divide-[#D8D1C5] dark:divide-[#332F29] bg-[#F4F0E8] dark:bg-[#141311] text-center">
              <div className="py-3">
                <div className="font-editorial text-2xl font-medium tabular-nums">{stats.played}</div>
                <div className="text-[10px] uppercase tracking-[0.08em] text-[#878075]">{ui.played}</div>
              </div>
              <div className="py-3">
                <div className="font-editorial text-2xl font-medium tabular-nums">{winPct}%</div>
                <div className="text-[10px] uppercase tracking-[0.08em] text-[#878075]">{ui.winRate}</div>
              </div>
              <div className="py-3">
                <div className="font-editorial text-2xl font-medium text-[#B84A32] dark:text-[#DF735B] tabular-nums">
                  {stats.streak}
                </div>
                <div className="text-[10px] uppercase tracking-[0.08em] text-[#878075]">{ui.streak}</div>
              </div>
              <div className="py-3">
                <div className="font-editorial text-2xl font-medium tabular-nums">{stats.maxStreak}</div>
                <div className="text-[10px] uppercase tracking-[0.08em] text-[#878075]">{ui.maxStreak}</div>
              </div>
            </div>

            <div className="flex items-center justify-between px-4 py-3 border border-[#C4923D]/50 bg-[#C4923D]/10">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#946A24] dark:text-[#D9A74E]">
                {ui.points}
              </span>
              <span className="font-editorial text-2xl font-medium tabular-nums">
                {stats.totalPoints.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
       * RULES MODAL
       * ==================================================================== */}
      {showRules && (
        <div
          onClick={() => setShowRules(false)}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#FAF7F1] dark:bg-[#1D1B18] border border-[#161513] dark:border-[#5C554B] max-w-md w-full p-6 space-y-4 anim-modal"
          >
            <div className="flex items-center justify-between border-b border-[#D8D1C5] dark:border-[#2C2823] pb-3">
              <h2 className="font-editorial text-2xl font-medium">{ui.rulesTitle}</h2>
              <button
                type="button"
                onClick={() => setShowRules(false)}
                className="p-1 text-[#878075] hover:text-[#161513] dark:hover:text-[#F2EDE4]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-[#57524A] dark:text-[#A8A095]">{ui.rule1}</p>
            <p className="text-sm text-[#57524A] dark:text-[#A8A095]">{ui.rule2}</p>

            <div className="space-y-2.5 py-3 border-y border-[#D8D1C5] dark:border-[#2C2823] text-xs">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 bg-[#4E6553] text-[#FAF7F1] font-bold flex items-center justify-center">D</span>
                <span>{ui.exCorrect}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 bg-[#C4923D] text-[#FAF7F1] font-bold flex items-center justify-center">E</span>
                <span>{ui.exPresent}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 bg-[#6E675E] text-[#FAF7F1] font-bold flex items-center justify-center">N</span>
                <span>{ui.exAbsent}</span>
              </div>
            </div>

            <p className="text-sm font-medium text-[#4E6553] dark:text-[#8FB096]">
              {ui.ruleBonus}
            </p>

            <button
              type="button"
              onClick={() => setShowRules(false)}
              className="w-full py-2.5 bg-[#161513] dark:bg-[#F2EDE4] text-[#FAF7F1] dark:text-[#141311] text-xs font-semibold uppercase tracking-[0.12em]"
            >
              {ui.gotIt}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
