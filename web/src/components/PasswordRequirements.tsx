import { Check, X } from 'lucide-react'
import { getPasswordStrength, PASSWORD_REQUIREMENTS } from '@/utils/password'

interface PasswordRequirementsProps {
  password: string
  showStrength?: boolean
}

export const PasswordRequirements = ({ password, showStrength = true }: PasswordRequirementsProps) => {
  const strength = getPasswordStrength(password)

  return (
    <div className="space-y-3">
      {showStrength && password.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Password strength</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${strength.color}`}>{strength.label}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                strength.score === 0 ? 'bg-danger' : strength.score <= 2 ? 'bg-warning' : strength.score === 3 ? 'bg-info' : 'bg-success'
              }`}
              style={{ width: `${(strength.score + 1) * 20}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground font-medium">Requirements:</p>
        <ul className="space-y-1">
          <li className="flex items-center gap-1.5 text-xs">
            {strength.meets.minLength ? (
              <Check className="w-3.5 h-3.5 text-success" />
            ) : (
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            )}
            <span className={strength.meets.minLength ? 'text-success-fg' : 'text-muted-foreground'}>
              At least {PASSWORD_REQUIREMENTS.minLength} characters
            </span>
          </li>
          <li className="flex items-center gap-1.5 text-xs">
            {strength.meets.hasUppercase ? (
              <Check className="w-3.5 h-3.5 text-success" />
            ) : (
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            )}
            <span className={strength.meets.hasUppercase ? 'text-success-fg' : 'text-muted-foreground'}>One uppercase letter</span>
          </li>
          <li className="flex items-center gap-1.5 text-xs">
            {strength.meets.hasLowercase ? (
              <Check className="w-3.5 h-3.5 text-success" />
            ) : (
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            )}
            <span className={strength.meets.hasLowercase ? 'text-success-fg' : 'text-muted-foreground'}>One lowercase letter</span>
          </li>
          <li className="flex items-center gap-1.5 text-xs">
            {strength.meets.hasNumber ? (
              <Check className="w-3.5 h-3.5 text-success" />
            ) : (
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            )}
            <span className={strength.meets.hasNumber ? 'text-success-fg' : 'text-muted-foreground'}>One number</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
