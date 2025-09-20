#!/usr/bin/env python3
"""
Serial Port Test Script
Simulates data being sent to a serial port for testing the ash application
"""

import time
import serial
import sys

def test_serial_output(port='/tmp/vserial1', baudrate=115200):
    """Send test data to the virtual serial port"""
    try:
        # Open serial connection
        ser = serial.Serial(port, baudrate, timeout=1)
        print(f"Connected to {port} at {baudrate} baud")
        
        # Send welcome message
        welcome_msg = "\r\n=== Serial Port Test Session ===\r\n"
        welcome_msg += "Connected to virtual serial port\r\n"
        welcome_msg += "Type 'help' for available commands\r\n"
        welcome_msg += "================================\r\n\r\n"
        
        ser.write(welcome_msg.encode())
        
        # Send periodic test data
        counter = 0
        while True:
            time.sleep(2)
            counter += 1
            
            # Send timestamp and counter
            timestamp = time.strftime("%H:%M:%S")
            test_data = f"[{timestamp}] Test message #{counter}\r\n"
            ser.write(test_data.encode())
            
            # Send some interactive prompts
            if counter % 5 == 0:
                prompt = f"Device> Ready for command #{counter}...\r\n"
                ser.write(prompt.encode())
            
            print(f"Sent: {test_data.strip()}")
            
    except serial.SerialException as e:
        print(f"Serial error: {e}")
    except KeyboardInterrupt:
        print("\nTest stopped by user")
    finally:
        if 'ser' in locals():
            ser.close()
            print("Serial connection closed")

if __name__ == "__main__":
    port = sys.argv[1] if len(sys.argv) > 1 else '/tmp/vserial1'
    baudrate = int(sys.argv[2]) if len(sys.argv) > 2 else 115200
    
    print(f"Starting serial test on {port} at {baudrate} baud")
    test_serial_output(port, baudrate)
