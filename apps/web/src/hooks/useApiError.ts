import { useState, useCallback } from 'react'
import { useToast } from '@/contexts/toast'
import { parseApiError, getErrorMessageByStatus } from '@/utils/api-helpers'

export interface UseApiErrorConfig {
  showToast?: boolean
  onError?: (error: string) => void
}

export interface UseApiErrorReturn {
  error: string | null
  isError: boolean
  setError: (error: unknown) => void
  clearError: () => void
}

export function useApiError(
  config: UseApiErrorConfig = {}
): UseApiErrorReturn {
  const { showToast = true, onError } = config

  const { addToast } = useToast()
  const [error, setErrorState] = useState<string | null>(null)

  const setError = useCallback((err: unknown) => {
    const errorMessage = parseApiError(err)
    setErrorState(errorMessage)

    if (showToast) {
      addToast('error', errorMessage)
    }

    if (onError) {
      onError(errorMessage)
    }
  }, [showToast, addToast, onError])

  const clearError = useCallback(() => {
    setErrorState(null)
  }, [])

  return {
    error,
    isError: error !== null,
    setError,
    clearError
  }
}

// Hook for handling API errors with status codes
export function useApiErrorWithStatus() {
  const { addToast } = useToast()
  const [error, setError] = useState<{ message: string; status?: number } | null>(null)
  
  const handleError = useCallback((err: unknown, status?: number) => {
    let errorMessage: string
    
    if (status) {
      errorMessage = getErrorMessageByStatus(status)
    } else {
      errorMessage = parseApiError(err)
    }
    
    setError({ message: errorMessage, status })
    addToast('error', errorMessage)
  }, [addToast])
  
  const clearError = useCallback(() => {
    setError(null)
  }, [])
  
  return {
    error: error?.message || null,
    status: error?.status,
    isError: error !== null,
    is401: error?.status === 401,
    is403: error?.status === 403,
    is404: error?.status === 404,
    is500: error?.status === 500,
    handleError,
    clearError
  }
}

// Hook for batch error handling
export function useBatchErrors() {
  const [errors, setErrors] = useState<Map<string, string>>(new Map())
  const { addToast } = useToast()
  
  const addError = useCallback((key: string, error: unknown) => {
    const errorMessage = parseApiError(error)
    setErrors(prev => new Map(prev).set(key, errorMessage))
  }, [])
  
  const removeError = useCallback((key: string) => {
    setErrors(prev => {
      const next = new Map(prev)
      next.delete(key)
      return next
    })
  }, [])
  
  const clearErrors = useCallback(() => {
    setErrors(new Map())
  }, [])
  
  const showAllErrors = useCallback(() => {
    errors.forEach(error => {
      addToast('error', error)
    })
  }, [errors, addToast])
  
  return {
    errors: Array.from(errors.entries()),
    errorMap: errors,
    hasErrors: errors.size > 0,
    errorCount: errors.size,
    addError,
    removeError,
    clearErrors,
    showAllErrors
  }
}

// Hook for form validation errors
export interface ValidationError {
  field: string
  message: string
}

export function useValidationErrors() {
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  
  const setFieldError = useCallback((field: string, message: string) => {
    setValidationErrors(prev => {
      const filtered = prev.filter(e => e.field !== field)
      return [...filtered, { field, message }]
    })
  }, [])
  
  const clearFieldError = useCallback((field: string) => {
    setValidationErrors(prev => prev.filter(e => e.field !== field))
  }, [])
  
  const clearAllErrors = useCallback(() => {
    setValidationErrors([])
  }, [])
  
  const getFieldError = useCallback((field: string): string | undefined => {
    return validationErrors.find(e => e.field === field)?.message
  }, [validationErrors])
  
  const hasFieldError = useCallback((field: string): boolean => {
    return validationErrors.some(e => e.field === field)
  }, [validationErrors])
  
  return {
    errors: validationErrors,
    hasErrors: validationErrors.length > 0,
    setFieldError,
    clearFieldError,
    clearAllErrors,
    getFieldError,
    hasFieldError
  }
}