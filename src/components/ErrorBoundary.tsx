import { Component, type ErrorInfo, type ReactNode } from 'react'
import { audioEngine } from '../utils/audioEngine'

interface State {
  error: Error | null
}

/** 화면 오류가 나도 소리가 남지 않도록 모든 소리를 끄고 복구 안내를 보여 줍니다. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    audioEngine.dispose()
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="crash">
        <h1>화면 오류가 발생해 모든 소리를 정지했습니다.</h1>
        <p>작업 중인 검사는 브라우저에 자동 보관되어 있습니다. 새로고침하면 이어서 진행할 수 있습니다.</p>
        <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
          새로고침
        </button>
        <pre>{this.state.error.message}</pre>
      </div>
    )
  }
}
