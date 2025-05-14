#!/usr/bin/env python3
import psutil
import time

with open("cpu.log", "a") as cpu_log, open("ram.log", "a") as ram_log:
    try:
        while True:
            # Measure over 1 second
            cpu_pct = psutil.cpu_percent(interval=1)
            ram_mb = psutil.virtual_memory().used / (1024 * 1024)

            cpu_log.write(f"{cpu_pct:.1f}\n")
            cpu_log.flush()

            ram_log.write(f"{ram_mb:.1f}\n")
            ram_log.flush()
    except KeyboardInterrupt:
        print("\nLogging stopped")
