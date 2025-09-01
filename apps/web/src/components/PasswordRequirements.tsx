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
            <span className="text-xs text-gray-600">Password strength</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${strength.color}`}>
              {strength.label}
            </span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${
                strength.score === 0 ? 'bg-red-500' :
                strength.score === 1 ? 'bg-orange-500' :
                strength.score === 2 ? 'bg-yellow-500' :
                strength.score === 3 ? 'bg-blue-500' :
                'bg-green-500'
              }`}
              style={{ width: `${(strength.score + 1) * 20}%` }}
            />
          </div>
        </div>
      )}
      
      <div className="space-y-1.5">
        <p className="text-xs text-gray-600 font-medium">Requirements:</p>
        <ul className="space-y-1">
          <li className="flex items-center gap-1.5 text-xs">
            {strength.meets.minLength ? (
              <Check className="w-3.5 h-3.5 text-green-600" />
            ) : (
              <X className="w-3.5 h-3.5 text-gray-400" />
            )}
            <span className={strength.meets.minLength ? 'text-green-700' : 'text-gray-600'}>
              At least {PASSWORD_REQUIREMENTS.minLength} characters
            </span>
          </li>
          <li className="flex items-center gap-1.5 text-xs">
            {strength.meets.hasUppercase ? (
              <Check className="w-3.5 h-3.5 text-green-600" />
            ) : (
              <X className="w-3.5 h-3.5 text-gray-400" />
            )}
            <span className={strength.meets.hasUppercase ? 'text-green-700' : 'text-gray-600'}>
              One uppercase letter
            </span>
          </li>
          <li className="flex items-center gap-1.5 text-xs">
            {strength.meets.hasLowercase ? (
              <Check className="w-3.5 h-3.5 text-green-600" />
            ) : (
              <X className="w-3.5 h-3.5 text-gray-400" />
            )}
            <span className={strength.meets.hasLowercase ? 'text-green-700' : 'text-gray-600'}>
              One lowercase letter
            </span>
          </li>
          <li className="flex items-center gap-1.5 text-xs">
            {strength.meets.hasNumber ? (
              <Check className="w-3.5 h-3.5 text-green-600" />
            ) : (
              <X className="w-3.5 h-3.5 text-gray-400" />
            )}
            <span className={strength.meets.hasNumber ? 'text-green-700' : 'text-gray-600'}>
              One number
            </span>
          </li>
        </ul>
      </div>
    </div>
  )
}