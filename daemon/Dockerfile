FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# ping3 requires root privileges by default, but we can try to run it.
# The container runs as root anyway.
CMD ["python", "monitor.py"]
