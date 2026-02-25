import sqlite3
import os
import time

DB_PATH = "/app/data/sentinel.db"

def get_connection():
    # Ensure data directory exists
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=20)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL;')
    return conn

def init_db():
    conn = get_connection()
    c = conn.cursor()
    
    # Settings table
    c.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    ''')
    
    # Insert default settings if not exist
    default_settings = {
        'ping_interval_seconds': '10',
        'timeout_seconds': '2',
        'latency_threshold_ms': '200',
        'ntfy_url': 'http://localhost:8080/sentinel_alerts'
    }
    for k, v in default_settings.items():
        c.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', (k, v))

    c.execute('''
        CREATE TABLE IF NOT EXISTS devices (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            ip TEXT NOT NULL
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS pings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            latency_ms REAL,
            is_drop BOOLEAN NOT NULL CHECK (is_drop IN (0, 1)),
            FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
        )
    ''')
    
    c.execute('CREATE INDEX IF NOT EXISTS idx_pings_device_time ON pings(device_id, timestamp)')
    
    # Enable foreign keys for cascade delete
    c.execute('PRAGMA foreign_keys = ON;')
    
    conn.commit()
    conn.close()

def sync_devices(devices_config):
    conn = get_connection()
    c = conn.cursor()
    for d in devices_config:
        c.execute('INSERT OR REPLACE INTO devices (id, name, ip) VALUES (?, ?, ?)',
                  (d['id'], d['name'], d['ip']))
    conn.commit()
    conn.close()

def record_ping(device_id, latency_ms, is_drop):
    conn = get_connection()
    c = conn.cursor()
    c.execute('''
        INSERT INTO pings (device_id, latency_ms, is_drop)
        VALUES (?, ?, ?)
    ''', (device_id, latency_ms, 1 if is_drop else 0))
    conn.commit()
    conn.close()
