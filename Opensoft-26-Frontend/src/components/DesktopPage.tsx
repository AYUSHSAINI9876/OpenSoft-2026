import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CandlestickChart,
  Clock,
  Globe,
  LayoutList,
  Shield,
  TrendingUp,
  Zap,

} from 'lucide-react';
import Footer from './Footer';


import adaniLogo from './logos/adani.png';
import blackrockLogo from './logos/blackrock.png';
import isharesLogo from './logos/ishares.png';
import jioLogo from './logos/jio.png';
import jpxLogo from './logos/jpx.png';
import nasdaqLogo from './logos/nasdaq.png';
import tataLogo from './logos/tata.png';
import vanguardLogo from './logos/vanguard.png';
import tradingBotImg from './trading_bot_ai.png';


const partnerBadges = [
  { name: 'Adani', logo: adaniLogo },
  { name: 'iShares', logo: isharesLogo },
  { name: 'Vanguard', logo: vanguardLogo },
  { name: 'Nasdaq', logo: nasdaqLogo },
  { name: 'BlackRock', logo: blackrockLogo },
  { name: 'JPX', logo: jpxLogo },
  { name: 'Tata', logo: tataLogo },
  { name: 'Jio', logo: jioLogo },
];

const analysisCards = [
  {
    title: 'Data-Driven Trading',
    desc: 'Use real-time market feeds and quantitative workflows to identify high-probability setups with precision.',
    details: 'Our market stack processes large volumes of live pricing and order-flow updates across global markets in real-time. It helps you react to momentum shifts, liquidity changes, and market structure signals with speed and clarity.',
    glow: 'from-fuchsia-500/40 to-violet-500/10',
    border: 'border-fuchsia-400/30',
  },
  {
    title: 'Customizable Strategies',
    desc: 'Design, backtest, and deploy your own algorithmic strategies with our intuitive No-Code or Pro-Code interfaces.',
    details: 'Whether you\'re a retail trader or a quant, our platform adapts to you. Build simple momentum-based logic or complex multi-asset arbitrage systems. With our integrated backtester, you can validate your edge on historical data before risking capital in live markets.',
    glow: 'from-cyan-400/35 to-emerald-400/10',
    border: 'border-cyan-300/30',
  },
];

const AnimatedNumber = ({ end, prefix = '', suffix = '', duration = 2000 }: { end: number, prefix?: string, suffix?: string, duration?: number }) => {
  const [count, setCount] = useState(0);
  const nodeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    let startTime: number | null = null;
    let animationFrame: number;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;
            const easeOutExpo = progress >= duration ? 1 : 1 - Math.pow(2, -10 * progress / duration);
            const easeProgress = Math.min(easeOutExpo, 1);
            const nextCount = end * easeProgress;

            if (progress < duration) {
              setCount(Math.min(end, nextCount));
              animationFrame = requestAnimationFrame(animate);
            } else {
              setCount(end);
            }
          };
          animationFrame = requestAnimationFrame(animate);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [end, duration]);

  return (
    <span ref={nodeRef}>
      {prefix}{Math.floor(count)}{suffix}
    </span>
  );
};

