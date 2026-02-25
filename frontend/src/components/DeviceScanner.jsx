import React, { useState } from 'react';

export default function DeviceScanner({ onDeviceAdded, onCancel }) {
    const [scanning, setScanning] = useState(false);
    const [results, setResults] = useState(null);
    const [manualDevice, setManualDevice] = useState({ name: '', ip: '' });

    const handleScan = async () => {
        setScanning(true);
        setResults(null);
        try {
            const res = await fetch('/api/scan');
            const data = await res.json();
            setResults(data);
        } catch (err) {
            console.error("Scan failed", err);
        } finally {
            setScanning(false);
        }
    };

    const handleAdd = async (ip, name) => {
        try {
            // create safe ID from name
            const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Math.floor(Math.random() * 1000);
            await fetch('/api/devices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, name, ip })
            });
            onDeviceAdded();
        } catch (err) {
            alert("Failed to add device");
        }
    };

    const handleManualAdd = (e) => {
        e.preventDefault();
        if (manualDevice.name && manualDevice.ip) {
            handleAdd(manualDevice.ip, manualDevice.name);
            setManualDevice({ name: '', ip: '' });
        }
    };

    const handleAddAll = async () => {
        let addedCount = 0;
        for (const device of results.active_ips) {
            try {
                const id = device.name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Math.floor(Math.random() * 1000);
                await fetch('/api/devices', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, name: device.name, ip: device.ip })
                });
                addedCount++;
            } catch (err) {
                console.error("Failed to add", device.ip);
            }
        }
        if (addedCount > 0) {
            onDeviceAdded();
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h3>Add Device</h3>

                <div className="scan-section">
                    <h4>Auto-Discovery</h4>
                    <p className="subtitle">Scan local network for active IP addresses.</p>
                    <button className="btn btn-primary" onClick={handleScan} disabled={scanning}>
                        {scanning ? 'Scanning...' : 'Scan Network'}
                    </button>

                    {results && (
                        <div className="scan-results">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <p style={{ marginBottom: 0 }}>Found {results.active_ips.length} devices on {results.subnet}</p>
                                {results.active_ips.length > 0 && (
                                    <button className="btn btn-small" onClick={handleAddAll}>Add All</button>
                                )}
                            </div>
                            <ul className="ip-list">
                                {results.active_ips.map(device => (
                                    <li key={device.ip}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontWeight: 'bold', color: '#f8fafc' }}>{device.name}</span>
                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{device.ip}</span>
                                        </div>
                                        <button className="btn btn-small" onClick={() => handleAdd(device.ip, device.name)}>Add</button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="divider">OR</div>

                <div className="manual-section">
                    <h4>Manual Entry</h4>
                    <form onSubmit={handleManualAdd}>
                        <div className="form-group">
                            <label>Device Name</label>
                            <input
                                type="text"
                                value={manualDevice.name}
                                onChange={(e) => setManualDevice({ ...manualDevice, name: e.target.value })}
                                placeholder="Living Room TV"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>IP Address</label>
                            <input
                                type="text"
                                value={manualDevice.ip}
                                onChange={(e) => setManualDevice({ ...manualDevice, ip: e.target.value })}
                                placeholder="192.168.1.100"
                                required
                            />
                        </div>
                        <button type="submit" className="btn btn-secondary">Add Device</button>
                    </form>
                </div>

                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-cancel" onClick={onCancel}>Close</button>
                </div>
            </div>
        </div>
    );
}
