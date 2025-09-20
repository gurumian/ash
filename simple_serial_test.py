#!/usr/bin/env python3
"""
Simple Serial Port Test - No external dependencies
Just sends data to a file that can be read as a serial port
"""

import time
import os

def create_test_serial_data():
    """Create test data that simulates serial port output"""
    test_port = '/tmp/vserial0'
    
    print(f"Creating test serial data on {test_port}")
    print("This simulates a device sending data to a serial port")
    print("Press Ctrl+C to stop")
    
    try:
        counter = 0
        while True:
            time.sleep(1)
            counter += 1
            
            # Create test data
            timestamp = time.strftime("%H:%M:%S")
            data = f"[{timestamp}] Device message #{counter}\r\n"
            
            # Write to the virtual serial port
            try:
                with open(test_port, 'w') as f:
                    f.write(data)
                print(f"Sent: {data.strip()}")
            except Exception as e:
                print(f"Error writing to {test_port}: {e}")
                time.sleep(2)
                
    except KeyboardInterrupt:
        print("\nTest stopped")

if __name__ == "__main__":
    create_test_serial_data()
