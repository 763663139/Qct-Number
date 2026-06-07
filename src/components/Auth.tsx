import React, { useState, useEffect } from 'react';
import { KeyRound, ShieldAlert, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';

interface AuthProps {
  onAuthenticated: () => void;
}

export default function Auth({ onAuthenticated }: AuthProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Simulate slight decryption timeout for professional feel
    setTimeout(() => {
      // Exactly matches direct verification algorithm: Yh763663139
      if (password === 'Yh763663139') {
        const timestamp = new Date().getTime();
        localStorage.setItem('_authenticated_token', 'TRUE');
        localStorage.setItem('_authenticated_time', timestamp.toString());
        onAuthenticated();
      } else {
        setError('访问密码校验错误，请重新输入！');
        setLoading(false);
      }
    }, 450);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0] flex flex-col justify-between items-center px-4 relative overflow-hidden font-sans">
      {/* Decorative high-tech elegant rings from Artistic Flair design HTML */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 select-none pointer-events-none z-0">
        <div className="w-[500px] h-[500px] border border-white/5 rounded-full flex items-center justify-center">
          <div className="w-[400px] h-[400px] border border-white/5 rounded-full flex items-center justify-center">
            <div className="w-[300px] h-[300px] border border-[#38bdf8]/10 rounded-full flex items-center justify-center">
              <div className="w-[200px] h-[200px] border border-white/5 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Spacing top */}
      <div className="h-10" />

      {/* Main card */}
      <div className="w-full max-w-md bg-[#111111] border border-white/10 rounded-none p-8 shadow-2xl relative z-10 my-auto">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 bg-white/5 border border-white/10 text-[#38bdf8] rounded-full flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(56,189,248,0.2)]">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold uppercase tracking-[0.2em] text-white mb-2">AETHER OS STATS</h1>
          <p className="text-white/40 text-xs uppercase tracking-widest leading-relaxed">
            直通车数据提取与拼多多销量统计平台
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-white/50 uppercase tracking-[0.25em] pl-1 block">
              SYSTEM SECURITY KEY / 授权访问密码
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="KEY_CODE_INPUT..."
                className="w-full bg-black/60 border border-white/10 focus:border-[#38bdf8] rounded-none py-3.5 pl-4 pr-12 text-white placeholder-white/20 transition-colors font-mono outline-none text-sm tracking-wide"
                disabled={loading}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] uppercase tracking-wider px-4 py-3 rounded-none flex items-center gap-2.5 animate-pulse">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full cursor-pointer bg-white/5 border border-white/10 text-white hover:bg-white hover:text-black font-semibold text-[11px] uppercase tracking-[0.3em] py-4 rounded-none transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>VERIFY & ENTER / 进入</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/10 text-center">
          <p className="text-white/30 text-[10px] uppercase tracking-[0.1em]">
            Internal Core Access Reserved. Do not distribute.
          </p>
        </div>
      </div>

      {/* Footer copyright */}
      <div className="py-6 text-center text-white/20 text-[10px] uppercase tracking-[0.2em]">
        QCT & PDD Data Consolidation Platform &bull; Environmental Intelligence v4.0
      </div>
    </div>
  );
}
