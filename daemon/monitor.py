import time
import json
import logging
import requests
from ping3 import ping
from db import init_db, record_ping, get_connection

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')


class Monitor:
    def __init__(self):
        init_db()
        self.last_status = {}
    
    def get_settings(self):
        conn = get_connection()
        c = conn.cursor()
        c.execute('SELECT key, value FROM settings')
        settings = {row['key']: row['value'] for row in c.fetchall()}
        conn.close()
        return settings

    def get_devices(self):
        conn = get_connection()
        c = conn.cursor()
        c.execute('SELECT id, name, ip FROM devices')
        devices = [dict(row) for row in c.fetchall()]
        conn.close()
        return devices

    def send_alert(self, ntfy_url, title, message, priority="default", tags=""):
        if not ntfy_url:
            return
        
        headers = {
            "Title": title,
            "Priority": priority,
        }
        if tags:
            headers["Tags"] = tags
            
        try:
            requests.post(ntfy_url, data=message.encode('utf-8'), headers=headers, timeout=5)
            logging.info(f"Alert sent: {title} - {message}")
        except Exception as e:
            logging.error(f"Failed to send alert: {e}")

    def run(self):
        logging.info(f"Starting SentinelWatch Daemon attached to SQLite configuration.")
        
        while True:
            # Refresh config every loop
            settings = self.get_settings()
            devices = self.get_devices()
            
            interval = int(settings.get('ping_interval_seconds', 10))
            timeout = int(settings.get('timeout_seconds', 2))
            threshold = int(settings.get('latency_threshold_ms', 200))
            ntfy_url = settings.get('ntfy_url', '')

            # Initialize tracking for new devices
            for device in devices:
                if device['id'] not in self.last_status:
                    self.last_status[device['id']] = 'up'

            for device in devices:
                dev_id = device['id']
                ip = device['ip']
                name = device['name']
                
                try:
                    # ping returns latency in seconds, or None if timeout/drop
                    result = ping(ip, timeout=timeout)
                    
                    if result is None or result is False:
                        record_ping(dev_id, -1, True)
                        if self.last_status[dev_id] == 'up':
                            self.send_alert(ntfy_url, f"{name} is DOWN", f"Device {name} ({ip}) failed to respond to ping.", "high", "rotating_light,down")
                            self.last_status[dev_id] = 'down'
                        logging.warning(f"Device {name} ({ip}) is DOWN")
                    else:
                        latency_ms = result * 1000
                        record_ping(dev_id, latency_ms, False)
                        
                        # Check for recovery
                        if self.last_status[dev_id] == 'down':
                            self.send_alert(ntfy_url, f"{name} is UP", f"Device {name} ({ip}) is back online. Latency: {latency_ms:.1f}ms", "default", "white_check_mark,up")
                            self.last_status[dev_id] = 'up'
                            
                        # Check threshold
                        if latency_ms > threshold:
                            logging.warning(f"Device {name} ({ip}) High Latency: {latency_ms:.1f}ms")
                            # Optionally send alert for high latency (could get spammy, so left to logging only or need rate-limiting)
                        else:
                            logging.debug(f"Device {name} ({ip}) OK: {latency_ms:.1f}ms")
                        
                except Exception as e:
                    logging.error(f"Error pinging {name} ({ip}): {e}")
                    record_ping(dev_id, -1, True)

            time.sleep(interval)

if __name__ == "__main__":
    monitor = Monitor()
    monitor.run()
