import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, ArrowLeft, User, Key, Lock } from 'lucide-react';
import { requestPasswordReset, submitNewPassword } from '../services/api';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Increasing line graph animation state for continuity with Auth pages
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

  const handleRequestToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await requestPasswordReset(username, email);
      if (res.success) {
        setSuccessMsg(res.message || "Password reset token sent to your email.");
        setStep(2);
      } else {
        setErrorMsg(res.error || "Failed to request password reset");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await submitNewPassword(token, newPassword);
      if (res.success) {
        setSuccessMsg("Password reset successfully! You can now sign in.");
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setErrorMsg(res.error || "Failed to reset password");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1017] text-white flex font-sans overflow-hidden">
      {/* Left Column - Visuals & Branding */}
      <div className="hidden lg:flex flex-col w-1/2 relative justify-between bg-black overflow-hidden border-r border-white/5">
        
        {/* Top Text Content */}
        <div className="relative z-20 p-12 lg:p-20 pb-0 lg:pb-0 pointer-events-auto">
          <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-[#00e68e]">
            {step === 1 ? 'Reset your password' : 'Create new password'}
          </h1>
          <p className="text-gray-400 text-lg mb-8 max-w-md">
            {step === 1
              ? 'Enter your registered username and email address to get a secure reset token.'
              : 'Enter the secure token sent to your email and your new password.'}
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
          
          <button 
            onClick={() => step === 1 ? navigate('/login') : setStep(1)} 
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8 text-[13px] font-medium group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> 
            {step === 1 ? 'Back to sign in' : 'Back to email request'}
          </button>

          <h2 className="text-2xl font-semibold mb-8">
            {step === 1 ? 'Forgot Password?' : 'Enter New Password'}
          </h2>

          <form onSubmit={step === 1 ? handleRequestToken : handleResetPassword} className="space-y-5">
            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-md">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="bg-[#00e68e]/10 border border-[#00e68e]/50 text-[#00e68e] text-sm p-3 rounded-md">
                {successMsg}
              </div>
            )}

            {step === 1 ? (
              <>
                {/* Username */}
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-gray-200">Username</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-4 w-4 text-gray-400" />
                    </div>
                    <input 
                      type="text" 
                      value={username} 
                      onChange={(e) => setUsername(e.target.value)} 
                      className="w-full bg-[#11141c] border border-white/10 rounded-md py-2 pl-9 pr-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                      placeholder="Enter your username" 
                      required 
                    />
                  </div>
                </div>

                {/* Email address */}
                <div className="space-y-1.5 pt-2">
                  <label className="text-[13px] font-medium text-gray-200">Email address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-gray-400" />
                    </div>
                    <input 
                      type="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      className="w-full bg-[#11141c] border border-white/10 rounded-md py-2 pl-9 pr-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                      placeholder="name@company.com" 
                      required 
                    />
                  </div>
                </div>

                <div className="pt-6">
                  <button 
                    type="submit" 
                    disabled={isLoading} 
                    className="w-full bg-gradient-to-r from-white to-[#00e68e] hover:shadow-[0_0_20px_rgba(0,230,142,0.4)] text-gray-900 border border-white/20 font-semibold py-2.5 rounded-md transition-all flex items-center justify-center gap-2"
                  >
                    {isLoading ? 'Requesting...' : <>Request Reset Token <ArrowRight className="h-4 w-4" /></>}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Reset Token */}
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-gray-200">Reset Token</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Key className="h-4 w-4 text-gray-400" />
                    </div>
                    <input 
                      type="text" 
                      value={token} 
                      onChange={(e) => setToken(e.target.value)} 
                      className="w-full bg-[#11141c] border border-white/10 rounded-md py-2 pl-9 pr-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                      placeholder="Enter token from email" 
                      required 
                    />
                  </div>
                </div>

                {/* New Password */}
                <div className="space-y-1.5 pt-2">
                  <label className="text-[13px] font-medium text-gray-200">New Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-gray-400" />
                    </div>
                    <input 
                      type="password" 
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)} 
                      className="w-full bg-[#11141c] border border-white/10 rounded-md py-2 pl-9 pr-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                      placeholder="••••••••" 
                      required 
                      minLength={6} 
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 leading-tight pt-1">
                    Password must be at least 6 characters long.
                  </p>
                </div>

                <div className="pt-6">
                  <button 
                    type="submit" 
                    disabled={isLoading} 
                    className="w-full bg-gradient-to-r from-white to-[#00e68e] hover:shadow-[0_0_20px_rgba(0,230,142,0.4)] text-gray-900 border border-white/20 font-semibold py-2.5 rounded-md transition-all flex items-center justify-center gap-2"
                  >
                    {isLoading ? 'Resetting...' : <>Set New Password <ArrowRight className="h-4 w-4" /></>}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