const DesktopPage = () => {
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem('token');
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);

  const toggleFlip = (index: number) => {
    setFlippedIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  type Candle = { o: number; h: number; l: number; c: number; vol: number };

  const generateInitialCandles = useCallback((): Candle[] => {
    const candles: Candle[] = [];
    let price = 42400;
    for (let i = 0; i < 40; i++) {
      const open = price;
      const change = (Math.random() - 0.48) * 60;
      const close = open + change;
      const high = Math.max(open, close) + Math.random() * 30;
      const low = Math.min(open, close) - Math.random() * 30;
      const vol = 50 + Math.random() * 150;
      candles.push({ o: open, h: high, l: low, c: close, vol });
      price = close;
    }
    return candles;
  }, []);

  const [candles, setCandles] = useState<Candle[]>(() => generateInitialCandles());

  // --- Multi-chart datasets ---
  const generateCandlesFrom = useCallback((startPrice: number, count: number, drift: number, vol: number): Candle[] => {
    const out: Candle[] = [];
    let price = startPrice;
    for (let i = 0; i < count; i++) {
      const o = price;
      const change = (Math.random() - 0.5 + drift) * vol;
      const c = o + change;
      const h = Math.max(o, c) + Math.random() * vol * 0.5;
      const l = Math.min(o, c) - Math.random() * vol * 0.5;
      out.push({ o, h, l, c, vol: 40 + Math.random() * 160 });
      price = c;
    }
    return out;
  }, []);

  const [nflxCandles, setNflxCandles] = useState<Candle[]>(() => generateCandlesFrom(87, 40, 0.04, 3));
  const [ethCandles, setEthCandles] = useState<Candle[]>(() => generateCandlesFrom(66200, 40, -0.02, 200));
  const [aaplCandles, setAaplCandles] = useState<Candle[]>(() => generateCandlesFrom(81.3, 40, 0.01, 0.4));

  // --- Rotating glow for partner logos ---
  const [glowIndex, setGlowIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setGlowIndex((prev) => (prev + 1) % partnerBadges.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let raf: number;
    let last = 0;
    const TICK = 600; // ms between updates — fast enough for "live" feel, slow enough for smoothness

    const tick = (now: number) => {
      if (now - last >= TICK) {
        last = now;

        // Helper to generate a new candle from previous close
        const newCandle = (prev: Candle[], drift: number, vol: number): Candle[] => {
          const lastClose = prev[prev.length - 1].c;
          const o = lastClose;
          const c = o + (Math.random() - 0.5 + drift) * vol;
          const h = Math.max(o, c) + Math.random() * vol * 0.5;
          const l = Math.min(o, c) - Math.random() * vol * 0.5;
          return [...prev.slice(1), { o, h, l, c, vol: 40 + Math.random() * 160 }];
        };

        setCandles((prev) => newCandle(prev, -0.02, 60));
        setNflxCandles((prev) => newCandle(prev, 0.04, 3));
        setEthCandles((prev) => newCandle(prev, -0.02, 200));
        setAaplCandles((prev) => newCandle(prev, 0.01, 0.4));
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);


  const renderCandlestickChart = () => {
    const W = 560;
    const chartH = 140;
    const volH = 36;
    const totalH = chartH + volH + 8;
    const candleW = W / candles.length;
    const bodyW = candleW * 0.55;

    const allHighs = candles.map((c) => c.h);
    const allLows = candles.map((c) => c.l);
    const priceMax = Math.max(...allHighs);
    const priceMin = Math.min(...allLows);
    const priceRange = Math.max(priceMax - priceMin, 1);
    const volMax = Math.max(...candles.map((c) => c.vol));

    const yPrice = (p: number) => 10 + ((priceMax - p) / priceRange) * (chartH - 20);

    // SMA-7
    const smaLen = 7;
    const smaPoints: string[] = [];
    for (let i = 0; i < candles.length; i++) {
      if (i >= smaLen - 1) {
        let sum = 0;
        for (let j = i - smaLen + 1; j <= i; j++) sum += candles[j].c;
        const avg = sum / smaLen;
        const x = i * candleW + candleW / 2;
        const y = yPrice(avg);
        smaPoints.push(`${x},${y}`);
      }
    }

    // Price grid lines
    const gridLines = 4;
    const gridStep = priceRange / (gridLines + 1);

    return (
      <svg viewBox={`0 0 ${W} ${totalH}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="bull-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#00C076', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#FFFFFF', stopOpacity: 1 }} />
          </linearGradient>
          <linearGradient id="bull-fill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#00C076', stopOpacity: 0.4 }} />
            <stop offset="100%" style={{ stopColor: '#FFFFFF', stopOpacity: 0.05 }} />
          </linearGradient>
        </defs>


        {/* grid lines */}
        {Array.from({ length: gridLines }, (_, i) => {
          const price = priceMax - gridStep * (i + 1);
          const y = yPrice(price);
          return (
            <g key={i}>
              <line x1={0} y1={y} x2={W} y2={y} stroke="#1E222D" strokeWidth="1" />
              <text x={W - 4} y={y - 3} fill="#4A5068" fontSize="8" textAnchor="end" fontFamily="monospace">
                {price.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* volume bars */}
        {candles.map((c, i) => {
          const x = i * candleW + (candleW - bodyW) / 2;
          const barH = (c.vol / volMax) * volH;
          const bullish = c.c >= c.o;
          return (
            <rect
              key={`v${i}`}
              x={x}
              y={chartH + 8 + (volH - barH)}
              width={bodyW}
              height={barH}
              fill={bullish ? 'url(#bull-fill)' : 'rgba(255,69,96,0.25)'}
            />
          );

        })}

        {/* candle wicks + bodies */}
        {candles.map((c, i) => {
          const cx = i * candleW + candleW / 2;
          const bullish = c.c >= c.o;
          const color = bullish ? '#00C076' : '#FF4560';
          const bodyTop = yPrice(Math.max(c.o, c.c));
          const bodyBot = yPrice(Math.min(c.o, c.c));
          const bodyHeight = Math.max(bodyBot - bodyTop, 1);

          return (
            <g key={`c${i}`}>
              {/* wick */}
              <line x1={cx} y1={yPrice(c.h)} x2={cx} y2={yPrice(c.l)} stroke={bullish ? 'url(#bull-grad)' : color} strokeWidth="1" />
              {/* body */}
              <rect
                x={cx - bodyW / 2}
                y={bodyTop}
                width={bodyW}
                height={bodyHeight}
                fill={bullish ? 'url(#bull-grad)' : color}
                rx={1}
              />

            </g>
          );
        })}

        {/* SMA line */}
        {smaPoints.length > 1 && (
          <polyline
            fill="none"
            stroke="#2962FF"
            strokeWidth="1.5"
            strokeLinejoin="round"
            points={smaPoints.join(' ')}
            opacity={0.8}
          />
        )}

        {/* last price dashed line */}
        {candles.length > 0 && (
          <>
            <line
              x1={0}
              y1={yPrice(candles[candles.length - 1].c)}
              x2={W}
              y2={yPrice(candles[candles.length - 1].c)}
              stroke="url(#bull-grad)"
              strokeWidth="1"
              strokeDasharray="4 3"
              opacity={0.8}
            />
            <rect
              x={W - 52}
              y={yPrice(candles[candles.length - 1].c) - 7}
              width={50}
              height={14}
              fill="url(#bull-grad)"
              rx={2}
            />

            <text
              x={W - 27}
              y={yPrice(candles[candles.length - 1].c) + 3}
              fill="#0B0E14"
              fontSize="8"
              textAnchor="middle"
              fontFamily="monospace"
              fontWeight="bold"
            >
              {candles[candles.length - 1].c.toFixed(2)}
            </text>
          </>
        )}
      </svg>
    );
  };

  // --- Smooth Line + fill area chart ---
  const renderLineChart = (data: Candle[], accentColor: string, _fillColor: string) => {
    const W = 400;
    const H = 160;
    const closes = data.map((c) => c.c);
    const pMax = Math.max(...closes);
    const pMin = Math.min(...closes);
    const range = Math.max(pMax - pMin, 0.01);
    const yP = (p: number) => 8 + ((pMax - p) / range) * (H - 24);
    const pts = closes.map((p, i) => `${(i / (closes.length - 1)) * W},${yP(p)}`).join(' ');

    // EMA-12
    const ema: number[] = [];
    const k = 2 / (12 + 1);
    closes.forEach((c, i) => { ema.push(i === 0 ? c : c * k + ema[i - 1] * (1 - k)); });
    const emaPts = ema.map((p, i) => `${(i / (ema.length - 1)) * W},${yP(p)}`).join(' ');

    const gridLines = 3;
    const gridStep = range / (gridLines + 1);

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        {Array.from({ length: gridLines }, (_, i) => {
          const price = pMax - gridStep * (i + 1);
          return <line key={i} x1={0} y1={yP(price)} x2={W} y2={yP(price)} stroke="#1E222D" strokeWidth="0.5" />;
        })}
        <defs>
          <linearGradient id={`fill-${accentColor}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00C076" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`stroke-${accentColor}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00C076" />
            <stop offset="100%" stopColor="#FFFFFF" />
          </linearGradient>
        </defs>
        <polygon
          points={`0,${H} ${pts} ${W},${H}`}
          fill={`url(#fill-${accentColor})`}
        />
        <polyline fill="none" stroke={`url(#stroke-${accentColor})`} strokeWidth="1.8" strokeLinejoin="round" points={pts} />

        <polyline fill="none" stroke="#FFB800" strokeWidth="1" strokeLinejoin="round" points={emaPts} opacity={0.45} strokeDasharray="3 2" />
        {/* price label */}
        <rect x={W - 48} y={yP(closes[closes.length - 1]) - 7} width={46} height={14} fill={accentColor} rx={2} />
        <text x={W - 25} y={yP(closes[closes.length - 1]) + 3} fill="#0B0E14" fontSize="8" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
          {closes[closes.length - 1].toFixed(2)}
        </text>
      </svg>
    );
  };

  // --- Compact candlestick chart (for smaller panels) ---
  const renderCandleSmall = (data: Candle[], bullColor: string, bearColor: string) => {
    const W = 400;
    const chartH = 130;
    const volH = 24;
    const totalH = chartH + volH + 4;
    const cW = W / data.length;
    const bW = cW * 0.5;

    const pMax = Math.max(...data.map((c) => c.h));
    const pMin = Math.min(...data.map((c) => c.l));
    const pRange = Math.max(pMax - pMin, 0.01);
    const vMax = Math.max(...data.map((c) => c.vol));
    const yP = (p: number) => 6 + ((pMax - p) / pRange) * (chartH - 14);

    return (
      <svg viewBox={`0 0 ${W} ${totalH}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="small-bull-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style={{ stopColor: '#00C076' }} />
            <stop offset="100%" style={{ stopColor: '#FFFFFF' }} />
          </linearGradient>
        </defs>


        {Array.from({ length: 3 }, (_, i) => {
          const price = pMax - (pRange / 4) * (i + 1);
          return (
            <g key={i}>
              <line x1={0} y1={yP(price)} x2={W} y2={yP(price)} stroke="#1E222D" strokeWidth="0.5" />
              <text x={W - 4} y={yP(price) - 2} fill="#4A5068" fontSize="7" textAnchor="end" fontFamily="monospace">{price.toFixed(2)}</text>
            </g>
          );
        })}
        {data.map((c, i) => {
          const x = i * cW + (cW - bW) / 2;
          const barH = (c.vol / vMax) * volH;
          const bull = c.c >= c.o;
          return <rect key={`v${i}`} x={x} y={chartH + 4 + (volH - barH)} width={bW} height={barH} fill={bull ? `${bullColor}40` : `${bearColor}40`} />;
        })}
        {data.map((c, i) => {
          const cx = i * cW + cW / 2;
          const bull = c.c >= c.o;
          const color = bull ? 'url(#small-bull-grad)' : bearColor;
          const bTop = yP(Math.max(c.o, c.c));
          const bBot = yP(Math.min(c.o, c.c));
          return (
            <g key={`c${i}`}>
              <line x1={cx} y1={yP(c.h)} x2={cx} y2={yP(c.l)} stroke={color} strokeWidth="0.8" />
              <rect x={cx - bW / 2} y={bTop} width={bW} height={Math.max(bBot - bTop, 0.5)} fill={color} rx={0.5} />
            </g>
          );
        })}

        {/* last price marker */}
        <line x1={0} y1={yP(data[data.length - 1].c)} x2={W} y2={yP(data[data.length - 1].c)} stroke="url(#small-bull-grad)" strokeWidth="0.6" strokeDasharray="3 3" opacity={0.5} />
        <rect x={W - 48} y={yP(data[data.length - 1].c) - 7} width={46} height={14} fill="url(#small-bull-grad)" rx={2} />

        <text x={W - 25} y={yP(data[data.length - 1].c) + 3} fill="#0B0E14" fontSize="8" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
          {data[data.length - 1].c.toFixed(2)}
        </text>
      </svg>
    );
  };

  // --- Bar overlay line chart (like Coca-Cola in the reference) ---
  const renderBarOverlayChart = (data: Candle[], _lineColor: string) => {
    const W = 400;
    const H = 160;
    const closes = data.map((c) => c.c);
    const pMax = Math.max(...closes);
    const pMin = Math.min(...closes);
    const range = Math.max(pMax - pMin, 0.01);
    const yP = (p: number) => 8 + ((pMax - p) / range) * (H - 30);
    const pts = closes.map((p, i) => `${(i / (closes.length - 1)) * W},${yP(p)}`).join(' ');

    // Bollinger: 20-SMA ± 2σ
    const smaLen = 12;
    const upper: string[] = [];
    const lower: string[] = [];
    const mid: string[] = [];
    for (let i = smaLen - 1; i < closes.length; i++) {
      const slice = closes.slice(i - smaLen + 1, i + 1);
      const avg = slice.reduce((a, b) => a + b, 0) / smaLen;
      const stddev = Math.sqrt(slice.reduce((s, v) => s + (v - avg) ** 2, 0) / smaLen);
      const x = (i / (closes.length - 1)) * W;
      mid.push(`${x},${yP(avg)}`);
      upper.push(`${x},${yP(avg + stddev * 2)}`);
      lower.push(`${x},${yP(avg - stddev * 2)}`);
    }

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="bar-line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style={{ stopColor: '#00C076' }} />
            <stop offset="100%" style={{ stopColor: '#FFFFFF' }} />
          </linearGradient>
        </defs>

        {Array.from({ length: 3 }, (_, i) => {
          const price = pMax - (range / 4) * (i + 1);
          return <line key={i} x1={0} y1={yP(price)} x2={W} y2={yP(price)} stroke="#1E222D" strokeWidth="0.5" />;
        })}
        {/* Bollinger bands */}
        {upper.length > 1 && (
          <>
            <polygon
              points={`${upper.join(' ')} ${[...lower].reverse().join(' ')}`}
              fill="rgba(167,139,250,0.06)"
            />
            <polyline fill="none" stroke="rgba(167,139,250,0.25)" strokeWidth="0.8" points={upper.join(' ')} />
            <polyline fill="none" stroke="rgba(167,139,250,0.25)" strokeWidth="0.8" points={lower.join(' ')} />
          </>
        )}
        <polyline fill="none" stroke="url(#bar-line-grad)" strokeWidth="1.8" strokeLinejoin="round" points={pts} />

        {mid.length > 1 && (
          <polyline fill="none" stroke="rgba(34,211,238,0.4)" strokeWidth="1" strokeLinejoin="round" points={mid.join(' ')} strokeDasharray="3 2" />
        )}
        {/* price labels */}
        <rect x={W - 48} y={yP(closes[closes.length - 1]) - 7} width={46} height={14} fill="url(#bar-line-grad)" rx={2} />

        <text x={W - 25} y={yP(closes[closes.length - 1]) + 3} fill="#0B0E14" fontSize="8" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
          {closes[closes.length - 1].toFixed(2)}
        </text>
      </svg>
    );
  };

  return (
    <div className="min-h-screen overflow-x-hidden selection:bg-[#00C076]/30 font-sans transition-colors duration-300" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', overflowAnchor: 'none' }}>
      <div className="fixed inset-0 pointer-events-none" />

      <nav className="sticky top-0 z-50 border-b backdrop-blur-md transition-colors" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', opacity: 0.95 }}>
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3 md:px-8">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <img
                src="/branding/oak-capital-logo.png"
                alt="Oak Capital logo"
                className="h-8 w-8 rounded-sm object-cover shadow-[0_0_15px_rgba(0,192,118,0.3)]"
              />
              <span className="text-xl font-black tracking-tighter" style={{ color: 'var(--text-primary)' }}>
                Oak Capital
              </span>
            </div>

            <div className="hidden items-center gap-7 text-sm lg:flex">
              <button onClick={() => navigate('/markets')} className="hover:opacity-80 transition-opacity" style={{ color: 'var(--text-primary)' }}>Markets</button>
              <button onClick={() => navigate('/terminal')} className="hover:opacity-80 transition-opacity" style={{ color: 'var(--text-primary)' }}>Terminal</button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            {isLoggedIn && (
              <button onClick={() => navigate('/terminal')} className="hidden rounded-full px-3 py-2 hover:opacity-80 md:inline-flex" style={{ color: 'var(--text-primary)' }}>
                BlackEdge
              </button>
            )}

            {isLoggedIn ? (
              <>
                <button
                  onClick={() => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('username');
                    window.location.reload();
                  }}
                  className="rounded-full bg-white px-4 py-2 font-semibold text-slate-900 hover:bg-white/90 shadow-sm"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <button onClick={() => navigate('/login')} className="rounded-full px-4 py-2 hover:opacity-100" style={{ color: 'var(--text-secondary)' }}>
                  Sign in
                </button>
                <button
                  onClick={() => navigate('/signup')}
                  className="rounded-full bg-gradient-to-r from-[#00C076] to-white px-4 py-2 font-semibold text-slate-900 transition hover:scale-[1.02] hover:opacity-90 shadow-lg shadow-[#00C076]/20"
                >
                  Sign up
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        <section className="relative overflow-hidden px-4 pb-20 pt-12 md:px-8 md:pb-28 md:pt-8">
          <div className="mx-auto max-w-[1280px] text-center">
            <h1 className="mx-auto max-w-[920px]">
              <span
                className="block text-6xl font-black leading-tight tracking-tight md:text-8xl"
                style={{ color: 'var(--text-primary)' }}
              >
                Oak Capital
              </span>
              <span
                className="mt-2 block text-xl font-semibold leading-snug tracking-normal opacity-80 md:text-5xl"
                style={{ color: 'var(--text-secondary)' }}
              >
                Markets Move, We Decide
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-[620px] text-sm leading-7 md:text-base opacity-70" style={{ color: 'var(--text-primary)' }}>
              Power your financial decisions with best-in-class data, news, research, analytics, and access to global markets.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              {!isLoggedIn && (
                <button
                  onClick={() => navigate('/signup')}
                  className="rounded-sm bg-gradient-to-r from-[#00C076] to-white px-8 py-3 text-sm font-bold text-[#0B0E14] transition hover:opacity-90 shadow-[0_0_20px_rgba(0,192,118,0.2)]"
                >
                  Sign up
                </button>
              )}

              {isLoggedIn && (
                <button
                  onClick={() => navigate('/terminal')}
                  className="rounded-sm border border-[#2A2E39] bg-[#1E222D] px-8 py-3 text-sm font-semibold text-slate-300 transition hover:bg-[#2A2E39]/80"
                >
                  Open terminal
                </button>
              )}
            </div>

            <div className="relative mx-auto mt-12 max-w-[1080px]" style={{ contain: 'layout style paint' }}>
              <div className="relative overflow-hidden rounded-xl border transition-all duration-500 shadow-2xl p-1" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                {/* Title bar */}
                <div className="mb-1 flex items-center justify-between rounded-lg border px-4 py-2 text-xs transition-colors" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-[#FF4560]" />
                    <div className="h-2.5 w-2.5 rounded-full bg-[#FFB800]" />
                    <div className="h-2.5 w-2.5 rounded-full bg-[#00C076]" />
                    <span className="ml-2 font-mono">Oak Capital UI - Multi-Chart Workspace</span>
                  </div>
                  <div className="hidden items-center gap-2 md:flex">
                    <span className="opacity-60">Workspace Active</span>
                  </div>
                </div>

                {/* 2x2 Chart Grid */}
                <div className="grid grid-cols-1 gap-1 overflow-hidden md:grid-cols-2">
                  {/* Panel 1: BTC/USD — Candlestick + Volume + SMA */}
                  <div className="overflow-hidden rounded-sm border border-[#2A2E39] bg-[#0B0E14]">
                    <div className="flex items-center justify-between border-b border-[#2A2E39] px-3 py-1.5">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="font-bold text-slate-200">Apple Inc</span>
                        <span className="text-slate-500">· 30 · NASDAQ · TPO</span>
                        <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[#00C076]" />
                      </div>
                      <span className="rounded-sm bg-[#1E222D] px-1.5 py-0.5 text-[9px] font-mono text-slate-400">USD</span>
                    </div>
                    <div className="relative h-[200px] p-1">
                      <div className="absolute inset-0 p-1">{renderCandlestickChart()}</div>
                      <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                        <div className="flex items-center gap-1 rounded-sm border border-[#2A2E39] bg-[#131722] px-1.5 py-0.5 text-[8px] font-mono text-slate-400">
                          <span className="inline-block h-1 w-2.5 rounded-full bg-[#2962FF]"></span> SMA 7
                        </div>
                        <div className="rounded-sm border border-[#2A2E39] bg-[#131722] px-1.5 py-0.5 text-[8px] font-mono text-slate-500">Vol</div>
                      </div>
                      <div className="absolute right-2 top-2">
                        <div className="rounded-sm border border-[#00C076]/30 bg-gradient-to-r from-[#00C076]/20 to-white/10 px-1.5 py-0.5 text-[8px] font-mono text-white">
                          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-white font-bold">Live</span>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Panel 2: NFLX — Line + EMA + Area fill */}
                  <div className="overflow-hidden rounded-sm border border-[#2A2E39] bg-[#0B0E14]">
                    <div className="flex items-center justify-between border-b border-[#2A2E39] px-3 py-1.5">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="font-bold text-slate-200">Netflix, Inc.</span>
                        <span className="text-slate-500">· 1h · NASDAQ</span>
                        <span className="ml-1 inline-flex h-3 w-3 items-center justify-center rounded-sm bg-[#FF4560] text-[7px] font-bold text-white">N</span>
                      </div>
                      <span className="rounded-sm bg-[#1E222D] px-1.5 py-0.5 text-[9px] font-mono text-slate-400">USD</span>
                    </div>
                    <div className="relative h-[200px] p-1">
                      <div className="absolute inset-0 p-1">{renderLineChart(nflxCandles, '#22d3ee', '#22d3ee')}</div>
                      <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                        <div className="flex items-center gap-1 rounded-sm border border-[#2A2E39] bg-[#131722] px-1.5 py-0.5 text-[8px] font-mono text-slate-400">
                          <span className="inline-block h-1 w-2.5 rounded-full bg-[#FFB800]"></span> EMA 12
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Panel 3: BTC/USD (Coinbase) — Compact candlestick */}
                  <div className="overflow-hidden rounded-sm border border-[#2A2E39] bg-[#0B0E14]">
                    <div className="flex items-center justify-between border-b border-[#2A2E39] px-3 py-1.5">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#F7931A] text-[7px] font-bold text-white">₿</span>
                        <span className="font-bold text-slate-200">Bitcoin / U.S. Dollar</span>
                        <span className="text-slate-500">· 15 · Coinbase</span>
                        <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[#00C076]" />
                      </div>
                      <span className="rounded-sm bg-[#1E222D] px-1.5 py-0.5 text-[9px] font-mono text-slate-400">USD</span>
                    </div>
                    <div className="relative h-[200px] p-1">
                      <div className="absolute inset-0 p-1">{renderCandleSmall(ethCandles, '#00C076', '#FF4560')}</div>
                      <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                        <div className="rounded-sm border border-[#2A2E39] bg-[#131722] px-1.5 py-0.5 text-[8px] font-mono text-slate-500">Vol</div>
                      </div>
                    </div>
                  </div>

                  {/* Panel 4: Coca-Cola — Line + Bollinger Bands */}
                  <div className="overflow-hidden rounded-sm border border-[#2A2E39] bg-[#0B0E14]">
                    <div className="flex items-center justify-between border-b border-[#2A2E39] px-3 py-1.5">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#FF4560] text-[7px] font-bold text-white">!</span>
                        <span className="font-bold text-slate-200">Coca-Cola Company (The)</span>
                        <span className="text-slate-500">· 1 · NYSE</span>
                        <span className="ml-1 inline-flex h-3 w-3 items-center justify-center rounded-sm bg-[#FF4560] text-[7px] font-bold text-white">K</span>
                      </div>
                      <span className="rounded-sm bg-[#1E222D] px-1.5 py-0.5 text-[9px] font-mono text-slate-400">USD</span>
                    </div>
                    <div className="relative h-[200px] p-1">
                      <div className="absolute inset-0 p-1">{renderBarOverlayChart(aaplCandles, '#FF4560')}</div>
                      <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                        <div className="flex items-center gap-1 rounded-sm border border-[#2A2E39] bg-[#131722] px-1.5 py-0.5 text-[8px] font-mono text-slate-400">
                          <span className="inline-block h-1 w-2.5 rounded-full bg-[rgba(167,139,250,0.6)]"></span> BB
                        </div>
                        <div className="flex items-center gap-1 rounded-sm border border-[#2A2E39] bg-[#131722] px-1.5 py-0.5 text-[8px] font-mono text-slate-400">
                          <span className="inline-block h-1 w-2.5 rounded-full bg-[rgba(34,211,238,0.6)]"></span> SMA
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── PARTNER LOGOS MARQUEE ── */}
              <div className="relative mt-12 h-20 md:h-24 overflow-hidden" style={{ contain: 'layout' }}>
                {/* Fade edges */}
                <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-16 z-10" style={{ background: 'linear-gradient(to right, var(--bg-primary), transparent)' }} />
                <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-16 z-10" style={{ background: 'linear-gradient(to left, var(--bg-primary), transparent)' }} />

                <div className="partner-marquee-track">
                  {[0, 1].map((segment) => (
                    <div key={`partner-segment-${segment}`} className="partner-marquee-segment">
                      {partnerBadges.map((badge, i) => {
                        const isGlowing = i === glowIndex || i === (glowIndex + 1) % partnerBadges.length;
                        return (
                          <div
                            key={`${badge.name}-${segment}-${i}`}
                            className="relative flex h-14 w-20 shrink-0 items-center justify-center rounded-md border bg-slate-200 p-2.5 transition-all duration-500 hover:scale-110 md:h-16 md:w-24"
                            style={{
                              borderColor: isGlowing ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.15)',
                              boxShadow: isGlowing
                                ? '0 0 20px rgba(168,85,247,0.35), 0 0 40px rgba(34,211,238,0.15), inset 0 0 12px rgba(168,85,247,0.08)'
                                : 'none',
                            }}
                          >
                            <img src={badge.logo} alt={badge.name} className="h-full w-full object-contain" />
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── STATS STRIP ── */}
        <section className="relative border-t px-4 py-16 md:px-8 transition-colors" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
          <div className="relative mx-auto grid max-w-[1180px] grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { end: 100, prefix: '$', suffix: 'k', label: 'Starting Capital', border: 'from-blue-500/50 to-transparent', glow: 'via-blue-500/80', corner: 'from-blue-400/40', rgb: '59, 130, 246' },
              { end: 6, prefix: '', suffix: ' Bots', label: 'Competing Live', border: 'from-amber-500/50 to-transparent', glow: 'via-amber-500/80', corner: 'from-amber-400/40', rgb: '245, 158, 11' },
              { end: 100, startRange: 90, prefix: '', suffix: 'k', label: 'Messages / sec', border: 'from-fuchsia-500/50 to-transparent', glow: 'via-fuchsia-500/80', corner: 'from-fuchsia-400/40', rgb: '217, 70, 239' },
              { end: 1, prefix: '<', suffix: 'ms', label: 'Execution', textColor: 'text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-white', border: 'from-emerald-500/50 to-transparent', glow: 'via-emerald-500/80', corner: 'from-emerald-400/40', rgb: '16, 185, 129' },

            ].map((stat) => (
              <div
                key={stat.label}
                className={`group relative rounded-sm p-[1px] bg-gradient-to-b ${stat.border} transition-all duration-500 hover:shadow-[0_0_30px_rgba(0,0,0,0.15)]`}
              >
                <div
                  className="relative flex h-full w-full flex-col overflow-hidden rounded-sm p-6 transition-all duration-500"
                  style={{ backgroundColor: 'var(--bg-primary)', boxShadow: 'none' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = `inset 0 0 20px rgba(${stat.rgb}, 0.15)`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Top Edge Glow - permanent */}
                  <div className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent ${stat.glow} to-transparent opacity-100`} />

                  {/* Corner Ambient Glow - permanent, brightens on hover */}
                  <div className={`absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br ${stat.corner} to-transparent blur-[40px] opacity-40 transition-opacity duration-700 group-hover:opacity-80`} />

                  <div className="relative">
                    <div className={`font-mono text-4xl font-bold tracking-tight md:text-5xl ${stat.textColor || ''}`} style={!stat.textColor ? { color: 'var(--text-primary)' } : {}}>
                      {stat.startRange !== undefined ? (
                        <>
                          <AnimatedNumber end={stat.startRange} suffix="k-" />
                          <AnimatedNumber end={stat.end} suffix={stat.suffix} />
                        </>
                      ) : (
                        <AnimatedNumber end={stat.end} prefix={stat.prefix} suffix={stat.suffix} />
                      )}
                    </div>
                    <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] opacity-50" style={{ color: 'var(--text-secondary)' }}>
                      {stat.label}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── PLATFORM ARCHITECTURE ── */}
        <section className="relative border-t px-4 py-20 md:px-8 transition-colors" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
          <div className="relative mx-auto max-w-[1180px]">
            <div className="mb-12">
              <div className="text-[11px] font-bold uppercase tracking-[0.3em] opacity-50" style={{ color: 'var(--text-secondary)' }}>
                Built for IIT Kharagpur · Open Soft 2026
              </div>
              <h2 className="mt-3 text-3xl font-bold md:text-4xl" style={{ color: 'var(--text-primary)' }}>
                Platform Architecture
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {[
                {
                  icon: <LayoutList className="h-5 w-5" />,
                  title: 'Limit Order Book',
                  desc: 'In-memory LOB with Price-Time priority. Supports limit, market, and cancel orders with microsecond matching.',
                  accent: 'text-blue-400',
                  iconBg: 'bg-blue-500/12',
                  border: 'border-blue-400/15 hover:border-blue-400/35',
                  glow: 'rgba(59,130,246,0.45)',
                },
                {
                  icon: <TrendingUp className="h-5 w-5" />,
                  title: 'GBM Price Engine',
                  desc: 'Geometric Brownian Motion drives synthetic price generation. Configurable μ drift and σ volatility parameters.',
                  accent: 'text-emerald-400',
                  iconBg: 'bg-emerald-500/12',
                  border: 'border-emerald-400/15 group-hover:border-emerald-400/35',
                  glow: 'rgba(16,185,129,0.45)',
                },
                {
                  icon: <Clock className="h-5 w-5" />,
                  title: 'Real-time WebSocket',
                  desc: '50–100 order messages per second streamed to frontend. Live candlestick charts, depth ladder, and trade feed.',
                  accent: 'text-orange-400',
                  iconBg: 'bg-orange-500/12',
                  border: 'border-orange-400/15 group-hover:border-orange-400/35',
                  glow: 'rgba(249,115,22,0.45)',
                },
                {
                  icon: <Zap className="h-5 w-5" />,
                  title: 'Algorithmic Trading Bots',
                  desc: 'Multiple algorithmic strategies (momentum, mean-reversion, market-making) compete against each other in real-time.',
                  accent: 'text-amber-400',
                  iconBg: 'bg-amber-500/12',
                  border: 'border-amber-400/15 group-hover:border-amber-400/35',
                  glow: 'rgba(245,158,11,0.45)',
                },
                {
                  icon: <CandlestickChart className="h-5 w-5" />,
                  title: 'Live Candlestick Charts',
                  desc: 'TradingView-style candlestick rendering with EMA, MACD, RSI, Bollinger Bands and 15+ indicators.',
                  accent: 'text-violet-400',
                  iconBg: 'bg-violet-500/12',
                  border: 'border-violet-400/15 group-hover:border-violet-400/35',
                  glow: 'rgba(139,92,246,0.45)',
                },
                {
                  icon: <Activity className="h-5 w-5" />,
                  title: 'Portfolio Tracking',
                  desc: 'Real-time P&L tracking per position, cumulative portfolio value, and fill-level execution reports.',
                  accent: 'text-cyan-400',
                  iconBg: 'bg-cyan-500/12',
                  border: 'border-cyan-400/15 group-hover:border-cyan-400/35',
                  glow: 'rgba(34,211,238,0.45)',
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className={`group relative overflow-hidden rounded-sm border p-7 transition-all duration-500 ${card.border}`}
                  style={{ backgroundColor: 'var(--bg-secondary)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = `0 0 50px ${card.glow}`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Subtle Background Hover Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                  <div className="relative">
                    <div className={`mb-6 flex h-10 w-10 items-center justify-center rounded-sm transition-all duration-300 group-hover:scale-110 ${card.iconBg} ${card.accent}`}>
                      {card.icon}
                    </div>
                    <h3 className="mb-3 text-base font-bold transition-colors" style={{ color: 'var(--text-primary)' }}>{card.title}</h3>
                    <p className="text-[13px] leading-relaxed opacity-70 transition-colors" style={{ color: 'var(--text-secondary)' }}>{card.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t px-4 py-20 md:px-8 transition-colors" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
          <div className="mx-auto max-w-[1180px]">
            <h2 className="text-center text-3xl font-bold md:text-4xl" style={{ color: 'var(--text-primary)' }}>Top Analysis Picks</h2>

            <div className="mt-12 grid gap-8 md:grid-cols-2">
              {analysisCards.map((card, index) => {
                const isFlipped = flippedIndices.includes(index);
                return (
                  <div key={card.title} className="perspective-1000 h-[480px]">
                    <div className={`relative h-full w-full transition-all duration-700 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                      {/* Front Side */}
                      <article className="backface-hidden absolute inset-0 rounded-sm border p-2 transition-colors" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
                        <div className="h-full relative rounded-sm border p-4 flex flex-col transition-colors" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                          {/* Top Graphics Panel */}
                          <div className="grid gap-4 sm:grid-cols-[1.1fr_1fr] flex-1 mb-4">
                            {index === 0 ? (
                              /* Trading terminal image + graph for first card */
                              <>
                                <div className="overflow-hidden rounded-sm border border-[#2A2E39] bg-[#0B0E14] p-1 h-64">
                                  <img src={tradingBotImg} alt="Trading terminal" className="h-full w-full object-cover rounded shadow-2xl opacity-90" />
                                </div>
                                <div className="overflow-hidden rounded-sm border border-[#2A2E39] bg-[#0B0E14] p-1 h-64">
                                  <div className="relative h-full overflow-hidden rounded bg-[#0B0E14]">
                                    <svg viewBox="0 0 300 170" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                                      <defs>
                                        <linearGradient id={`grad1-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                          <stop offset="0%" style={{ stopColor: '#00C076', stopOpacity: 0.6 }} />
                                          <stop offset="100%" style={{ stopColor: '#FFFFFF', stopOpacity: 0.2 }} />
                                        </linearGradient>
                                        <linearGradient id={`stroke-grad-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                          <stop offset="0%" style={{ stopColor: '#00C076' }} />
                                          <stop offset="100%" style={{ stopColor: '#FFFFFF' }} />
                                        </linearGradient>

                                        <filter id={`glow-${index}`}>
                                          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                                          <feMerge>
                                            <feMergeNode in="coloredBlur" />
                                            <feMergeNode in="SourceGraphic" />
                                          </feMerge>
                                        </filter>
                                      </defs>
                                      {/* Grid Lines */}
                                      {[40, 80, 120].map(y => (
                                        <line key={y} x1="0" y1={y} x2="300" y2={y} stroke="#1E222D" strokeWidth="0.5" />
                                      ))}
                                      {/* Predicted trend path (dashed) */}
                                      <polyline fill="none" stroke="#A855F7" strokeWidth="1" strokeDasharray="4,2" opacity="0.6"
                                        points="10,130 50,110 90,115 130,85 170,95 210,65 250,75 290,45"
                                      />
                                      {/* Fill under price */}
                                      <polygon fill={`url(#grad1-${index})`} points="10,140 30,132 50,125 70,108 90,100 110,85 130,78 150,68 170,60 190,55 210,48 230,42 250,45 270,38 290,30 290,155 10,155" />
                                      {/* Main Price Line with Glow */}
                                      <polyline fill="none" stroke={`url(#stroke-grad-${index})`} strokeWidth="2.5" filter={`url(#glow-${index})`}
                                        points="10,140 30,132 50,125 70,108 90,100 110,85 130,78 150,68 170,60 190,55 210,48 230,42 250,45 270,38 290,30"
                                      />
                                      {/* Interactive pulse point */}
                                      <circle cx="290" cy="30" r="3" fill="#FFFFFF">
                                        <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
                                        <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
                                      </circle>
                                    </svg>

                                  </div>
                                </div>
                              </>
                            ) : (
                              /* Technical Layout for Strategy Card */
                              <>
                                <div className="overflow-hidden rounded-sm border border-[#2A2E39] bg-[#0B0E14] p-1 h-64">
                                  <div className="relative h-full overflow-hidden rounded bg-[#0B0E14]">
                                    <svg viewBox="0 0 300 170" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                                      <defs>
                                        <linearGradient id={`grad2-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                          <stop offset="0%" style={{ stopColor: '#3B82F6', stopOpacity: 0.1 }} />
                                          <stop offset="100%" style={{ stopColor: '#3B82F6', stopOpacity: 0 }} />
                                        </linearGradient>
                                      </defs>
                                      {/* Bollinger Bands Fill */}
                                      <polygon fill={`url(#grad2-${index})`} points="10,50 30,55 50,60 70,58 90,52 110,48 130,52 150,58 170,132 150,128 130,122 110,118 90,122 70,128 50,130 10,120" />
                                      {/* Candlesticks */}
                                      {(() => {
                                        const seed = [85, 80, 75, 78, 82, 88, 92, 86, 80, 74, 70, 66, 62, 58, 54, 50, 55, 60, 65, 70, 68, 64, 60, 56, 52, 48, 53, 58, 54, 50];
                                        return seed.map((v, i) => {
                                          const x = 15 + i * 9.2;
                                          const c = v + 18;
                                          const o = (seed[Math.max(0, i - 1)] || v) + 18;
                                          const h = Math.min(o, c) - 2;
                                          const l = Math.max(o, c) + 2;
                                          const color = c < o ? '#00C076' : '#EF4444';
                                          return (
                                            <g key={i}>
                                              <line x1={x} y1={h} x2={x} y2={l} stroke={color} strokeWidth="0.5" />
                                              <rect x={x - 2} y={Math.min(o, c)} width="4" height={Math.max(1, Math.abs(o - c))} fill={color} />
                                            </g>
                                          );
                                        });
                                      })()}
                                      {/* Bollinger upper/lower */}
                                      <polyline fill="none" stroke="#3B82F6" strokeWidth="0.5" opacity="0.4" points="10,50 30,55 50,60 70,58 90,52 110,48 130,52 150,58 170,62" />
                                      <polyline fill="none" stroke="#3B82F6" strokeWidth="0.5" opacity="0.4" points="10,120 30,125 50,130 70,128 90,122 110,118 130,122 150,128 170,132" />
                                    </svg>
                                  </div>
                                </div>
                                <div className="overflow-hidden rounded-sm border border-[#2A2E39] bg-[#0B0E14] p-1 h-64">
                                  <div className="relative h-full overflow-hidden rounded bg-[#0B0E14]">
                                    <svg viewBox="0 0 300 170" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                                      <defs>
                                        <filter id={`glow-rsi-${index}`}>
                                          <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
                                          <feMerge>
                                            <feMergeNode in="coloredBlur" />
                                            <feMergeNode in="SourceGraphic" />
                                          </feMerge>
                                        </filter>
                                      </defs>
                                      {/* RSI Indicator style */}
                                      <rect x="0" y="40" width="300" height="90" fill="#1E222D" opacity="0.2" />
                                      <line x1="0" y1="40" x2="300" y2="40" stroke="#EF4444" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.5" />
                                      <line x1="0" y1="130" x2="300" y2="130" stroke="#00C076" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.5" />
                                      {/* Glowing RSI Line */}
                                      <polyline fill="none" stroke="#A855F7" strokeWidth="1.5" points="10,110 30,105 50,90 70,115 90,80 110,75 130,95 150,100 170,85 190,60 210,50 230,70 250,55 270,40 290,50" filter={`url(#glow-rsi-${index})`} />
                                    </svg>
                                  </div>
                                </div>
                              </>
                            )}

                          </div>
                          <div className="text-left">
                            <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{card.title}</h3>
                            <p className="mt-2 text-sm leading-6 opacity-70" style={{ color: 'var(--text-secondary)' }}>{card.desc}</p>
                            <button
                              onClick={() => toggleFlip(index)}
                              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-white hover:opacity-80"
                            >
                              Read More <ArrowRight className="h-4 w-4 text-emerald-400" />
                            </button>
                          </div>
                        </div>
                      </article>

                      {/* Back Side */}
                      <article className="rotate-y-180 backface-hidden absolute inset-0 rounded-sm border border-[#00C076]/30 p-8 flex flex-col justify-center items-center text-center shadow-[0_0_50px_rgba(0,192,118,0.05)] transition-colors" style={{ backgroundColor: 'var(--bg-primary)' }}>
                        <h3 className="text-2xl font-black mb-6" style={{ color: 'var(--text-primary)' }}>{card.title}</h3>

                        <div className="w-12 h-1 bg-gradient-to-r from-[#00C076] to-white mb-8 rounded-full" />
                        <p className="text-base leading-relaxed mb-10 max-w-md opacity-80" style={{ color: 'var(--text-secondary)' }}>
                          {card.details}
                        </p>
                        <button
                          onClick={() => toggleFlip(index)}
                          className="rounded-full border px-8 py-2.5 text-sm font-bold transition hover:bg-white/10"
                          style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)', backgroundColor: 'rgba(var(--text-primary-rgb), 0.05)' }}
                        >
                          Go Back
                        </button>
                      </article>
                    </div>
                  </div>
                );
              })}
            </div>


          </div>
        </section>

        <section className="border-t px-4 py-20 md:px-8 transition-colors" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
          <div className="mx-auto grid max-w-[1100px] items-center gap-8 rounded-sm border p-6 shadow-2xl md:grid-cols-[170px_1fr_auto] md:p-10 transition-colors" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-sm border md:mx-0 transition-colors" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
              <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-[#00C076] to-white leading-none">
                √λ
              </div>

            </div>

            <div className="text-center md:text-left">
              <div className="inline-flex items-center gap-2 rounded-sm border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] opacity-60 transition-colors" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-primary)' }}>
                Final CTA
              </div>
              <h2 className="mt-4 text-4xl font-black leading-tight md:text-5xl" style={{ color: 'var(--text-primary)' }}>
                Trade like a <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00C076] to-white">quant.</span>
              </h2>

              <p className="mt-4 max-w-[620px] text-base leading-7 opacity-70" style={{ color: 'var(--text-secondary)' }}>
                Harness the power of engineering with your own data, a quantitative workflow, and a modern terminal built for fast decisions.
              </p>
            </div>

            <div className="flex justify-center md:justify-end">
              <button
                onClick={() => navigate(isLoggedIn ? '/terminal' : '/signup')}
                className="rounded-sm bg-gradient-to-r from-[#00C076] to-white px-8 py-3 text-sm font-bold text-[#0B0E14] transition hover:opacity-90 shadow-[0_0_20px_rgba(0,192,118,0.25)]"
              >
                {isLoggedIn ? 'START NOW' : 'SIGN UP'}
              </button>

            </div>
          </div>

          <div className="mx-auto mt-12 flex max-w-[1100px] flex-wrap items-center justify-center gap-6 text-sm md:justify-between">
            {[
              { icon: <Shield className="h-4 w-4" />, text: 'Secure auth state preserved' },
              { icon: <BarChart3 className="h-4 w-4" />, text: 'Live terminal simulation preserved' },
              { icon: <Globe className="h-4 w-4" />, text: 'Markets and route navigation preserved' }
            ].map((badge, idx) => (
              <div key={idx} className="group flex items-center gap-3 rounded-sm border px-5 py-2.5 backdrop-blur-md transition-all duration-300 hover:border-[#00C076]/40 hover:shadow-[0_0_20px_rgba(0,192,118,0.05)]" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform duration-300">
                  {badge.icon}
                </div>
                <span className="font-medium opacity-60 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-secondary)' }}>
                  {badge.text}
                </span>
                <div className="h-1 w-1 rounded-full bg-[#00C076] opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="h-full w-full rounded-full bg-[#00C076] animate-ping" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <Footer />
      </main>

    </div>
  );
};

export default DesktopPage;
