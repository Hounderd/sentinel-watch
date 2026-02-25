import React, { useState, useEffect } from 'react';

export default function SettingsPanel({ onClose }) {
    const [settings, setSettings] = useState({
        ping_interval_seconds: '',
        timeout_seconds: '',
        latency_threshold_ms: '',
        ntfy_url: ''
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                setSettings(data);
                setLoading(false);
            });
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings })
            });
            alert('Settings saved. The daemon will pick these up automatically.');
            onClose();
        } catch (err) {
            alert('Failed to save settings');
        }
    };

    const handleChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    if (loading) return <div className="modal-overlay"><div className="modal-content"><p>Loading settings...</p></div></div>;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h3>System Settings</h3>
                <p className="subtitle">Configure SentinelWatch parameters and webhook alerts.</p>

                <form onSubmit={handleSave}>
                    <div className="form-group">
                        <label>Ping Interval (Seconds)</label>
                        <input
                            type="number"
                            value={settings.ping_interval_seconds}
                            onChange={e => handleChange('ping_interval_seconds', e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Ping Timeout (Seconds)</label>
                        <input
                            type="number"
                            value={settings.timeout_seconds}
                            onChange={e => handleChange('timeout_seconds', e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Latency Threshold (ms)</label>
                        <input
                            type="number"
                            value={settings.latency_threshold_ms}
                            onChange={e => handleChange('latency_threshold_ms', e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>ntfy Webhook URL</label>
                        <input
                            type="text"
                            value={settings.ntfy_url}
                            onChange={e => handleChange('ntfy_url', e.target.value)}
                            placeholder="http://localhost:8080/sentinel_alerts"
                        />
                        <small>Leave blank to disable alerts.</small>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Config</button>
                        <button type="button" className="btn btn-cancel" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
