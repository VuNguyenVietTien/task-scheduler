"use client"

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { generateAsciiTree } from '@/utils/tree-structure-generator'

interface TreeBuilderPanelProps {
  /** Called with the generated ASCII tree string when user clicks Insert */
  onInsert: (tree: string) => void
  onClose: () => void
}

const PLACEHOLDER = `ecommerce-app/
  src/
    main/
      java/
        com/
          ecommerce/
            EcommerceApplication.java
            config/
              SecurityConfig.java
  README.md
  pom.xml`

export function TreeBuilderPanel({ onInsert, onClose }: TreeBuilderPanelProps) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [preview, setPreview] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setPreview(input.trim() ? generateAsciiTree(input) : '')
  }, [input])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Focus textarea when modal opens
  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 50)
  }, [])

  const handleInsert = () => {
    const tree = preview || generateAsciiTree(input)
    if (tree) onInsert(tree)
  }

  const modal = (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 9998,
        }}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tree Structure Builder"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
          width: 'min(860px, 92vw)',
          background: 'white',
          borderRadius: '0.5rem',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          padding: '1rem',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
            🌲 {t('treeBuilder.title')}
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#6b7280',
              fontSize: '1.1rem',
              lineHeight: 1,
              padding: '0.2rem 0.4rem',
              borderRadius: '0.25rem',
            }}
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Side-by-side input / preview */}
        <div style={{ display: 'flex', gap: '0.75rem', height: '340px' }}>
          {/* Input */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('treeBuilder.inputLabel')}
            </span>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={PLACEHOLDER}
              spellCheck={false}
              style={{
                flex: 1,
                width: '100%',
                padding: '0.6rem',
                fontFamily: "'Cascadia Code','Fira Code','Consolas',monospace",
                fontSize: '0.8rem',
                lineHeight: 1.65,
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                background: '#fafafa',
                resize: 'none',
                outline: 'none',
                whiteSpace: 'pre',
                overflowX: 'auto',
                tabSize: 2,
              }}
              onKeyDown={e => {
                // Tab → insert 2 spaces, never move focus
                if (e.key === 'Tab') {
                  e.preventDefault()
                  e.stopPropagation()
                  const el = e.target as HTMLTextAreaElement
                  const start = el.selectionStart
                  const end = el.selectionEnd
                  const newVal = el.value.substring(0, start) + '  ' + el.value.substring(end)
                  setInput(newVal)
                  requestAnimationFrame(() => {
                    el.selectionStart = el.selectionEnd = start + 2
                  })
                }
              }}
            />
          </div>

          {/* Preview */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('treeBuilder.previewLabel')}
            </span>
            <pre style={{
              flex: 1,
              margin: 0,
              padding: '0.6rem',
              fontFamily: "'Cascadia Code','Fira Code','Consolas',monospace",
              fontSize: '0.8rem',
              lineHeight: 1.65,
              background: '#1e1e1e',
              color: '#d4d4d4',
              borderRadius: '0.375rem',
              overflow: 'auto',
              whiteSpace: 'pre',
            }}>
              {preview || <span style={{ color: '#6b7280', fontStyle: 'italic' }}>{t('treeBuilder.previewPlaceholder')}</span>}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.25rem', borderTop: '1px solid #f3f4f6' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.4rem 0.9rem',
              fontSize: '0.8rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              background: 'white',
              cursor: 'pointer',
              color: '#374151',
            }}
          >
            {t('treeBuilder.cancel')}
          </button>
          <button
            type="button"
            onClick={handleInsert}
            disabled={!preview}
            style={{
              padding: '0.4rem 0.9rem',
              fontSize: '0.8rem',
              border: 'none',
              borderRadius: '0.375rem',
              background: preview ? '#4f46e5' : '#e5e7eb',
              color: preview ? 'white' : '#9ca3af',
              cursor: preview ? 'pointer' : 'not-allowed',
              fontWeight: 500,
            }}
          >
            {t('treeBuilder.insertButton')}
          </button>
        </div>
      </div>
    </>
  )

  // Render into document.body so it's never clipped by any parent
  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null
}
