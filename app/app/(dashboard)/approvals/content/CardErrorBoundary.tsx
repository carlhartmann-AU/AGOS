'use client'

import React from 'react'

type Props = {
  children: React.ReactNode
  contentId: string
}

type State = {
  hasError: boolean
  errorMessage: string | null
}

export class CardErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, errorMessage: null }
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error)
    return { hasError: true, errorMessage: message }
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(
      `[CardErrorBoundary] Card failed to render (content_id=${this.props.contentId}):`,
      message,
      errorInfo.componentStack,
    )
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white rounded-lg border border-red-200 overflow-hidden">
          <div className="px-5 py-4">
            <p className="text-sm font-medium text-red-700 mb-1">Card failed to render</p>
            <p className="text-xs text-gray-500 mb-1">Content ID: {this.props.contentId}</p>
            {this.state.errorMessage && (
              <p className="text-xs text-red-600 font-mono bg-red-50 rounded px-2 py-1 break-all">
                {this.state.errorMessage.slice(0, 200)}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-2">
              Check the Supabase row directly. This row&apos;s content shape doesn&apos;t match the card template.
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
