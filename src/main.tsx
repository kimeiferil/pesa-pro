import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

// Enhanced error handling with React Error Boundaries
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    
    // Also send to error reporting service if available
    const win = window as any;
    if (typeof win !== 'undefined' && win.ga) {
      win.ga('send', 'event', 'javascript_error', error.message, {
        nonInteraction: true
      });
    }
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: '#fff',
          color: '#000',
          padding: '20px',
          fontFamily: 'system-ui, sans-serif',
          zIndex: 9999
        }}>
          <h2>Something went wrong.</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo?.componentStack}
          </details>
          <button onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Global error handler for mobile debugging (enhanced)
window.onerror = function(message, source, lineno, colno, error) {
  try {
    const errorMsg = `ERROR: ${message} at ${source}:${lineno}:${colno}`;
    console.error('CRITICAL ERROR:', errorMsg);

    // Show error on screen for easier debugging on mobile
    const errorDiv = document.createElement('div');
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '0';
    errorDiv.style.left = '0';
    errorDiv.style.width = '100%';
    errorDiv.style.height = '100%';
    errorDiv.style.background = 'white';
    errorDiv.style.color = 'red';
    errorDiv.style.padding = '20px';
    errorDiv.style.zIndex = '9999';
    errorDiv.style.overflow = 'auto';
    errorDiv.style.fontSize = '12px';
    errorDiv.innerHTML = `<h1>Application Error</h1><pre>${errorMsg}\n\n${error?.stack || ''}</pre>`;
    document.body.appendChild(errorDiv);
  } catch (e) {
    console.error('Error in global handler:', e);
  }
};

window.onunhandledrejection = function(event) {
  console.error('UNHANDLED REJECTION:', event.reason);
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
