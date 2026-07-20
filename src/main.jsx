import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Ocean Depth palette — kept in sync with T constant in App.jsx
const EB = {
  bg:   '#F0F9FF',
  text: '#0C4A6E',
  muted:'#3B7EA6',
  btn:  '#0284C7',
};

class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        minHeight:'100dvh', fontFamily:"'Nunito',-apple-system,sans-serif",
        padding:32, background:EB.bg, color:EB.text }}>
        <div style={{ fontSize:48, marginBottom:16 }} aria-hidden="true">⚠️</div>
        <h2 style={{ margin:'0 0 8px', fontWeight:800 }}>Something went wrong</h2>
        <p style={{ color:EB.muted, fontSize:14, marginBottom:24 }}>{this.state.error.message}</p>
        <button onClick={()=>window.location.reload()}
          style={{ padding:'12px 28px', background:EB.btn, color:'#fff', border:'none',
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
