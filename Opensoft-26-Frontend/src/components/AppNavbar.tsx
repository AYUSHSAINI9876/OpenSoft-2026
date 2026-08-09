import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, LogOut, Settings } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

type NavbarTab = 'markets' | 'terminal' | 'portfolio' | 'settings'

type NavItem = {
  id: Exclude<NavbarTab, 'settings'>
  label: string
  path: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'markets', label: 'Markets', path: '/markets' },
  { id: 'terminal', label: 'Terminal', path: '/terminal' },
  { id: 'portfolio', label: 'Portfolio', path: '/portfolio' },
]

export default function AppNavbar({ activeTab }: { activeTab: NavbarTab }) {
  const navigate = useNavigate()
  const location = useLocation()
  // Sourced from the auth context so the navbar re-renders on sign-in/out and
  // on cross-tab session changes, rather than reading stale localStorage.
  const { user, isAuthenticated, signOut } = useAuth()
  const username = user?.username || 'Trader'

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!menuRef.current) return
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const handleSignOut = () => {
    signOut()
    setMenuOpen(false)
    navigate('/')
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 transition-colors duration-300" style={{ backgroundColor: 'var(--bg-primary)', backdropFilter: 'blur(12px)' }}>
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 md:px-8">
        <div className="flex items-center gap-8">
          <button onClick={() => navigate('/')} className="flex items-center gap-2.5 group">
            <img
              src="/branding/oak-capital-logo.png"
              alt="Oak Capital logo"
              className="h-8 w-8 rounded-sm object-cover shadow-[0_0_15px_rgba(0,192,118,0.3)] transition-opacity group-hover:opacity-90"
            />
            <span className="text-xl font-black tracking-tighter" style={{ color: 'var(--text-primary)' }}>OAK CAPITAL</span>
          </button>

          <div className="hidden md:flex items-center gap-7 text-sm">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.path)}
                  className="transition-colors"
                  style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
        {isAuthenticated ? (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-sm border px-2.5 py-1.5 text-sm font-medium transition-all"
              style={{ backgroundColor: 'rgba(var(--text-primary-rgb), 0.03)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            >
              <div className="w-8 h-8 rounded-sm bg-gradient-to-br from-[#00C076] to-white flex items-center justify-center text-[#0B0E14] font-black uppercase text-sm shadow-[0_0_12px_rgba(0,192,118,0.2)]">
                {username.charAt(0)}
              </div>
              <span className="hidden sm:block truncate max-w-[120px]">{username}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--text-secondary)' }} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-44 rounded-sm border p-1.5 shadow-2xl shadow-black/40" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    navigate('/settings')
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm transition-colors hover:bg-white/5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm transition-colors hover:bg-white/5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="text-sm font-semibold transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              Log in
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="rounded-sm bg-gradient-to-r from-[#00C076] to-white px-4 py-2 text-sm font-bold text-[#0B0E14] transition hover:opacity-90"
            >
              Sign up
            </button>
          </div>
        )}
        </div>
      </div>

      <div className="border-t border-[#2A2E39] px-4 py-2 md:hidden">
        <div className="mx-auto flex max-w-[1400px] items-center gap-2 overflow-x-auto no-scrollbar">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className="rounded-sm px-3 py-1.5 text-[12px] font-semibold transition-colors"
                style={{ 
                  backgroundColor: isActive ? 'rgba(var(--text-primary-rgb), 0.1)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)'
                }}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
