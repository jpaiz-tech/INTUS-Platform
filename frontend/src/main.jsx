import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './lib/AuthContext.jsx';
import './index.css';
import './modules/capital-research/capital-research.css';

// No StrictMode: the legacy MapView manages a Leaflet instance imperatively and
// was written for single effect invocation (matches the original HTML app).
ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
