import React from 'react'
import { Lock, Unlock, LogOut, Disc } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'

interface HeaderProps {
  onLogout: () => void
}

export const Header: React.FC<HeaderProps> = ({ onLogout }) => {
  const { isLocked, toggleLock, userName, userAvatar } = useAppStore()

  return (
    <header className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-slate-900 px-6 py-4 shadow-xl">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
          <Disc className="h-6 w-6 animate-spin" style={{ animationDuration: '6s' }} />
        </div>
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-wide text-white">
            Theater Sound Deck
            <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/30">
              {isLocked ? 'Pentas Mode' : 'Edit Mode'}
            </span>
          </h1>
          <p className="text-[11px] text-slate-400">Pengatur Musik & Efek Suara Teater</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Toggle Lock Button */}
        <button
          onClick={toggleLock}
          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-all duration-150 active:scale-95 ${
            isLocked
              ? 'border-emerald-500/40 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20'
              : 'border-amber-500/40 bg-amber-600/10 text-amber-400 hover:bg-amber-600/20'
          }`}
        >
          {isLocked ? (
            <>
              <Lock className="h-4 w-4" />
              Pentas Terkunci
            </>
          ) : (
            <>
              <Unlock className="h-4 w-4" />
              Buka Kunci (Edit)
            </>
          )}
        </button>

        {/* User Info & Logout */}
        <div className="flex items-center gap-3 border-l border-slate-800 pl-4">
          {userAvatar && (
            <img
              src={userAvatar}
              alt={userName}
              className="h-8 w-8 rounded-full border border-slate-700 object-cover"
              referrerPolicy="no-referrer"
            />
          )}
          <span className="hidden text-sm font-medium text-slate-300 sm:block max-w-[120px] truncate">
            {userName}
          </span>
          <button
            onClick={onLogout}
            title="Keluar"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-red-400 transition-colors duration-150"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
