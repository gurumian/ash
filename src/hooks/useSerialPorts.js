import { useState, useCallback } from 'react';

/**
 * Custom hook for managing serial port list
 */
export function useSerialPorts() {
  const [availableSerialPorts, setAvailableSerialPorts] = useState([]);

  const loadSerialPorts = useCallback(async () => {
    try {
      const ports = await window.electronAPI.serialListPorts();
      setAvailableSerialPorts(ports);

      // Add some test ports for development
      if (import.meta.env.DEV) {
        const testPorts = [
          '/tmp/vserial0',
          '/tmp/vserial1',
          '/dev/tty.debug-console',
          '/dev/cu.debug-console'
        ];

        // Add test ports if they don't already exist
        const allPorts = [...ports];
        testPorts.forEach(testPort => {
          if (!allPorts.find(p => p.path === testPort)) {
            allPorts.push({ path: testPort, manufacturer: 'Test', serialNumber: 'TEST' });
          }
        });
        setAvailableSerialPorts(allPorts);
      } else {
        setAvailableSerialPorts(ports);
      }
    } catch (error) {
      console.error('Failed to load serial ports:', error);
      // Still add test ports even if real ports fail, but only in DEV
      if (import.meta.env.DEV) {
        setAvailableSerialPorts([
          { path: '/tmp/vserial0', manufacturer: 'Test', serialNumber: 'TEST' },
          { path: '/tmp/vserial1', manufacturer: 'Test', serialNumber: 'TEST' },
          { path: '/dev/tty.debug-console', manufacturer: 'Test', serialNumber: 'TEST' },
          { path: '/dev/cu.debug-console', manufacturer: 'Test', serialNumber: 'TEST' }
        ]);
      } else {
        setAvailableSerialPorts([]);
      }
    }
  }, []);

  return {
    availableSerialPorts,
    loadSerialPorts
  };
}

