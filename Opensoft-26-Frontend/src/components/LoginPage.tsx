import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Globe, ArrowRight, ArrowLeft } from 'lucide-react';
import { register } from '../services/api';
import { formatAuthError } from '../utils/errorFormatter';

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [country, setCountry] = useState('India');
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await register(username, email, password);
      if (res.success) {
        navigate('/portfolio', { replace: true });
      } else {
        setErrorMsg(formatAuthError(res.error || 'Registration failed'));
      }
    } catch (err: any) {
      setErrorMsg(formatAuthError(err.message || 'An error occurred during registration'));
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
            Create your free account
          </h1>
          <p className="text-gray-400 text-lg mb-8 max-w-md">
            Explore Oak Capital's core features for traders, quants, and institutions.
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
          
          <h2 className="text-2xl font-semibold mb-8">Sign up for Oak Capital</h2>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            
            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-md">
                {errorMsg}
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-gray-200">Email<span className="text-red-500 ml-0.5">*</span></label>
              <div className="relative">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#11141c] border border-white/10 rounded-md py-2 pl-9 pr-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Email"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-gray-200">Password<span className="text-red-500 ml-0.5">*</span></label>
              <div className="relative">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#11141c] border border-white/10 rounded-md py-2 pl-9 pr-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Password"
                  required
                />
              </div>
              <p className="text-[11px] text-gray-500 leading-tight pt-1">
                Password should be at least 15 characters OR at least 8 characters including a number and a lowercase letter.
              </p>
            </div>

            {/* Username */}
            <div className="space-y-1.5 pt-2">
              <label className="text-[13px] font-medium text-gray-200">Username<span className="text-red-500 ml-0.5">*</span></label>
              <div className="relative">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#11141c] border border-white/10 rounded-md py-2 pl-9 pr-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Username"
                  required
                />
              </div>
              <p className="text-[11px] text-gray-500 leading-tight pt-1">
                Username may only contain alphanumeric characters or single hyphens, and cannot begin or end with a hyphen.
              </p>
            </div>

            {/* Country/Region */}
            <div className="space-y-1.5 pt-2">
              <label className="text-[13px] font-medium text-gray-200">Your Country/Region<span className="text-red-500 ml-0.5">*</span></label>
              <div className="relative">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Globe className="h-4 w-4 text-gray-400" />
                </div>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full bg-[#11141c] border border-white/10 rounded-md py-2 pl-9 pr-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors appearance-none"
                >
                  <option value="India">India</option>
                  <option value="United States">United States</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Singapore">Singapore</option>
                  <option value="United Arab Emirates">United Arab Emirates</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
              <p className="text-[11px] text-gray-500 leading-tight pt-1">
                For compliance reasons, we're required to collect country information to send you occasional updates and announcements.
              </p>
            </div>

            {/* Email Preferences */}
            <div className="pt-2">
              <label className="text-[13px] font-medium text-gray-200 block mb-2">Email preferences</label>
              <div className="flex items-start gap-2">
                <input type="checkbox" className="mt-1 bg-[#11141c] border-white/20 rounded text-blue-500 focus:ring-blue-500/50" defaultChecked />
                <span className="text-[12px] text-gray-400 leading-tight">Receive occasional product updates and announcements.</span>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-white to-[#00e68e] hover:shadow-[0_0_20px_rgba(0,230,142,0.4)] text-gray-900 border border-white/20 font-semibold py-2.5 rounded-md transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? 'Creating account...' : (
                    <>
                    Create account <ArrowRight className="h-4 w-4" />
                    </>
                )}
              </button>
            </div>

          </form>

          {/* Toggle link */}
          <div className="mt-8 text-center text-[13px] text-gray-400">
            Already have an account?{' '}
            <button 
                onClick={() => navigate('/login')}
                className="text-white font-semibold hover:text-blue-400 transition-colors"
            >
                Sign in
            </button>
          </div>

          {/* Terms text */}
          <div className="mt-8 text-[11px] text-gray-500 leading-relaxed">
            By creating an account, you agree to the <a href="#" className="text-blue-400 hover:underline">Terms of Service</a>. For more information about Oak Capital's privacy practices, see the <a href="#" className="text-blue-400 hover:underline">Oak Capital Privacy Statement</a>. We'll occasionally send you account-related emails.
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
