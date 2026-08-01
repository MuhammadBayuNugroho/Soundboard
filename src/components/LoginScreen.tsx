import React from 'react'
import { Music, LogIn } from 'lucide-react'

interface LoginScreenProps {
  onLogin: () => void
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-6 text-slate-100">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/50 p-8 text-center backdrop-blur-md shadow-2xl">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
          <Music className="h-10 w-10" />
        </div>
        
        <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-white">
          Theater Sound Deck
        </h1>
        <p className="mb-8 text-sm text-slate-400">
          Pengatur Musik & Efek Suara Pertunjukan Teater. Hubungkan dengan Google Drive untuk memutar musik secara offline.
        </p>

        <button
          onClick={onLogin}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 px-6 py-4 font-bold text-white shadow-lg shadow-indigo-600/25 transition-all duration-150"
        >
          <LogIn className="h-5 w-5" />
          Masuk dengan Google
        </button>

        <div className="mt-8 text-[11px] text-slate-500">
          Aplikasi ini memerlukan akses ke Google Drive Anda untuk menyimpan dan mengunduh file audio khusus pertunjukan teater.
        </div>
      </div>
    </div>
  )
}
