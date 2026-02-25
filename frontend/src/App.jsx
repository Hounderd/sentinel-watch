import React, { useState, useEffect } from 'react';
import './index.css';
import DeviceScanner from './components/DeviceScanner';
import SettingsPanel from './components/SettingsPanel';

// We map components directly here for simplicity without heavy routing library

const Heatmap = ({ deviceId }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/devices/${deviceId}/history?limit=40`);
        const data = await res.json();
        // Reverse array here if it's oldest first, but the UI expects L to R (oldest to newest).
        setHistory(data);
      } catch (err) {
        console.error("Failed to fetch history:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
    // Poll every 10s
    const interval = setInterval(fetchHistory, 10000);
    return () => clearInterval(interval);
  }, [deviceId]);

  if (loading) return <div className="heatmap-container animate-pulse"><div className="heatmap-grid"><div className="heatmap-cell status-unknown" style={{ flex: '1 1 auto', width: '100%' }}></div></div></div>;

  // We want exactly 40 cells to show a consistent UI
  const cells = Array(40).fill(null);

  // Fill from the right (newest)
  let cellIndex = 39;
  for (let i = history.length - 1; i >= 0 && cellIndex >= 0; i--) {
    cells[cellIndex] = history[i];
    cellIndex--;
  }

  return (
    <div className="heatmap-container">
      <div className="heatmap-label">
        <span>History (last 40 pings)</span>
        <span>Now</span>
      </div>
      <div className="heatmap-grid">
        {cells.map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} className="heatmap-cell status-unknown" data-tooltip="No data" />;
          }

          let statusClass = "status-up";
          let tooltip = "Available";
          if (cell.is_drop) {
            statusClass = "status-down";
            tooltip = "Dropped / Offline";
          } else if (cell.latency_ms > 200) {
            statusClass = "status-warning";
            tooltip = `High Latency: ${cell.latency_ms.toFixed(1)}ms`;
          } else {
            tooltip = `Latency: ${cell.latency_ms.toFixed(1)}ms`;
          }

          const timeStr = new Date(cell.timestamp).toLocaleTimeString();

          return (
            <div
              key={`cell-${idx}`}
              className={`heatmap-cell ${statusClass}`}
              data-tooltip={`${timeStr} - ${tooltip}`}
            />
          );
        })}
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const fetchDevices = async () => {
    try {
      const res = await fetch('/api/devices');
      if (!res.ok) throw new Error("Network response was not ok");
      const data = await res.json();
      setDevices(data);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch devices:", err);
      setError("Failed to connect to Sentinel API.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleDeleteDevice = async (id) => {
    try {
      await fetch(`/api/devices/${id}`, { method: 'DELETE' });
      fetchDevices();
    } catch (err) {
      console.error("Failed to delete device", err);
    }
  };

  const handleDeleteAll = async () => {
    try {
      await fetch(`/api/devices`, { method: 'DELETE' });
      fetchDevices();
    } catch (err) {
      console.error("Failed to delete all devices", err);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Initializing Sentinel Nodes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-container">
        <div className="spinner" style={{ borderColor: 'transparent', borderTopColor: '#ef4444' }}></div>
        <p style={{ color: '#ef4444' }}>{error}</p>
        <button onClick={() => window.location.reload()} style={{ padding: '0.5rem 1rem', background: '#334155', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Retry Connection</button>
      </div>
    );
  }

  const upCount = devices.filter(d => d.status === 'up').length;
  const downCount = devices.filter(d => d.status === 'down').length;

  return (
    <div className="container">
      <header>
        <div className="logo-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
          </svg>
        </div>
        <div className="header-title">
          <h1>SentinelWatch</h1>
          <p>Self-Hosted Network Monitor · {devices.length} Nodes Configured</p>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Global Status</div>
            <div style={{ color: downCount > 0 ? '#ef4444' : '#10b981', fontWeight: 'bold', fontSize: '1.125rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: downCount > 0 ? '#ef4444' : '#10b981', boxShadow: `0 0 8px ${downCount > 0 ? '#ef4444' : '#10b981'}` }}></div>
              {downCount > 0 ? `${downCount} Nodes Offline` : 'All Systems Nominal'}
            </div>
          </div>

          <div style={{ width: '1px', height: '2.5rem', background: '#334155' }}></div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {devices.length > 0 && (
              <button className="btn btn-cancel" onClick={handleDeleteAll} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                Remove All
              </button>
            )}
            <button className="btn btn-primary" onClick={() => setShowScanner(true)} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', boxShadow: '0 4px 14px 0 rgba(56, 189, 248, 0.39)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Add Device
            </button>
            <button className="btn btn-secondary" onClick={() => setShowSettings(true)} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              Settings
            </button>
          </div>
        </div>
      </header>

      <div className="grid">
        {devices.map((device, i) => (
          <div
            key={device.id}
            className="card animate-slideIn"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className="card-header">
              <div>
                <div className="card-title">{device.name}</div>
                <div className="card-subtitle">{device.ip}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className={`badge badge-${device.status}`}>
                  {device.status.toUpperCase()}
                </span>
                <button className="btn-delete" title="Remove device" onClick={() => handleDeleteDevice(device.id)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            </div>

            <div className="stat-group">
              <div className="stat">
                <span className="stat-label">Latency</span>
                <span className="stat-value">
                  {device.latency_ms !== null ? (
                    <>
                      {device.latency_ms.toFixed(1)}
                      <span className="stat-unit">ms</span>
                    </>
                  ) : (
                    '--'
                  )}
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">Last Checked</span>
                <span className="stat-value" style={{ fontSize: '1rem', marginTop: '0.4rem' }}>
                  {device.last_check ? new Date(device.last_check).toLocaleTimeString() : 'Never'}
                </span>
              </div>
            </div>

            <Heatmap deviceId={device.id} />
          </div>
        ))}
      </div>

      <footer style={{ marginTop: '4rem', paddingBottom: '2rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.375rem', color: '#64748b', fontSize: '0.875rem', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', opacity: 0.5, transition: 'opacity 0.2s' }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}>
        <span>coded with</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: '#ef4444', fill: '#ef4444' }}>
          <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"></path>
        </svg>
        <span>by</span>
        <a href="https://github.com/Hounderd" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none', transition: 'color 0.2s' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.textDecoration = 'underline'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#38bdf8'; e.currentTarget.style.textDecoration = 'none'; }}>
          Hounderd
        </a>
      </footer>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {showScanner && <DeviceScanner onDeviceAdded={() => { setShowScanner(false); fetchDevices(); }} onCancel={() => setShowScanner(false)} />}
    </div>
  );
};

export default function App() {
  return <Dashboard />;
}
