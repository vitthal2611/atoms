import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        minHeight:'100dvh', fontFamily:'Inter,sans-serif', padding:32, background:'#FDF8F2', color:'#1A1208' }}>
        <div style={{ fontSize:48, marginBottom:16 }}>⚠️</div>
        <h2 style={{ margin:'0 0 8px', fontWeight:800 }}>Something went wrong</h2>
        <p style={{ color:'#9B8670', fontSize:14, marginBottom:24 }}>{this.state.error.message}</p>
        <button onClick={()=>window.location.reload()}
          style={{ padding:'12px 28px', background:'#2E7D4F', color:'#fff', border:'none',
            borderRadius:12, fontSize:15, fontWeight:700, cursor:'pointer' }}>
          Reload
        </button>
      </div>
    )
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
