import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import data from '../data.json';
const { namesData } = data;
import { useTranslation } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useLikes } from '../context/LikesContext';
import {
  getNameMetrics,
  normalizeSearch,
  formatRankNum,
} from '../utils/nameHelpers';
import {
  Search,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Shuffle,
  Heart,
  ArrowUpRight,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Compass,
} from 'lucide-react';

/* ============================================================================
 * COHESIVE ATLAS PALETTE HELPERS
 * ============================================================================ */
const ORIGIN_COLORS = {
  Türkçe: '#B84A32',      // Terracotta
  'Eski Türkçe': '#9E3D27',
  'Yeni Türkçe': '#C95E45',
  Arapça: '#3F556B',      // Slate Blue
  Farsça: '#536B58',      // Sage
  Yunanca: '#B88635',     // Ochre
  İbranice: '#7A4E6D',    // Plum
  Fransızca: '#4A6E7A',   // Deep Teal
  Kürtçe: '#8C6239',      // Umber
  Moğolca: '#6B5B45',     // Bronze
};

const CLUSTER_PALETTE = [
  '#B84A32',
  '#3F556B',
  '#536B58',
  '#B88635',
  '#7A4E6D',
  '#4A6E7A',
  '#9A5B3C',
  '#5E6B47',
  '#4B5A78',
  '#A67B37',
];

