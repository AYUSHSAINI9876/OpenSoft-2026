import { useId, useMemo, useState } from 'react'
import { Check, Eye, EyeOff, Lock } from 'lucide-react'

import { PASSWORD_RULES, scorePassword } from '../../utils/password'

type Props = {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  /** Renders the strength bar and checklist — signup only, not sign-in. */
  showStrength?: boolean
  autoComplete?: string
  required?: boolean
  name?: string
  /** Right-aligned slot next to the label, e.g. a "Forgot password?" link. */
  labelAction?: React.ReactNode
}

export default function PasswordField({
  value,
  onChange,
  label = 'Password',
  placeholder = '••••••••',
  showStrength = false,
  autoComplete = 'current-password',
  required = true,
  name = 'password',
  labelAction,
}: Props) {
  const [visible, setVisible] = useState(false)
  const inputId = useId()
  const strengthId = useId()

  const strength = useMemo(() => scorePassword(value), [value])
  const results = useMemo(() => PASSWORD_RULES.map((r) => ({ ...r, ok: r.test(value) })), [value])

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={inputId} className="text-[13px] font-medium text-gray-200">
          {label}
        </label>
        {labelAction}
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Lock className="h-4 w-4 text-gray-400" aria-hidden="true" />
        </div>
        <input
          id={inputId}
          name={name}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          aria-describedby={showStrength && value ? strengthId : undefined}
          className="w-full rounded-md border border-white/10 bg-[#11141c] py-2 pl-9 pr-10 text-sm text-white placeholder-gray-500 transition-colors focus:border-[#00C076] focus:outline-none focus:ring-1 focus:ring-[#00C076]"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 transition-colors hover:text-white focus:outline-none focus-visible:text-white"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {showStrength && value && (
        <div id={strengthId} className="space-y-2 pt-1.5">
          <div className="flex items-center gap-2">
            <div className="flex h-1 flex-1 gap-1" role="presentation">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className="h-full flex-1 rounded-full transition-colors duration-300"
                  style={{ backgroundColor: step <= strength.score ? strength.color : 'rgba(255,255,255,0.08)' }}
                />
              ))}
            </div>
            <span className="w-[68px] shrink-0 text-right text-[11px] font-semibold" style={{ color: strength.color }}>
              {strength.label}
            </span>
          </div>
          <ul className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
            {results.map((rule) => (
              <li
                key={rule.id}
                className="flex items-center gap-1.5 text-[11px] transition-colors"
                style={{ color: rule.ok ? '#00C076' : 'rgb(107,114,128)' }}
              >
                <Check className={`h-3 w-3 shrink-0 ${rule.ok ? 'opacity-100' : 'opacity-30'}`} aria-hidden="true" />
                {rule.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
