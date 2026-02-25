from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import json
import logging
from typing import List, Optional, Dict, Any
from scanner import ping_sweep, get_local_subnet
from typing import List, Optional

app = FastAPI(title="SentinelWatch API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "/app/data/sentinel.db"

def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=20)
    conn.row_factory = sqlite3.Row
    # Ensure pragmas
    conn.execute('PRAGMA journal_mode=WAL;')
    conn.execute('PRAGMA foreign_keys = ON;')
    return conn

class DeviceModel(BaseModel):
    id: str
    name: str
    ip: str

class SettingsModel(BaseModel):
    settings: Dict[str, str]


@app.get("/api/devices")
def get_devices():
    conn = get_db()
    c = conn.cursor()
    
    # Fetch devices from db
    c.execute('SELECT id, name, ip FROM devices')
    devices = [dict(row) for row in c.fetchall()]
    
    # Get latest ping for each device
    result_devices = []
    for d in devices:
        c.execute('''
            SELECT latency_ms, is_drop, timestamp 
            FROM pings 
            WHERE device_id = ? 
            ORDER BY timestamp DESC 
            LIMIT 1
        ''', (d['id'],))
        row = c.fetchone()
        
        status = "unknown"
        latency = None
        last_check = None
        
        if row:
            is_drop = bool(row['is_drop'])
            status = "down" if is_drop else "up"
            latency = row['latency_ms']
            last_check = row['timestamp']
            
        result_devices.append({
            "id": d['id'],
            "name": d['name'],
            "ip": d['ip'],
            "status": status,
            "latency_ms": latency,
            "last_check": last_check
        })
        
    conn.close()
    return result_devices

@app.get("/api/devices/{device_id}/history")
def get_device_history(device_id: str, limit: int = 100):
    conn = get_db()
    c = conn.cursor()
    c.execute('''
        SELECT timestamp, latency_ms, is_drop 
        FROM pings 
        WHERE device_id = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
    ''', (device_id, limit))
    rows = c.fetchall()
    conn.close()
    
    history = []
    for row in reversed(rows): # return oldest first
        history.append({
            "timestamp": row["timestamp"],
            "latency_ms": row["latency_ms"],
            "is_drop": bool(row["is_drop"])
        })
        
    return history

@app.get("/api/settings")
def get_settings():
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT key, value FROM settings')
    settings = {row['key']: row['value'] for row in c.fetchall()}
    conn.close()
    return settings

@app.post("/api/settings")
def update_settings(payload: SettingsModel):
    conn = get_db()
    c = conn.cursor()
    for k, v in payload.settings.items():
        c.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', (k, str(v)))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.post("/api/devices")
def add_device(device: DeviceModel):
    conn = get_db()
    c = conn.cursor()
    try:
        c.execute('INSERT INTO devices (id, name, ip) VALUES (?, ?, ?)', (device.id, device.name, device.ip))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Device ID already exists")
    conn.close()
    return {"status": "success"}

@app.delete("/api/devices/{device_id}")
def delete_device(device_id: str):
    conn = get_db()
    c = conn.cursor()
    c.execute('DELETE FROM devices WHERE id = ?', (device_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.delete("/api/devices")
def delete_all_devices():
    conn = get_db()
    c = conn.cursor()
    c.execute('DELETE FROM devices')
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.get("/api/scan")
def scan_network():
    subnet = get_local_subnet()
    ips = ping_sweep(subnet)
    return {"subnet": subnet, "active_ips": ips}
