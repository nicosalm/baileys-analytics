// Centralized style constants for consistency across the app

// Button styles
export const buttonStyles = {
  primary: 'px-4 py-2 bg-blue-600 text-white rounded-lg hover:opacity-90 transition-opacity font-medium',
  secondary: 'px-4 py-2 bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors font-medium',
  danger: 'px-4 py-2 bg-red-600 text-white rounded-lg hover:opacity-90 transition-opacity font-medium',
  success: 'px-4 py-2 bg-green-600 text-white rounded-lg hover:opacity-90 transition-opacity font-medium',
  ghost: 'px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors font-medium',

  // Size variants
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2',
  lg: 'px-6 py-3',

  // Icon button
  icon: 'p-2 hover:bg-gray-100 rounded-lg transition-colors',
  iconPrimary: 'p-2 bg-blue-600 text-white hover:opacity-90 rounded-lg transition-opacity',
} as const

// Input styles
export const inputStyles = {
  base: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all',
  error: 'w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all',
  disabled: 'w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 cursor-not-allowed',
  
  // With icon
  withIcon: 'w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all',
  
  // Select
  select: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white cursor-pointer',
} as const

// Card styles
export const cardStyles = {
  base: 'bg-white rounded-lg shadow-sm border border-gray-200',
  hover: 'bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50/50 transition-colors',
  clickable: 'bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50/50 transition-colors cursor-pointer',
  
  // Padding variants
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
} as const

// Shadow styles - unified depth levels
export const shadowStyles = {
  none: '',
  sm: 'shadow-sm',
  md: 'shadow',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
  '2xl': 'shadow-2xl',
} as const

// Focus styles - consistent focus states
export const focusStyles = {
  ring: 'focus:ring-2 focus:ring-blue-500 focus:border-transparent',
  outline: 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
  within: 'focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent',
} as const

// Transition styles
export const transitionStyles = {
  all: 'transition-all',
  colors: 'transition-colors',
  shadow: 'transition-shadow',
  none: '',
} as const