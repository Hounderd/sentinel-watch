import platform
import subprocess
import socket
from typing import List, Dict

def ping_sweep(subnet: str) -> List[Dict[str, str]]:
    """
    Very basic ping sweep.
    Subnet format expected: '192.168.1.' (We just append 1-254)
    For a production app, we would use scapy or nmap.
    For this portfolio project, we will use a naive fast ping sweep using threads or subprocess.
    """
    import concurrent.futures

    active_ips = []
    
    # Extract base IP assuming something like "192.168.1.0/24" or just "192.168.1"
    base_ip = ".".join(subnet.split('.')[:3]) + "."

    def ping_ip(ip):
        # -n 1 for Windows, -c 1 for Linux
        param = '-n' if platform.system().lower() == 'windows' else '-c'
        command = ['ping', param, '1', '-w', '500', ip] 
        # Unix timeout is generally different, but subprocess will handle it.
        # -W 1 (1 second timeout) for linux, -w 500 (ms) for windows
        timeout_param = '-w' if platform.system().lower() == 'windows' else '-W'
        timeout_val = '500' if platform.system().lower() == 'windows' else '1'
        command = ['ping', param, '1', timeout_param, timeout_val, ip]

        try:
            output = subprocess.run(command, capture_output=True, text=True, timeout=2)
            if output.returncode == 0 and "unreachable" not in output.stdout.lower():
                name = f"Device {ip}"
                try:
                    name = socket.gethostbyaddr(ip)[0]
                except Exception:
                    try:
                        import dns.resolver
                        import dns.reversename
                        router_ip = ".".join(subnet.split('.')[:3]) + ".1"
                        res = dns.resolver.Resolver(configure=False)
                        res.nameservers = [router_ip, '8.8.8.8']
                        res.timeout = 1
                        res.lifetime = 1
                        rev_name = dns.reversename.from_address(ip)
                        answers = res.resolve(rev_name, "PTR")
                        name = str(answers[0]).rstrip('.')
                    except Exception:
                        pass
                return {"ip": ip, "name": name}
        except Exception:
            pass
        return None

    # Scan 1 to 254
    ips_to_scan = [f"{base_ip}{i}" for i in range(1, 255)]
    
    # We are using FastAPI, so we don't want to block the thread for too long.
    # We will use ThreadPoolExecutor for concurrent fast pings.
    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
        results = executor.map(ping_ip, ips_to_scan)
        
    for res in results:
        if res:
            active_ips.append(res)
            
    return active_ips

def get_local_subnet():
    """Attempt to guess the local subnet."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
        
    # Docker networks usually start with 172.x.x.x
    # If we are isolated in docker bridge, try to fallback to common local subnets.
    if IP.startswith('172.') or IP.startswith('127.') or IP.startswith('10.'):
        # We're likely in a docker container or loopback. 
        # A proper fix would require `network_mode: host` or passing the subnet from the frontend/env.
        # For this portfolio app demonstration without `network_mode: host` on the API container,
        # we'll hardcode the most common home network subnet so the scan works out-of-the-box for the user.
        return "192.168.1.0/24"
        
    return ".".join(IP.split('.')[:3]) + ".0/24"