function hashString(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getOriginColor(origin, isDark) {
  if (!origin) return isDark ? '#787166' : '#9B9387';
  if (ORIGIN_COLORS[origin]) return ORIGIN_COLORS[origin];
  return CLUSTER_PALETTE[hashString(origin) % CLUSTER_PALETTE.length];
}

function getGenderColor(gender) {
  if (gender === 'male') return '#3F556B';
  if (gender === 'female') return '#B84A32';
  return '#536B58';
}

function getMeaningColor(clusterName, clusterId) {
  const idx =
    typeof clusterId === 'number'
      ? Math.abs(clusterId)
      : hashString(clusterName || 'other');
  return CLUSTER_PALETTE[idx % CLUSTER_PALETTE.length];
}

/* ============================================================================
 * FAST DETERMINISTIC OVERLAP RELAXATION (ZERO ENDLESS PHYSICS JITTER)
 * ============================================================================ */
function layoutNodesCleanly(rawNodes) {
  if (!rawNodes.length) return [];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  rawNodes.forEach((n) => {
    if (n.rawX < minX) minX = n.rawX;
    if (n.rawX > maxX) maxX = n.rawX;
    if (n.rawY < minY) minY = n.rawY;
    if (n.rawY > maxY) maxY = n.rawY;
  });

  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const scale = 960 / Math.max(spanX, spanY);
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  const nodes = rawNodes.map((n) => ({
    ...n,
    x: (n.rawX - midX) * scale,
    y: (n.rawY - midY) * scale,
  }));

  const cellSize = 36;
  for (let pass = 0; pass < 3; pass++) {
    const grid = new Map();
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const cx = Math.floor(n.x / cellSize);
      const cy = Math.floor(n.y / cellSize);
      const key = `${cx},${cy}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(i);
    }

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      const cx = Math.floor(a.x / cellSize);
      const cy = Math.floor(a.y / cellSize);

      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          const bucket = grid.get(`${gx},${gy}`);
          if (!bucket) continue;
          for (let k = 0; k < bucket.length; k++) {
            const j = bucket[k];
            if (j <= i) continue;
            const b = nodes[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const distSq = dx * dx + dy * dy;
            const minDist = a.radius + b.radius + 3.5;
            if (distSq < minDist * minDist) {
              const dist = Math.sqrt(distSq) || 0.01;
              const overlap = (minDist - dist) * 0.42;
              const nx = dx / dist;
              const ny = dy / dist;
              a.x -= nx * overlap;
              a.y -= ny * overlap;
              b.x += nx * overlap;
              b.y += ny * overlap;
            }
          }
        }
      }
    }
  }

  return nodes;
}

/* ============================================================================
 * INTEGRATED INTERACTIVE SEMANTIC NAME ATLAS
 * ============================================================================ */
export default function ClusterView() {
  const { t, lang } = useTranslation();
  const { theme } = useTheme();
  const { isLiked, toggleLike } = useLikes();
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  // UI & Filter State
  const [colorMode, setColorMode] = useState('origin'); // 'origin' | 'gender' | 'meaning'
  const [limit, setLimit] = useState(350); // 150 | 350 | 750 | 1500
  const [originFilter, setOriginFilter] = useState('all');
  const [showLabels, setShowLabels] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [activeLegendKey, setActiveLegendKey] = useState(null);
  const [hoveredLegendKey, setHoveredLegendKey] = useState(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  // Selection & Hover State
  const [selectedNameId, setSelectedNameId] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Canvas & Camera Refs
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const sizeRef = useRef({ width: 900, height: 600 });
  const cameraRef = useRef({ x: 0, y: 0, zoom: 0.72 });
  const targetCameraRef = useRef({ x: 0, y: 0, zoom: 0.72 });
  const dragRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    camStartX: 0,
    camStartY: 0,
  });

  // 1. Prepare all enriched names that have valid coordinates
  const allPositionedNames = useMemo(() => {
    return namesData
      .filter((n) => typeof n.x === 'number' && typeof n.y === 'number')
      .map((n) => getNameMetrics(n, lang))
      .sort((a, b) => b.totalCount - a.totalCount);
  }, [lang]);

  // 2. Extract unique origins sorted by frequency
  const uniqueOrigins = useMemo(() => {
    const counts = new Map();
    allPositionedNames.forEach((n) => {
      n.etymologies.forEach((orig) => {
        counts.set(orig, (counts.get(orig) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], lang))
      .map(([orig]) => orig);
  }, [allPositionedNames, lang]);

  // 3. Build positioned, overlap-relaxed bubbles for the active view
  const nodes = useMemo(() => {
    const filtered = allPositionedNames
      .filter((n) => originFilter === 'all' || n.etymologies.includes(originFilter))
      .slice(0, limit);

    const unknownLabel = lang === 'tr' ? 'Bilinmiyor' : 'Unknown';
    const otherClusterLabel = lang === 'tr' ? 'Diğer' : 'Other';

    const rawNodes = filtered.map((n) => {
      const primaryOrigin = n.etymologies[0] || unknownLabel;
      const clusterLabel = n.clusterName || otherClusterLabel;

      let categoryKey = primaryOrigin;
      let color = getOriginColor(primaryOrigin, isDark);

      if (colorMode === 'gender') {
        categoryKey = t[n.gender] || n.gender;
        color = getGenderColor(n.gender);
      } else if (colorMode === 'meaning') {
        categoryKey = clusterLabel;
        color = getMeaningColor(clusterLabel, n.cluster);
      }

      const radius = Math.max(
        5.5,
        Math.min(20, 3.5 + Math.log10(Math.max(10, n.totalCount)) * 2.4)
      );

      return {
        id: n.Name,
        name: n.Name,
        data: n,
        rawX: n.x,
        rawY: n.y,
        primaryOrigin,
        categoryKey,
        color,
        radius,
      };
    });

    return layoutNodesCleanly(rawNodes).sort((a, b) => a.radius - b.radius);
  }, [allPositionedNames, originFilter, limit, colorMode, isDark, lang, t]);

  // 3b. Subtle background region labels from cluster centroids
  const clusterLabels = useMemo(() => {
    const groups = new Map();
    nodes.forEach((n) => {
      const label = n.data.clusterName;
      if (!label) return;
      if (!groups.has(label)) {
        groups.set(label, { sumX: 0, sumY: 0, count: 0 });
      }
      const g = groups.get(label);
      g.sumX += n.x;
      g.sumY += n.y;
      g.count += 1;
    });

    return Array.from(groups.entries())
      .filter(([, g]) => g.count >= 4)
      .map(([label, g]) => ({
        label,
        x: g.sumX / g.count,
        y: g.sumY / g.count,
        count: g.count,
      }));
  }, [nodes]);

  // 4. Interactive legend items
  const legendItems = useMemo(() => {
    const map = new Map();
    nodes.forEach((n) => {
      if (!map.has(n.categoryKey)) {
        map.set(n.categoryKey, { key: n.categoryKey, color: n.color, count: 0 });
      }
      map.get(n.categoryKey).count += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [nodes]);

  useEffect(() => {
    setActiveLegendKey(null);
    setHoveredLegendKey(null);
  }, [colorMode, originFilter]);

  // 5. Selected node & 6 closest semantic neighbors
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNameId) || null,
    [nodes, selectedNameId]
  );

  const focusNode = hoveredNode || selectedNode;

  const nearestNeighbors = useMemo(() => {
    if (!focusNode) return [];
    return nodes
      .filter((n) => n.id !== focusNode.id)
      .map((n) => ({
        node: n,
        dist: Math.hypot(n.x - focusNode.x, n.y - focusNode.y),
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 6)
      .map((entry) => entry.node);
  }, [focusNode, nodes]);

  const selectedNeighbors = useMemo(() => {
    if (!selectedNode) return [];
    return nodes
      .filter((n) => n.id !== selectedNode.id)
      .map((n) => ({
        node: n,
        dist: Math.hypot(n.x - selectedNode.x, n.y - selectedNode.y),
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 6)
      .map((entry) => entry.node);
  }, [selectedNode, nodes]);

  // 6. Live autocomplete search matches
  const searchMatches = useMemo(() => {
    const q = normalizeSearch(searchQuery);
    if (!q) return [];
    return nodes
      .filter(
        (n) =>
          normalizeSearch(n.name).includes(q) ||
          normalizeSearch(n.data.currentMeaning).includes(q)
      )
      .slice(0, 6);
  }, [searchQuery, nodes]);

  // 7. Camera Navigation Helpers
  const fitAll = useCallback(() => {
    const { width, height } = sizeRef.current;
    const minDim = Math.min(width, height);
    const fitZoom = Math.max(0.35, Math.min(1.15, (minDim / 1080) * 0.92));
    targetCameraRef.current = { x: 0, y: 0, zoom: fitZoom };
  }, []);

  const flyToNode = useCallback((node) => {
    if (!node) return;
    setSelectedNameId(node.id);
    targetCameraRef.current = {
      x: node.x,
      y: node.y,
      zoom: Math.max(
        2.1,
        Math.min(3.2, targetCameraRef.current.zoom < 1.8 ? 2.4 : targetCameraRef.current.zoom)
      ),
    };
  }, []);

  const flyToRandom = useCallback(() => {
    if (!nodes.length) return;
    const pick = nodes[Math.floor(Math.random() * nodes.length)];
    flyToNode(pick);
  }, [nodes, flyToNode]);

  const adjustZoom = useCallback((factor) => {
    const nextZoom = Math.max(0.28, Math.min(6.5, targetCameraRef.current.zoom * factor));
    targetCameraRef.current = { ...targetCameraRef.current, zoom: nextZoom };
  }, []);

  const screenToWorld = useCallback((sx, sy) => {
    const { width, height } = sizeRef.current;
    const cam = cameraRef.current;
    return {
      x: (sx - width / 2) / cam.zoom + cam.x,
      y: (sy - height / 2) / cam.zoom + cam.y,
    };
  }, []);

  const hitTestNode = useCallback(
    (sx, sy) => {
      const { x: wx, y: wy } = screenToWorld(sx, sy);
      const hitPad = 4 / cameraRef.current.zoom;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        const dx = wx - n.x;
        const dy = wy - n.y;
        const r = n.radius + hitPad;
        if (dx * dx + dy * dy <= r * r) {
          return n;
        }
      }
      return null;
    },
    [nodes, screenToWorld]
  );

  // 8. Responsive Container Observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      sizeRef.current = {
        width: Math.max(300, rect.width),
        height: Math.max(420, rect.height),
      };
    };
    updateSize();
    fitAll();
    const ro = new ResizeObserver(() => updateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitAll]);

  // 9. Smooth 60fps Canvas Render Loop
  useEffect(() => {
    let rafId;
    const highlightKey = hoveredLegendKey || activeLegendKey;
    const neighborIds = new Set(nearestNeighbors.map((n) => n.id));

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const { width, height } = sizeRef.current;
      const dpr = window.devicePixelRatio || 1;

      if (
        canvas.width !== Math.floor(width * dpr) ||
        canvas.height !== Math.floor(height * dpr)
      ) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      const cam = cameraRef.current;
      const target = targetCameraRef.current;
      cam.x += (target.x - cam.x) * 0.14;
      cam.y += (target.y - cam.y) * 0.14;
      cam.zoom += (target.zoom - cam.zoom) * 0.14;

      ctx.save();
      ctx.scale(dpr, dpr);

      ctx.fillStyle = isDark ? '#141311' : '#F4F0E8';
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-cam.x, -cam.y);

      // Cartographic crosshairs
      ctx.strokeStyle = isDark
        ? 'rgba(242, 237, 228, 0.045)'
        : 'rgba(22, 21, 19, 0.05)';
      ctx.lineWidth = 1 / cam.zoom;
      ctx.beginPath();
      ctx.moveTo(-1200, 0);
      ctx.lineTo(1200, 0);
      ctx.moveTo(0, -1200);
      ctx.lineTo(0, 1200);
      ctx.stroke();

      // Background semantic region labels
      if (clusterLabels.length > 0 && cam.zoom < 2.2) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const regionFont = Math.max(10, Math.min(18, 12 / Math.sqrt(cam.zoom)));
        ctx.font = `600 ${regionFont}px "IBM Plex Sans", sans-serif`;
        ctx.fillStyle = isDark
          ? 'rgba(242, 237, 228, 0.14)'
          : 'rgba(22, 21, 19, 0.13)';
        clusterLabels.forEach((cl) => {
          ctx.fillText(cl.label.toUpperCase(), cl.x, cl.y);
        });
      }

      // Constellation neighbor lines
      if (focusNode && nearestNeighbors.length > 0) {
        ctx.save();
        ctx.strokeStyle = isDark
          ? 'rgba(223, 115, 91, 0.55)'
          : 'rgba(184, 74, 50, 0.45)';
        ctx.lineWidth = 1.4 / cam.zoom;
        ctx.setLineDash([4 / cam.zoom, 3 / cam.zoom]);
        nearestNeighbors.forEach((nb) => {
          ctx.beginPath();
          ctx.moveTo(focusNode.x, focusNode.y);
          ctx.lineTo(nb.x, nb.y);
          ctx.stroke();
        });
        ctx.restore();
      }

      // Bubbles
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const isSelected = selectedNode && n.id === selectedNode.id;
        const isHovered = hoveredNode && n.id === hoveredNode.id;
        const isNeighbor = neighborIds.has(n.id);

        let alpha = 0.9;
        if (highlightKey) {
          alpha = n.categoryKey === highlightKey ? 0.98 : 0.12;
        } else if (focusNode && !isSelected && !isHovered && !isNeighbor) {
          alpha = 0.28;
        }

        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.fill();

        if (isSelected || isHovered) {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = isDark ? '#F2EDE4' : '#161513';
          ctx.lineWidth = 2.4 / cam.zoom;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + 4.5 / cam.zoom, 0, Math.PI * 2);
          ctx.strokeStyle = isDark
            ? 'rgba(242, 237, 228, 0.4)'
            : 'rgba(22, 21, 19, 0.35)';
          ctx.lineWidth = 1 / cam.zoom;
          ctx.stroke();
        } else if (isNeighbor) {
          ctx.globalAlpha = 0.95;
          ctx.strokeStyle = isDark ? '#DF735B' : '#B84A32';
          ctx.lineWidth = 1.5 / cam.zoom;
          ctx.stroke();
        }
      }

      // Labels
      if (showLabels) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          const isSelected = selectedNode && n.id === selectedNode.id;
          const isHovered = hoveredNode && n.id === hoveredNode.id;
          const isNeighbor = neighborIds.has(n.id);
          const matchesLegend = highlightKey && n.categoryKey === highlightKey;

          const shouldShow =
            isSelected ||
            isHovered ||
            isNeighbor ||
            (matchesLegend && (cam.zoom > 0.85 || n.radius > 10)) ||
            (!highlightKey &&
              (cam.zoom > 1.75 ||
                (cam.zoom > 1.0 && n.radius > 11.5) ||
                n.radius > 15));

          if (!shouldShow) continue;

          const baseSize = isSelected || isHovered ? 15 : isNeighbor ? 12.5 : 11.5;
          const fontSize = baseSize / cam.zoom;
          ctx.font = `${isSelected || isHovered ? '600' : '500'} ${fontSize}px "Newsreader", Georgia, serif`;
          ctx.globalAlpha = isSelected || isHovered || isNeighbor || !focusNode ? 1 : 0.45;

          const textY = n.y + n.radius + 3.5 / cam.zoom;
          ctx.strokeStyle = isDark ? '#141311' : '#F4F0E8';
          ctx.lineWidth = 3.5 / cam.zoom;
          ctx.lineJoin = 'round';
          ctx.strokeText(n.name, n.x, textY);

          ctx.fillStyle = isDark ? '#F2EDE4' : '#161513';
          ctx.fillText(n.name, n.x, textY);
        }
      }

      ctx.restore();
      ctx.restore();

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [
    nodes,
    clusterLabels,
    isDark,
    showLabels,
    selectedNode,
    hoveredNode,
    focusNode,
    nearestNeighbors,
    activeLegendKey,
    hoveredLegendKey,
  ]);

  // 10. Pointer & Wheel Interaction Handlers
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { width, height } = sizeRef.current;

    const prevZoom = targetCameraRef.current.zoom;
    const factor = e.deltaY < 0 ? 1.16 : 0.86;
    const nextZoom = Math.max(0.28, Math.min(6.5, prevZoom * factor));

    const wx = (mx - width / 2) / prevZoom + targetCameraRef.current.x;
    const wy = (my - height / 2) / prevZoom + targetCameraRef.current.y;

    targetCameraRef.current = {
      x: wx - (mx - width / 2) / nextZoom,
      y: wy - (my - height / 2) / nextZoom,
      zoom: nextZoom,
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handlePointerDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX - rect.left,
      startY: e.clientY - rect.top,
      camStartX: targetCameraRef.current.x,
      camStartY: targetCameraRef.current.y,
    };
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (dragRef.current.active) {
      const dx = sx - dragRef.current.startX;
      const dy = sy - dragRef.current.startY;
      if (Math.hypot(dx, dy) > 5) {
        dragRef.current.moved = true;
      }
      targetCameraRef.current = {
        ...targetCameraRef.current,
        x: dragRef.current.camStartX - dx / cameraRef.current.zoom,
        y: dragRef.current.camStartY - dy / cameraRef.current.zoom,
      };
      return;
    }

    const hit = hitTestNode(sx, sy);
    setHoveredNode(hit);
  };

  const handlePointerUp = (e) => {
    if (!dragRef.current.active) return;
    const wasClick = !dragRef.current.moved;
    dragRef.current.active = false;
    setIsDragging(false);

    if (wasClick) {
      const rect = canvasRef.current.getBoundingClientRect();
      const hit = hitTestNode(e.clientX - rect.left, e.clientY - rect.top);
      if (hit) {
        flyToNode(hit);
      } else {
        setSelectedNameId(null);
      }
    }
  };

  const uiText = {
    searchPlaceholder:
      lang === 'tr'
        ? 'Haritada isim ara (örn. defne, omer)...'
        : 'Find a name on the map (e.g. defne, omer)...',
    neighborsTitle:
      lang === 'tr' ? 'En Yakın Anlam Komşuları' : 'Closest Semantic Neighbors',
    openProfile: lang === 'tr' ? 'Tam profili aç' : 'Open full profile',
    flyRandom: lang === 'tr' ? 'Rastgele keşfet' : 'Fly to random',
    showAll: lang === 'tr' ? 'Tümünü göster' : 'Show all',
    density: lang === 'tr' ? 'Yoğunluk' : 'Names shown',
    legend: lang === 'tr' ? 'Gösterge' : 'Legend',
    hint:
      lang === 'tr'
        ? 'Sürükleyerek gezinin · Tekerlekle yakınlaşın · İncelemek için tıklayın'
        : 'Drag to pan · Scroll to zoom · Click any bubble to inspect',
  };

  return (
    <div className="h-[calc(100vh-64px)] w-full flex flex-col bg-[#F4F0E8] dark:bg-[#141311] text-[#161513] dark:text-[#F2EDE4] overflow-hidden">
      {/* COMPACT EDITORIAL CONTROL STRIP */}
      <div className="border-b border-[#D8D1C5] dark:border-[#2C2823] bg-[#FAF7F1] dark:bg-[#1D1B18] px-4 sm:px-6 py-3 z-30">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3 justify-between">
          {/* Search Input with Live Dropdown */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <div className="flex items-center bg-[#F4F0E8] dark:bg-[#141311] border border-[#D8D1C5] dark:border-[#332F29] focus-within:border-[#161513] dark:focus-within:border-[#F2EDE4] px-3 py-2">
              <Search className="w-4 h-4 text-[#878075] shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchMatches.length > 0) {
                    flyToNode(searchMatches[0]);
                    setSearchQuery('');
                    setSearchFocused(false);
                  }
                }}
                placeholder={uiText.searchPlaceholder}
                className="w-full bg-transparent pl-2.5 text-xs sm:text-sm focus:outline-none placeholder:text-[#878075]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-[#878075] hover:text-[#161513] dark:hover:text-[#F2EDE4]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {searchFocused && searchQuery.trim().length > 0 && (
              <div className="absolute left-0 right-0 mt-1 bg-[#FAF7F1] dark:bg-[#1D1B18] border border-[#161513] dark:border-[#5C554B] z-40">
                {searchMatches.length > 0 ? (
                  searchMatches.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        flyToNode(m);
                        setSearchQuery('');
                      }}
                      className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-3 border-b last:border-b-0 border-[#E2DBD0] dark:border-[#2C2823] hover:bg-[#EAE4D8]/70 dark:hover:bg-[#26231F]"
                    >
                      <div className="min-w-0">
                        <span className="font-editorial text-lg font-medium">{m.name}</span>
                        <p className="text-[11px] text-[#57524A] dark:text-[#A8A095] truncate">
                          {m.data.currentMeaning || t.noMeaning}
                        </p>
                      </div>
                      <span
                        className="w-2.5 h-2.5 shrink-0"
                        style={{ backgroundColor: m.color }}
                      />
                    </button>
                  ))
                ) : (
                  <div className="px-3.5 py-3 text-xs text-[#878075]">{t.noCriteria}</div>
                )}
              </div>
            )}
          </div>

          {/* Color Mode, Density, Origin & Random */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex border border-[#D8D1C5] dark:border-[#332F29] bg-[#F4F0E8] dark:bg-[#141311]">
              {[
                { key: 'origin', label: t.origin },
                { key: 'gender', label: t.gender },
                { key: 'meaning', label: t.meaning },
              ].map((m, idx) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setColorMode(m.key)}
                  className={`px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.1em] transition-colors ${
                    idx > 0 ? 'border-l border-[#D8D1C5] dark:border-[#332F29]' : ''
                  } ${
                    colorMode === m.key
                      ? 'bg-[#161513] text-[#FAF7F1] dark:bg-[#F2EDE4] dark:text-[#141311]'
                      : 'text-[#57524A] dark:text-[#A8A095] hover:text-[#161513] dark:hover:text-[#F2EDE4]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              aria-label={uiText.density}
              className="px-2.5 py-1.5 bg-[#F4F0E8] dark:bg-[#141311] border border-[#D8D1C5] dark:border-[#332F29] text-[11px] font-medium uppercase tracking-[0.08em] focus:outline-none"
            >
              <option value={150}>Top 150</option>
              <option value={350}>Top 350</option>
              <option value={750}>Top 750</option>
              <option value={1500}>Top 1,500</option>
            </select>

            <select
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
              aria-label={t.filter_origin}
              className="hidden md:block px-2.5 py-1.5 bg-[#F4F0E8] dark:bg-[#141311] border border-[#D8D1C5] dark:border-[#332F29] text-[11px] font-medium uppercase tracking-[0.08em] focus:outline-none max-w-[150px]"
            >
              <option value="all">{t.origin}: {t.all}</option>
              {uniqueOrigins.slice(0, 18).map((orig) => (
                <option key={orig} value={orig}>
                  {orig}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={flyToRandom}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#B84A32] hover:bg-[#9E3D27] text-[#FAF7F1] text-[11px] font-medium uppercase tracking-[0.1em] transition-colors"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{uiText.flyRandom}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowLegend((v) => !v)}
              title={uiText.legend}
              className={`p-1.5 border transition-colors ${
                showLegend
                  ? 'border-[#161513] dark:border-[#F2EDE4] text-[#161513] dark:text-[#F2EDE4]'
                  : 'border-[#D8D1C5] dark:border-[#332F29] text-[#878075]'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* INTERACTIVE CANVAS WORKSPACE */}
      <div ref={containerRef} className="relative flex-1 w-full overflow-hidden select-none">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={() => {
            if (!dragRef.current.active) setHoveredNode(null);
          }}
          className={`block w-full h-full touch-none ${
            isDragging ? 'cursor-grabbing' : hoveredNode ? 'cursor-pointer' : 'cursor-grab'
          }`}
        />

        {/* Quiet Editorial Hint */}
        <div className="pointer-events-none absolute top-4 left-4 hidden sm:flex items-center gap-2 bg-[#FAF7F1]/90 dark:bg-[#1D1B18]/90 border border-[#D8D1C5] dark:border-[#332F29] px-3 py-1.5 text-[11px] text-[#57524A] dark:text-[#A8A095]">
          <Compass className="w-3.5 h-3.5 text-[#B84A32] dark:text-[#DF735B]" />
          <span>{uiText.hint}</span>
        </div>

        {/* Collapsible Interactive Legend */}
        {showLegend && (
          <aside className="absolute top-4 right-4 w-56 max-h-[52vh] flex flex-col bg-[#FAF7F1]/95 dark:bg-[#1D1B18]/95 border border-[#161513] dark:border-[#443F37] z-20">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#D8D1C5] dark:border-[#2C2823] text-[11px] font-medium uppercase tracking-[0.12em]">
              <span>
                {colorMode === 'origin' ? t.origin : colorMode === 'gender' ? t.gender : t.meaning}
              </span>
              {activeLegendKey ? (
                <button
                  type="button"
                  onClick={() => setActiveLegendKey(null)}
                  className="text-[10px] text-[#B84A32] dark:text-[#DF735B] hover:underline"
                >
                  {uiText.showAll}
                </button>
              ) : (
                <span className="text-[#878075] tabular-nums">{nodes.length}</span>
              )}
            </div>

            <div className="overflow-y-auto divide-y divide-[#EAE4D8] dark:divide-[#26231F]">
              {legendItems.map((item) => {
                const isActive = activeLegendKey === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onMouseEnter={() => setHoveredLegendKey(item.key)}
                    onMouseLeave={() => setHoveredLegendKey(null)}
                    onClick={() => setActiveLegendKey(isActive ? null : item.key)}
                    className={`w-full px-3 py-2 text-left flex items-center gap-2.5 text-xs transition-colors ${
                      isActive
                        ? 'bg-[#161513] text-[#FAF7F1] dark:bg-[#F2EDE4] dark:text-[#141311] font-medium'
                        : 'hover:bg-[#EAE4D8]/60 dark:hover:bg-[#26231F]'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="truncate flex-1">{item.key}</span>
                    <span className="text-[10px] opacity-70 tabular-nums">{item.count}</span>
                  </button>
                );
              })}
            </div>
          </aside>
        )}

        {/* Selected Name Editorial Inspector Card */}
        {selectedNode && (
          <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:w-[370px] bg-[#FAF7F1] dark:bg-[#1D1B18] border border-[#161513] dark:border-[#5C554B] p-5 z-20 animate-fade-in">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[#57524A] dark:text-[#A8A095]">
                  <span className="w-2 h-2 inline-block" style={{ backgroundColor: selectedNode.color }} />
                  <span>{t[selectedNode.data.gender]}</span>
                  <span>·</span>
                  <span>{selectedNode.data.etymologies.join(' / ') || '—'}</span>
                  <span>·</span>
                  <span className="tabular-nums text-[#B84A32] dark:text-[#DF735B]">
                    #{formatRankNum(selectedNode.data.bestRank)}
                  </span>
                </div>
                <h2 className="font-editorial text-3xl sm:text-4xl font-medium leading-none mt-2">
                  {selectedNode.name}
                </h2>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleLike(selectedNode.name)}
                  aria-label={isLiked(selectedNode.name) ? t.saved : t.save}
                  className={`p-1.5 transition-colors ${
                    isLiked(selectedNode.name)
                      ? 'text-[#B84A32] dark:text-[#DF735B]'
                      : 'text-[#878075] hover:text-[#161513] dark:hover:text-[#F2EDE4]'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${isLiked(selectedNode.name) ? 'fill-current' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedNameId(null)}
                  aria-label="Close"
                  className="p-1.5 text-[#878075] hover:text-[#161513] dark:hover:text-[#F2EDE4]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <p className="text-sm text-[#57524A] dark:text-[#A8A095] mt-3 leading-relaxed line-clamp-2">
              {selectedNode.data.currentMeaning || t.noMeaning}
            </p>

            {selectedNeighbors.length > 0 && (
              <div className="mt-4 pt-3.5 border-t border-[#E2DBD0] dark:border-[#2C2823]">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#878075] mb-2">
                  {uiText.neighborsTitle}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedNeighbors.map((nb) => (
                    <button
                      key={nb.id}
                      type="button"
                      onClick={() => flyToNode(nb)}
                      className="px-2.5 py-1 text-xs bg-[#F4F0E8] dark:bg-[#141311] border border-[#D8D1C5] dark:border-[#332F29] hover:border-[#B84A32] dark:hover:border-[#DF735B] hover:text-[#B84A32] dark:hover:text-[#DF735B] transition-colors"
                    >
                      {nb.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 pt-3.5 border-t border-[#E2DBD0] dark:border-[#2C2823] flex items-center justify-between">
              <span className="text-xs text-[#878075] tabular-nums">
                {selectedNode.data.totalCount.toLocaleString()} {lang === 'tr' ? 'kişi' : 'bearers'}
              </span>
              <button
                type="button"
                onClick={() => navigate(`/name/${encodeURIComponent(selectedNode.name)}`)}
                className="group inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] text-[#B84A32] dark:text-[#DF735B] hover:underline"
              >
                <span>{uiText.openProfile}</span>
                <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </button>
            </div>
          </div>
        )}

        {/* Quiet Floating Hover Preview */}
        {hoveredNode && (!selectedNode || hoveredNode.id !== selectedNode.id) && (
          <div className="pointer-events-none hidden sm:block absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#161513] dark:bg-[#F2EDE4] text-[#FAF7F1] dark:text-[#141311] px-4 py-2 text-xs z-20 max-w-md truncate">
            <span className="font-editorial text-base font-medium mr-2">{hoveredNode.name}</span>
            <span className="opacity-75">
              {hoveredNode.data.currentMeaning || hoveredNode.primaryOrigin}
            </span>
          </div>
        )}

        {/* Bottom-Right Map Controls */}
        <div className="absolute bottom-4 right-4 hidden sm:flex flex-col bg-[#FAF7F1] dark:bg-[#1D1B18] border border-[#161513] dark:border-[#443F37] divide-y divide-[#D8D1C5] dark:divide-[#2C2823] z-20">
          <button
            type="button"
            onClick={() => adjustZoom(1.35)}
            title="Zoom in"
            className="p-2.5 hover:bg-[#EAE4D8] dark:hover:bg-[#26231F] transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => adjustZoom(0.74)}
            title="Zoom out"
            className="p-2.5 hover:bg-[#EAE4D8] dark:hover:bg-[#26231F] transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={fitAll}
            title={t.resetView}
            className="p-2.5 hover:bg-[#EAE4D8] dark:hover:bg-[#26231F] transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowLabels((v) => !v)}
            title={showLabels ? t.hide : t.show}
            className="p-2.5 hover:bg-[#EAE4D8] dark:hover:bg-[#26231F] transition-colors"
          >
            {showLabels ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}