/**
 * Free Key Service - Handles free API key requests
 */

const ASH_API_BASE_URL = 'https://ash.toktoktalk.com';

/**
 * Get client identifier (device ID or IP+User-Agent hash)
 * Uses localStorage to persist device ID
 */
function getClientIdentifier() {
  // Try to get existing device ID from localStorage
  let deviceId = localStorage.getItem('ash-device-id');
  
  if (!deviceId) {
    // Generate a new device ID (UUID-like format)
    deviceId = 'device-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('ash-device-id', deviceId);
  }
  
  return deviceId;
}

/**
 * Request a free API key from the backend
 * @returns {Promise<{key: string, keyId: string, tokenLimit: number, message: string} | null>}
 * Returns null if already requested today (once per day limit)
 */
export async function requestFreeKey() {
  try {
    const clientIdentifier = getClientIdentifier();
    
    const response = await fetch(`${ASH_API_BASE_URL}/api/free-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deviceId: clientIdentifier
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || `Failed to request free key: ${response.status} ${response.statusText}`;
      
      // "once per day" is a normal response - user already has a key or requested today
      if (errorMessage.includes('once per day') || errorMessage.includes('already requested')) {
        console.log('[FreeKeyService] Free key already requested today or key exists');
        return null; // Return null to indicate no new key needed
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    if (data.result === 'ok') {
      return {
        key: data.key,
        keyId: data.keyId,
        tokenLimit: data.tokenLimit,
        message: data.message
      };
    } else {
      throw new Error(data.message || 'Failed to get free key');
    }
  } catch (error) {
    // Only log actual errors, not "once per day" responses
    if (!error.message.includes('once per day') && !error.message.includes('already requested')) {
      console.error('Free key request error:', error);
    }
    throw error;
  }
}

/**
 * Check if current API key is the default test key
 * @param {string} apiKey - API key to check
 * @returns {boolean}
 */
export function isDefaultTestKey(apiKey) {
  const DEFAULT_ASH_API_KEY = 'ash-00000000-0000-0000-0000-000000000001';
  return !apiKey || apiKey === DEFAULT_ASH_API_KEY || apiKey.trim() === '';
}

/**
 * Check if we should request a free key
 * @param {Object} llmSettings - Current LLM settings
 * @returns {boolean}
 */
export function shouldRequestFreeKey(llmSettings) {
  // Only request for 'ash' provider
  if (llmSettings?.provider !== 'ash') {
    return false;
  }
  
  // Request if API key is missing or is the default test key
  return isDefaultTestKey(llmSettings?.apiKey);
}

/**
 * Check if there's a valid API key stored in localStorage
 * @returns {boolean}
 */
export function hasValidStoredKey() {
  try {
    const saved = localStorage.getItem('ash-llm-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      const apiKey = parsed.apiKey;
      // Valid if exists and is not the default test key
      return apiKey && !isDefaultTestKey(apiKey);
    }
  } catch (e) {
    // Ignore parse errors
  }
  return false;
}

