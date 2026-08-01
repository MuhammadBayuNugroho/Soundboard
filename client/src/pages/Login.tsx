import React, { useState } from 'react';
import axios from 'axios';
import { Lock, User, Eye, EyeOff, Radio } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (token: string) => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, showToast }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      showToast('Harap isi username dan password!', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/auth/login', { username, password });
      const { token } = res.data;
      
      if (rememberMe) {
        localStorage.setItem('sacp_token', token);
      } else {
        sessionStorage.setItem('sacp_token', token);
      }
      
      showToast('Login operator berhasil!', 'success');
      onLoginSuccess(token);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Gagal login. Hubungi administrator.';
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg px-4">
      <div className="w-full max-w-md bg-dark-surface border border-dark-border rounded-xl p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent-orange via-accent-blue to-accent-green" />

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-dark-bg border border-dark-border rounded-full text-accent-orange mb-4 shadow-inner">
            <Radio className="w-8 h-8 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">SACP LOGIN</h1>
          <p className="text-slate-400 text-sm mt-1">Stage Audio Control Panel Operator</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Username Field */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <User className="w-5 h-5" />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username..."
                className="w-full bg-dark-bg border border-dark-border rounded-lg pl-10 pr-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-colors text-sm"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Lock className="w-5 h-5" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password..."
                className="w-full bg-dark-bg border border-dark-border rounded-lg pl-10 pr-12 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-colors text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Remember me & submit */}
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded bg-dark-bg border-dark-border text-accent-blue focus:ring-accent-blue w-4 h-4 mr-2"
              />
              Ingat Login
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-accent-blue to-blue-700 hover:from-blue-700 hover:to-accent-blue text-slate-100 font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-blue-900/30 transition-all flex items-center justify-center text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin mr-2" />
            ) : null}
            MASUK PANEL
          </button>
        </form>

        <div className="text-center mt-8 text-xs text-slate-500 border-t border-dark-border/40 pt-4">
          Stage Soundboard PWA &bull; Hak Akses Terbatas
        </div>
      </div>
    </div>
  );
};
