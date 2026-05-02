import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, ArrowLeft } from 'lucide-react';
import { login } from '../services/api';
import { formatAuthError } from '../utils/errorFormatter';

const SignInPage = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Increasing line graph animation state
  const [chartData, setChartData] = useState(() => 
    Array.from({ length: 40 }, (_, i) => 15 + (i * 2) + (Math.random() * 10 - 5))
  );
  
  useEffect(() => {
    const interval = setInterval(() => {
      setChartData(prev => 
        prev.map((_, i) => {
          const base = 15 + (i * 2);
          const jitter = Math.random() * 15 - 7.5;
          return Math.max(5, Math.min(95, base + jitter));
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await login(username, password);
      if (res.success) {
        navigate('/portfolio', { replace: true });
      } else {
        setErrorMsg(formatAuthError(res.error || 'Login failed'));
      }
    } catch (err: any) {
      setErrorMsg(formatAuthError(err.message || 'An error occurred during login'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1017] text-white flex font-sans overflow-hidden relative">
      {/* Back to Home Button */}
      <button
        onClick={() => navigate('/', { replace: true })}
        className="absolute top-6 left-6 z-50 flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 border border-white/10 group-hover:bg-white/10 transition-all">
          <ArrowLeft className="h-4 w-4" />
        </div>
        <span className="text-sm font-medium hidden sm:inline">Back to Home</span>
      </button>

      {/* Left Column - Visuals & Branding */}
      <div className="hidden lg:flex flex-col w-1/2 relative justify-between bg-black overflow-hidden border-r border-white/5">
        
        {/* Top Text Content (Original) */}
        <div className="relative z-20 p-12 lg:p-20 pb-0 lg:pb-0 pointer-events-auto">
          <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-[#00e68e]">
            Welcome back
          </h1>
          <p className="text-gray-400 text-lg mb-8 max-w-md">
            Sign in to access your dashboard, trade on the simulated exchange, and monitor your AI bots.
          </p>
        </div>

        {/* Perspective Grid Floor */}
        <div className="absolute bottom-0 left-0 w-full h-[45%] z-0 pointer-events-none flex items-end justify-center overflow-hidden">
          <div 
            className="w-[200%] h-[200%] opacity-20 origin-bottom"
            style={{
              backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.8) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
              transform: 'perspective(800px) rotateX(75deg) translateY(50px)',
            }}
          />
          {/* Glowing 915 text */}
          <div className="absolute bottom-[20%] left-[32%] text-[#00e68e] font-sans text-5xl font-black italic tracking-widest drop-shadow-[0_0_15px_rgba(0,230,142,0.8)]" style={{ transform: 'perspective(800px) rotateX(60deg) skewX(-15deg)' }}>
            915
          </div>
          {/* Floor fade to black */}
          <div className="absolute inset-0 bg-gradient-to-t from-transparent via-black/60 to-black"></div>
        </div>

        {/* Floating Trading Dashboard UI */}
        <div className="relative z-10 w-full max-w-[90%] mx-auto flex-1 flex flex-col justify-end items-center pointer-events-none pb-0">
          
          {/* Dashboard Panel */}
          <div className="w-[95%] aspect-[16/10] bg-[#050608]/90 backdrop-blur-xl rounded-t-2xl border-t border-x border-white/10 shadow-[0_-20px_60px_rgba(0,230,142,0.05)] flex flex-col overflow-hidden relative">
            
            {/* Subtle glow light bar at the top edge */}
            <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#00e68e]/40 to-transparent"></div>

            {/* Content Layout */}
            <div className="flex-1 flex w-full h-full relative z-10 pt-2">
              {/* Left Chart Area */}
              <div className="flex-[2.5] relative border-r border-white/5 p-4 flex flex-col overflow-hidden">
                <div className="absolute top-4 left-4 z-20">
                   <div className="text-[10px] text-gray-400 font-mono mb-1">NXT/USD · YTD</div>
                   <div className="text-xl text-[#00e68e] font-sans font-bold tracking-tight">+42.8%</div>
                </div>
                
                <div className="flex-1 w-full h-full relative mt-8">
                  <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <defs>
                      <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00e68e" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#00e68e" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path 
                      d={`M0,100 ${chartData.map((val, i) => `L${(i / (chartData.length - 1)) * 100},${100 - val}`).join(' ')} L100,100 Z`}
                      fill="url(#lineGrad)"
                      className="transition-all duration-1000 ease-in-out"
                    />
                    <path 
                      d={`M ${chartData.map((val, i) => `${(i / (chartData.length - 1)) * 100},${100 - val}`).join(' L ')}`}
                      fill="none"
                      stroke="#00e68e"
                      strokeWidth="2.5"
                      vectorEffect="non-scaling-stroke"
                      className="transition-all duration-1000 ease-in-out"
                      style={{ filter: 'drop-shadow(0 0 6px rgba(0,230,142,0.6))' }}
                    />
                  </svg>
                </div>
              </div>
              
              {/* Right Orderbook Area */}
              <div className="flex-[1] flex flex-col p-3 gap-1 overflow-hidden bg-transparent">
                <div className="text-[7px] text-gray-500 font-mono border-b border-white/5 pb-1 mb-1">ORDER BOOK</div>
                <div className="flex flex-col justify-start gap-[2px]">
                  {Array.from({length: 8}).map((_, i) => (
                    <div key={'ask'+i} className="flex justify-between items-center text-[7px] font-mono">
                      <span className="text-[#FF4560]">{(42450 + i * 2.5).toFixed(1)}</span>
                      <span className="text-gray-500">{(Math.random() * 2).toFixed(3)}</span>
                    </div>
                  ))}
                  <div className="text-[#00e68e] font-mono text-[9px] font-bold py-1 border-y border-white/5 my-0.5 tracking-wider text-center">
                    42,448.50
                  </div>
                  {Array.from({length: 8}).map((_, i) => (
                    <div key={'bid'+i} className="flex justify-between items-center text-[7px] font-mono">
                      <span className="text-[#00e68e]">{(42445 - i * 1.5).toFixed(1)}</span>
                      <span className="text-gray-500">{(Math.random() * 2).toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Faint glass reflection */}
            <div className="absolute top-[-50%] left-[-20%] w-[150%] h-[150%] bg-gradient-to-br from-white/[0.04] to-transparent rotate-12 pointer-events-none z-20"></div>
          </div>
        </div>

      </div>

      {/* Right Column - Form */}
      <div className="w-full lg:w-1/2 flex flex-col items-center p-8 sm:p-12 xl:p-24 overflow-y-auto h-screen">
        <div className="w-full max-w-[420px] my-auto py-8">
          <div className="mb-6 flex items-center gap-3">
            <img
              src="/branding/oak-capital-logo.png"
              alt="Oak Capital logo"
              className="h-9 w-9 rounded-sm object-cover"
            />
            <div>
              <div className="text-lg font-bold text-white">Oak Capital</div>
            </div>
          </div>

          <h2 className="text-2xl font-semibold mb-8">Sign in to your Oak Capital account</h2>

          {/* Form */}
          <form onSubmit={handleSignIn} className="space-y-5">
            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-md">
                {errorMsg}
              </div>
            )}

            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-gray-200">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#11141c] border border-white/10 rounded-md py-2 pl-9 pr-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="john_doe"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-[13px] font-medium text-gray-200">Password</label>
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-[12px] text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#11141c] border border-white/10 rounded-md py-2 pl-9 pr-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-white to-[#00e68e] text-gray-900 hover:shadow-[0_0_20px_rgba(0,230,142,0.4)] font-semibold py-2.5 rounded-md transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? 'Signing in...' : (
                  <>
                    Sign in <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>

          </form>

          {/* Toggle Link */}
          <div className="mt-8 text-center text-[13px] text-gray-400">
            Don't have an account?{' '}
            <button
              onClick={() => navigate('/signup')}
              className="text-white font-semibold hover:text-blue-400 transition-colors"
            >
              Sign up
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignInPage;
