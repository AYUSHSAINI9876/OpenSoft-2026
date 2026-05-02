import { useState } from 'react'
import { Bell, ChevronLeft, Shield, UserCircle2, Zap, Key, Smartphone, QrCode, ChevronDown } from 'lucide-react'
import AppNavbar from './AppNavbar'

type Section = 'profile' | 'notifications' | 'security' | 'appearance' | 'trading' | null

function CustomSelect({ label, options, value, onChange }: { label: string, options: { label: string, value: string }[], value: string, onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const selectedOption = options.find(o => o.value === value)

  return (
    <div className="relative">
      <label className="block text-sm font-medium opacity-50 mb-1">{label}</label>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-4 py-2 outline-none transition-all hover:bg-white/10"
        style={{ borderColor: 'rgba(255,255,255,0.1)' }}
      >
        <span>{selectedOption?.label}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="custom-select-list absolute top-full left-0 right-0 z-20 mt-2 max-h-48 overflow-y-auto rounded-md py-1 animate-in fade-in slide-in-from-top-2 duration-200">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className="custom-select-item w-full px-4 py-2 text-left text-sm transition-colors"
                style={opt.value === value ? { color: 'var(--accent-color)' } : {}}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const placeholderSections = [
  {
    id: 'profile',
    title: 'Profile Preferences',
    desc: 'Manage your personal info, contact details, and regional preferences.',
    icon: UserCircle2,
  },
  {
    id: 'notifications',
    title: 'Notifications',
    desc: 'Configure push, email, and in-app alerts for trades and account activity.',
    icon: Bell,
  },
  {
    id: 'security',
    title: 'Security',
    desc: 'Secure your account with 2FA, API keys, and session management.',
    icon: Shield,
  },
  {
    id: 'trading',
    title: 'Trading Preferences',
    desc: 'Fine-tune your execution defaults and interface behavior for speed.',
    icon: Zap,
  },
]

function ProfileForm({ username, settings, onUpdate }: { username: string, settings: any, onUpdate: (key: string, val: any) => void }) {
  const [name, setName] = useState(username)
  const [email, setEmail] = useState('')
  const [saved, setSaved] = useState(false)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    if (name) localStorage.setItem('username', name)
  }

  return (
    <form onSubmit={handleSave} className="max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-bold text-white mb-6">Profile Preferences</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium opacity-50 mb-1">Username</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-2 outline-none focus:ring-1 transition-all"
            style={{ '--tw-ring-color': 'var(--accent-color)', borderColor: 'rgba(255,255,255,0.1)' } as React.CSSProperties}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="trader@oakcapital.com"
            className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-2 text-white outline-none focus:border-[#00C076] transition-colors"
          />
        </div>
        <div className="relative">
          <label className="block text-sm font-medium text-slate-400 mb-1">Phone Number</label>
          <div className="flex gap-2">
            <select
              className="w-28 rounded-md border border-white/10 bg-white/5 px-2 py-2 text-white outline-none focus:border-[#00C076] transition-colors text-sm appearance-none cursor-pointer hover:bg-white/10"
              value={settings.phoneCode || '+91'}
              onChange={(e) => onUpdate('phoneCode', e.target.value)}
            >
              <option value="+91" className="bg-[#0B0E14]">🇮🇳 IN +91</option>
              <option value="+1" className="bg-[#0B0E14]">🇺🇸 US +1</option>
              <option value="+44" className="bg-[#0B0E14]">🇬🇧 UK +44</option>
              {/* Added more countries as requested */}
              <option value="+971" className="bg-[#0B0E14]">🇦🇪 AE +971</option>
              <option value="+81" className="bg-[#0B0E14]">🇯🇵 JP +81</option>
              <option value="+49" className="bg-[#0B0E14]">🇩🇪 DE +49</option>
              <option value="+33" className="bg-[#0B0E14]">🇫🇷 FR +33</option>
              <option value="+65" className="bg-[#0B0E14]">🇸🇬 SG +65</option>
            </select>
            <input
              type="tel"
              placeholder="90000 00000"
              className="flex-1 rounded-md border border-white/10 bg-white/5 px-4 py-2 text-white outline-none focus:border-[#00C076] transition-colors"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <CustomSelect
            label="Default Currency"
            value={settings.currency || 'USD'}
            options={[
              { label: '🇺🇸 USD ($)', value: 'USD' },
              { label: '🇪🇺 EUR (€)', value: 'EUR' },
              { label: '🇬🇧 GBP (£)', value: 'GBP' },
              { label: '🇦🇪 AED (د.إ)', value: 'AED' }
            ]}
            onChange={(val) => onUpdate('currency', val)}
          />
          <CustomSelect
            label="Timezone"
            value={settings.timezone || 'IST'}
            options={[
              { label: '🇮🇳 India (IST)', value: 'IST' },
              { label: '🌍 Global (UTC)', value: 'UTC' },
              { label: '🇺🇸 New York (EST)', value: 'EST' },
              { label: '🇬🇧 London (GMT)', value: 'GMT' },
              { label: '🇦🇪 Dubai (GST)', value: 'GST' }
            ]}
            onChange={(val: string) => onUpdate('timezone', val)}
          />
        </div>
      </div>

      <div className="mt-8 flex items-center gap-4">
        <button
          type="submit"
          className="rounded-md px-6 py-2 text-sm font-bold transition-all hover:scale-105 active:scale-95"
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}
        >
          Save Changes
        </button>
        {saved && <span className="text-sm font-medium" style={{ color: 'var(--accent-color)' }}>Saved successfully!</span>}
      </div>
    </form>
  )
}

function ToggleRow({ label, desc, active, onChange }: { label: string, desc: string, active: boolean, onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="font-semibold text-slate-200">{label}</div>
        <div className="text-sm text-slate-500">{desc}</div>
      </div>
      <button
        onClick={() => onChange(!active)}
        className="relative inline-flex h-6 w-11 items-center rounded-full transition-all"
        style={{ backgroundColor: active ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)' }}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${active ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  )
}

function NotificationsForm({
  settings,
  onUpdate
}: {
  settings: any,
  onUpdate: (key: string, val: boolean) => void
}) {
  return (
    <div className="max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-bold text-white mb-6">Notifications</h2>

      <div className="space-y-6">
        <ToggleRow label="Trade Execution Alerts" desc="Get notified when orders are filled or cancelled" active={settings.tradeAlerts} onChange={(v) => onUpdate('tradeAlerts', v)} />
        <ToggleRow label="Risk Notifications" desc="Alert me when margin falls below 150%" active={settings.riskAlerts} onChange={(v) => onUpdate('riskAlerts', v)} />
        <ToggleRow label="Daily Digest" desc="Receive a daily summary of portfolio performance" active={settings.digest} onChange={(v) => onUpdate('digest', v)} />
        <ToggleRow label="Price Alerts" desc="Notify me when saved assets hit target levels" active={settings.priceAlerts} onChange={(v) => onUpdate('priceAlerts', v)} />
        <ToggleRow label="Push Notifications" desc="Receive instant alerts on your mobile device" active={settings.pushNotifs} onChange={(v) => onUpdate('pushNotifs', v)} />
        <ToggleRow label="Marketing & Promotions" desc="Occasional updates on new Oak Capital features" active={settings.marketing} onChange={(v) => onUpdate('marketing', v)} />
      </div>
    </div>
  )
}

function SecurityForm() {
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [show2FA, setShow2FA] = useState(false)

  const [apiKeys, setApiKeys] = useState<{ id: string, key: string, created: string }[]>([
    { id: '1', key: 'sb_live_********************a3', created: '2026-03-15' }
  ])

  const [sessions, setSessions] = useState([
    { id: 's1', device: 'Windows 11 • Chrome (Current)', location: 'Mumbai, India • Active now', current: true },
    { id: 's2', device: 'iPhone 14 Pro • Safari', location: 'Mumbai, India • Last active 2h ago', current: false }
  ])

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Trim and normalize input just in case
    const normalizedPass = currentPass.trim()
    if (normalizedPass !== 'oakcapital2026') {
      setError('Invalid current password (hint: oakcapital2026)')
      setSaved(false)
      return
    }
    setError('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setCurrentPass('')
    setNewPass('')
  }

  const generateKey = () => {
    const newKey = {
      id: Math.random().toString(36).substr(2, 9),
      key: `sb_live_${Math.random().toString(36).substr(2, 20)}`,
      created: new Date().toISOString().split('T')[0]
    }
    setApiKeys([...apiKeys, newKey])
  }

  const revokeKey = (id: string) => {
    setApiKeys(apiKeys.filter((k: any) => k.id !== id))
  }

  return (
    <div className="max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-bold text-white mb-6">Security & Sessions</h2>

      <div className="space-y-6">
        <div>
          <h3 className="font-semibold text-slate-200 mb-4">Change Password</h3>
          <form className="space-y-4" onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              placeholder="Current Password (try oakcapital2026)"
              required
              value={currentPass}
              onChange={(e) => setCurrentPass(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-2 text-white outline-none focus:border-[#00C076] transition-colors"
            />
            <input
              type="password"
              placeholder="New Password"
              required
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-2 text-white outline-none focus:border-[#00C076] transition-colors"
            />
            <div className="flex items-center gap-4">
              <button type="submit" className="rounded-md bg-white/10 px-6 py-2 text-sm font-bold text-white hover:bg-white/20 transition-colors">
                Update Password
              </button>
              {error && <span className="text-sm font-medium text-red-500">{error}</span>}
              {saved && <span className="text-sm font-medium text-[#00C076]">Password Updated!</span>}
            </div>
          </form>
        </div>

        <div className="pt-6 border-t border-white/10">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-200">Two-Factor Authentication</h3>
            <Smartphone className="h-5 w-5 text-slate-500" />
          </div>
          <p className="text-sm text-slate-500 mb-4">Add an extra layer of security to your account using TOTP apps.</p>
          <button
            onClick={() => setShow2FA(true)}
            className="rounded-md border px-6 py-2 text-sm font-bold transition-all hover:bg-white/5"
            style={{ borderColor: 'var(--accent-color)', color: 'var(--accent-color)' }}
          >
            Setup 2FA
          </button>
        </div>

        {show2FA && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0B0E14] p-8 shadow-2xl animate-in scale-in duration-300">
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 rounded-full bg-[#00C076]/10 p-4">
                  <QrCode className="h-12 w-12 text-[#00C076]" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Setup 2FA</h3>
                <p className="text-sm text-slate-400 mb-6">Scan this QR code with Google Authenticator or Authy to enable 2FA.</p>
                <div className="bg-white p-4 rounded-xl mb-6">
                  <div className="h-32 w-32 bg-slate-200 flex items-center justify-center text-slate-400 font-mono text-[10px]">
                    [MOCK_QR_CODE]
                  </div>
                </div>
                <button
                  onClick={() => setShow2FA(false)}
                  className="w-full rounded-md py-3 text-sm font-bold transition-all hover:scale-[1.02] active:scale-98"
                  style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}
                >
                  Confirm Setup
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="pt-6 border-t border-white/10">
          <h3 className="font-semibold text-slate-200 mb-2">API Keys</h3>
          <p className="text-sm text-slate-500 mb-4">Manage your API keys for programmatic trading access.</p>

          <div className="space-y-3 mb-4">
            {apiKeys.map(k => (
              <div key={k.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-3">
                <div className="flex items-center gap-3">
                  <Key className="h-4 w-4 text-slate-500" />
                  <div>
                    <div className="text-xs font-mono text-slate-300">{k.key}</div>
                    <div className="text-[10px] text-slate-500">Created on {k.created}</div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => { navigator.clipboard.writeText(k.key); alert('API Key copied!') }}
                    className="text-xs font-semibold opacity-50 hover:opacity-100 transition-opacity"
                  >
                    Copy
                  </button>
                  <button onClick={() => revokeKey(k.id)} className="text-xs font-semibold text-red-500 hover:text-red-400">Revoke</button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={generateKey}
            className="rounded-md bg-white/10 px-6 py-2 text-sm font-bold text-white hover:bg-white/20 transition-colors"
          >
            Generate New Key
          </button>
        </div>

        <div className="pt-6 border-t border-white/10">
          <h3 className="font-semibold text-slate-200 mb-4">Active Sessions</h3>
          <div className="space-y-3 mb-4">
            {sessions.map(s => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border bg-white/5 p-3" style={s.current ? { borderColor: 'rgba(var(--accent-color-rgb), 0.2)', backgroundColor: 'rgba(var(--accent-color-rgb), 0.05)' } : { borderColor: 'rgba(255,255,255,0.05)' }}>
                <div>
                  <div className="text-sm font-medium" style={s.current ? { color: 'var(--accent-color)' } : { color: 'var(--text-primary)' }}>{s.device}</div>
                  <div className="text-xs opacity-50">{s.location}</div>
                </div>
                {!s.current && <button onClick={() => setSessions(sessions.filter(it => it.id !== s.id))} className="text-xs font-semibold text-red-400 hover:text-red-300 transition-colors">Revoke</button>}
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              setSessions(sessions.filter(s => s.current))
              alert('All other devices signed out!')
            }}
            className="text-sm font-semibold text-slate-400 hover:text-white transition-colors"
          >
            Sign Out All Other Devices
          </button>
        </div>
      </div>
    </div>
  )
}



function TradingPreferencesForm({
  settings,
  onUpdate
}: {
  settings: any,
  onUpdate: (key: string, val: any) => void
}) {
  return (
    <div className="max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-bold text-white mb-6">Trading Preferences</h2>

      <div className="space-y-6">
        <ToggleRow label="One-Click Trading" desc="Execute orders immediately without confirmation popups" active={settings.oneClick} onChange={(v) => onUpdate('oneClick', v)} />
        <ToggleRow label="Order Confirmations" desc="Show a summary before sending orders to the exchange" active={settings.confirmations} onChange={(v) => onUpdate('confirmations', v)} />

        <div className="pt-4 border-t border-white/10">
          <label className="block text-sm font-medium opacity-50 mb-2">Default Order Quantity</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={settings.orderQuantity}
              onChange={(e) => onUpdate('orderQuantity', e.target.value)}
              className="w-32 rounded-md border border-white/10 bg-white/5 px-4 py-2 text-white outline-none transition-colors focus:ring-1"
              style={{ '--tw-ring-color': 'var(--accent-color)' } as React.CSSProperties}
            />
            <span className="text-xs opacity-50">units</span>
          </div>
        </div>

        <CustomSelect
          label="Execution Priority"
          value={settings.priority}
          options={[
            { label: 'Balance Speed & Price', value: 'balance' },
            { label: 'Price Improvement Focus', value: 'price' },
            { label: 'Immediate Fill Priority', value: 'fill' }
          ]}
          onChange={(v) => onUpdate('priority', v)}
        />
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const username = localStorage.getItem('username') || 'Trader'
  const [activeSection, setActiveSection] = useState<Section>(null)

  // Unified persistent settings state
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('userSettings')
    return saved ? JSON.parse(saved) : {
      tradeAlerts: true,
      riskAlerts: false,
      digest: true,
      priceAlerts: true,
      pushNotifs: false,
      marketing: false,
      oneClick: false,
      confirmations: true,
      orderQuantity: 5,
      priority: 'balance',
      currency: 'USD',
      timezone: 'IST',
      phoneCode: '+91'
    }
  })

  const updateSetting = (key: string, val: any) => {
    const newSettings = { ...settings, [key]: val }
    setSettings(newSettings)
    localStorage.setItem('userSettings', JSON.stringify(newSettings))
  }

  // Handle section components locally to preserve state if needed, or pass props
  return (
    <div className="settings-root min-h-screen transition-all duration-300" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <AppNavbar activeTab="settings" />

      <div className="mx-auto max-w-[1200px] px-6 py-8 md:px-12">
        {!activeSection ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-extrabold tracking-tight">Settings</h1>
              <span className="text-[10px] font-mono opacity-20">v2.1-custom-ui-final</span>
            </div>
            <p className="mt-2 text-sm opacity-60">
              Manage your profile, security headers, and notification preferences. Hi {username}.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {placeholderSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id as Section)}
                  className="group rounded-xl border border-white/10 p-5 text-left transition-all hover:-translate-y-1 hover:border-white/20 hover:shadow-lg cursor-pointer"
                  style={{ background: 'var(--bg-secondary)', borderColor: 'rgba(255,255,255,0.05)' }}
                >
                  <section.icon className="h-6 w-6 transition-colors" style={{ color: 'var(--accent-color)' }} />
                  <h2 className="mt-4 text-[15px] font-bold">{section.title}</h2>
                  <p className="mt-2 text-sm leading-5 opacity-50 group-hover:opacity-70 transition-opacity">{section.desc}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <button
              onClick={() => setActiveSection(null)}
              className="mb-8 flex items-center gap-2 text-sm font-semibold opacity-50 hover:opacity-100 transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Settings
            </button>
            <div className="rounded-xl border border-white/10 backdrop-blur-md p-8 shadow-2xl transition-all" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'rgba(255,255,255,0.05)' }}>
              {activeSection === 'profile' && <ProfileForm username={username} settings={settings} onUpdate={updateSetting} />}
              {activeSection === 'notifications' && <NotificationsForm settings={settings} onUpdate={updateSetting} />}
              {activeSection === 'security' && <SecurityForm />}
              {activeSection === 'trading' && <TradingPreferencesForm settings={settings} onUpdate={updateSetting} />}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
