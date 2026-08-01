import React, { useState } from 'react'
import { Music, Delete } from 'lucide-react'

interface LoginScreenProps {
  onLoginWithPIN: (pin: string) => boolean
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginWithPIN }) => {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  const handleKeyPress = (num: string) => {
    if (pin.length >= 4) return
    setError(false)
    const newPin = pin + num
    setPin(newPin)

    // Jika sudah 4 digit, otomatis validasi
    if (newPin.length === 4) {
      const success = onLoginWithPIN(newPin)
      if (!success) {
        setTimeout(() => {
          setError(true)
          setPin('') // Reset PIN jika salah
        }, 150)
      }
    }
  }

  const handleDelete = () => {
    setError(false)
    setPin(pin.slice(0, -1))
  }

  const handleClear = () => {
    setError(false)
    setPin('')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-6 text-slate-100 select-none">
      <div className="w-full max-w-sm rounded-3xl border border-slate-900 bg-slate-900/60 p-6 text-center backdrop-blur-md shadow-2xl">
        
        {/* Logo */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
          <Music className="h-8 w-8" />
        </div>
        
        <h1 className="text-2xl font-black tracking-tight text-white mb-1">
          Theater Sound Deck
        </h1>
        <p className="text-xs text-slate-400 mb-6">
          Masukkan PIN untuk mengoperasikan papan suara
        </p>

        {/* PIN Dots Indicator */}
        <div className="flex justify-center gap-4 mb-6">
          {[0, 1, 2, 3].map((index) => {
            const isActive = pin.length > index
            return (
              <div
                key={index}
                className={`h-4.5 w-4.5 rounded-full border transition-all duration-100 ${
                  error
                    ? 'bg-red-500 border-red-500 animate-bounce'
                    : isActive
                    ? 'bg-indigo-500 border-indigo-500 scale-110 shadow-lg shadow-indigo-500/50'
                    : 'border-slate-700 bg-slate-950'
                }`}
              />
            )
          })}
        </div>

        {/* Error message */}
        <div className="h-5 mb-2 text-xs font-bold text-red-500">
          {error && 'PIN Salah! Coba lagi.'}
        </div>

        {/* Keyboard Numpad */}
        <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num)}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 hover:bg-slate-800 active:scale-90 border border-slate-800 text-xl font-extrabold text-white transition-all select-none"
            >
              {num}
            </button>
          ))}

          {/* Tombol Clear */}
          <button
            onClick={handleClear}
            className="flex h-16 w-16 items-center justify-center rounded-full text-xs font-bold text-slate-500 hover:text-slate-300 active:scale-90 select-none"
          >
            Clear
          </button>

          {/* Angka 0 */}
          <button
            onClick={() => handleKeyPress('0')}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 hover:bg-slate-800 active:scale-90 border border-slate-800 text-xl font-extrabold text-white transition-all select-none"
          >
            0
          </button>

          {/* Tombol Backspace */}
          <button
            onClick={handleDelete}
            className="flex h-16 w-16 items-center justify-center rounded-full text-slate-500 hover:text-red-400 active:scale-90 select-none"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>

        {/* Petunjuk PIN */}
        <div className="mt-8 rounded-xl bg-slate-950/60 border border-slate-850 p-3 text-[11px] text-slate-500">
          Operator Pentas PIN: <strong className="text-slate-400 font-mono text-xs ml-0.5">1234</strong>
        </div>
      </div>
    </div>
  )
}
