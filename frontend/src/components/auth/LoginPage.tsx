import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { isAuthenticated, signIn } from '../../auth'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const redirectTarget = useMemo(() => {
    const state = location.state as { from?: { pathname?: string } } | null
    return state?.from?.pathname || '/'
  }, [location.state])

  if (isAuthenticated()) {
    return <Navigate to={redirectTarget} replace />
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const ok = signIn(userId.trim(), password)
    if (!ok) {
      setError('Invalid NetID or password.')
      return
    }

    navigate(redirectTarget, { replace: true })
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#dce7f0]">
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(8, 35, 62, 0.18) 0%, rgba(8, 35, 62, 0.08) 45%, rgba(16, 22, 28, 0.18) 100%), url('/logo-bg.jpg')",
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
        }}
      />

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-[600px] overflow-hidden bg-white shadow-[0_10px_26px_rgba(27,40,56,0.22)]">
          <div className="grid gap-8 px-9 py-9 md:grid-cols-[0.95fr_1.05fr]">
            <div className="flex items-center justify-center">
              <img
                src="/utdlogo.png"
                alt="The University of Texas at Dallas"
                className="h-auto w-[220px] object-contain"
              />
            </div>

            <div className="pt-0.5">
              <form className="space-y-3.5" onSubmit={onSubmit}>
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-[#202833]" htmlFor="netid">
                    NetID
                  </label>
                  <input
                    id="netid"
                    type="text"
                    value={userId}
                    onChange={(event) => setUserId(event.target.value)}
                    placeholder="RX1240022"
                    className="h-[36px] w-full rounded-[2px] border border-[#aeb8c6] bg-[#dfe5ef] px-3 text-[13px] text-[#1f2937] outline-none transition focus:border-[#0f6b44] focus:ring-2 focus:ring-[#0f6b44]/15"
                    autoComplete="username"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-[#202833]" htmlFor="password">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••••••••"
                    className="h-[36px] w-full rounded-[2px] border border-[#aeb8c6] bg-[#dfe5ef] px-3 text-[13px] text-[#1f2937] outline-none transition focus:border-[#0f6b44] focus:ring-2 focus:ring-[#0f6b44]/15"
                    autoComplete="current-password"
                  />
                </div>

                {error ? (
                  <div className="-mt-1 text-[12px] font-medium text-[#c0392b]">{error}</div>
                ) : (
                  <div className="-mt-1 h-0" />
                )}

                <button
                  type="submit"
                  className="h-[34px] w-full rounded-[2px] bg-gradient-to-b from-[#13724f] to-[#0d5f42] text-[13px] font-semibold text-white transition hover:brightness-95"
                >
                  Login
                </button>
              </form>

              <div className="mt-5 text-center text-[12px] leading-[1.25] text-[#0d5e87]">
                <p>
                  Need Help?{' '}
                  <a href="#" className="underline underline-offset-2">
                    Contact the Service Desk
                  </a>
                </p>
                <p>
                  Forgot Password?{' '}
                  <a href="#" className="underline underline-offset-2">
                    Reset Your Password
                  </a>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#0b6144] px-4 py-3 text-center text-[13px] font-semibold text-white">
            Do Not Bookmark This Page
          </div>
        </div>
      </div>
    </div>
  )
}
