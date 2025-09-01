// nist 800-63B compliant password requirements
export const PASSWORD_REQUIREMENTS = {
  minLength: 8, // NIST recommends minimum 8
  maxLength: 128, // Prevent DoS attacks
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: false, // nist recommends NOT requiring special chars
  preventCommonPasswords: true,
  preventSequentialChars: true, // prevent "12345", "abcde"
  preventRepeatingChars: true // prevent "aaaa", "1111"
}

// common weak passwords to check against
const COMMON_PASSWORDS = [
  'password', 'Password', 'Password1', 'Password123',
  '12345678', '123456789', 'qwerty', 'Qwerty123',
  'letmein', 'welcome', 'Welcome1', 'admin',
  'Admin123', 'password1', 'p@ssw0rd', 'P@ssw0rd'
]

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Good' | 'Strong'
  color: string
  meets: {
    minLength: boolean
    hasUppercase: boolean
    hasLowercase: boolean
    hasNumber: boolean
    hasSpecial: boolean
  }
}

export const validatePassword = (password: string): { isValid: boolean; errors: string[]; warnings: string[] } => {
  const errors: string[] = []
  const warnings: string[] = []

  // length checks
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`)
  }
  
  if (password.length > PASSWORD_REQUIREMENTS.maxLength) {
    errors.push(`Password must be no more than ${PASSWORD_REQUIREMENTS.maxLength} characters`)
  }

  // character requirements
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  if (PASSWORD_REQUIREMENTS.requireNumber && !/\d/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  if (PASSWORD_REQUIREMENTS.requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }
  
  // security checks
  if (PASSWORD_REQUIREMENTS.preventCommonPasswords) {
    const lowerPassword = password.toLowerCase()
    if (COMMON_PASSWORDS.some(common => lowerPassword === common.toLowerCase())) {
      errors.push('This password is too common. Please choose a more unique password')
    }
  }
  
  if (PASSWORD_REQUIREMENTS.preventSequentialChars) {
    // check for sequential characters like "abc", "123"
    const hasSequential = /(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(password)
    if (hasSequential) {
      warnings.push('Avoid sequential characters for a stronger password')
    }
  }
  
  if (PASSWORD_REQUIREMENTS.preventRepeatingChars) {
    // check for repeating characters like "aaa", "111"
    const hasRepeating = /(.)\1{2,}/.test(password)
    if (hasRepeating) {
      warnings.push('Avoid repeating characters for a stronger password')
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

export const getPasswordStrength = (password: string): PasswordStrength => {
  const meets = {
    minLength: password.length >= PASSWORD_REQUIREMENTS.minLength,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password)
  }

  let score = 0
  
  // basic requirements (required)
  if (meets.minLength) score++
  if (meets.hasUppercase && meets.hasLowercase && meets.hasNumber) score++
  
  // additional strength factors
  if (meets.hasSpecial) score++ // bonus for special chars
  if (password.length >= 12) score++ // bonus for length
  if (password.length >= 16) score++ // extra bonus for long passwords
  
  // penalty for weak patterns
  const validation = validatePassword(password)
  if (validation.warnings.length > 0) score = Math.max(0, score - 1)

  // cap at 4
  score = Math.min(4, Math.max(0, score))
  if (score > 4) score = 4
  if (score < 0) score = 0

  const strengthMap: Record<number, { label: PasswordStrength['label']; color: string }> = {
    0: { label: 'Very Weak', color: 'text-red-600 bg-red-100' },
    1: { label: 'Weak', color: 'text-orange-600 bg-orange-100' },
    2: { label: 'Fair', color: 'text-yellow-600 bg-yellow-100' },
    3: { label: 'Good', color: 'text-blue-600 bg-blue-100' },
    4: { label: 'Strong', color: 'text-green-600 bg-green-100' }
  }

  return {
    score: score as 0 | 1 | 2 | 3 | 4,
    ...strengthMap[score],
    meets
  }
}

// check if a password has been previously used (requires backend integration)
export const checkPasswordHistory = async (_password: string, _userId: string): Promise<boolean> => {
  // this would typically call an API to check password history
  // for now, return true (not in history)
  return true
}

// sanitize password for display (never log actual passwords)
export const sanitizePasswordForLogging = (password: string): string => {
  if (!password) return '[empty]'
  return `[${password.length} chars]`
}
