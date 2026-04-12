import React from 'react'

// renders a string with **word** markdown-style bolding into React nodes
export function renderInlineBold(text: string, boldClassName = 'font-semibold'): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className={boldClassName}>{part.slice(2, -2)}</strong>
    }
    return <React.Fragment key={i}>{part}</React.Fragment>
  })
}
