/**
 * Error formatting utilities
 * 
 * This module provides utilities for formatting errors into user-friendly messages.
 * It's designed to be used alongside existing error handling code without breaking changes.
 */

/**
 * Format AI command errors into user-friendly error dialog format
 * @param {Error} error - The error object
 * @param {Object} context - Context information (e.g., llmSettings)
 * @returns {Object} Formatted error object with title, message, and detail
 */
export function formatAICommandError(error, context = {}) {
  const { llmSettings } = context;
  
  let errorTitle = 'AI Command Error';
  let errorMessage = 'Failed to process AI command';
  let errorDetail = error.message;

  // Check for specific error types
  if (error.message.includes('Failed to fetch') || 
      error.message.includes('NetworkError') || 
      error.message.includes('ECONNREFUSED')) {
    errorTitle = 'Connection Error';
    errorMessage = 'Cannot connect to LLM service';
    if (llmSettings?.provider === 'ollama') {
      errorDetail = `Cannot connect to Ollama at ${llmSettings.baseURL}\n\nPlease make sure:\n1. Ollama is running\n2. The base URL is correct (default: http://localhost:11434)\n3. The model "${llmSettings.model}" is installed`;
    } else {
      errorDetail = `Cannot connect to ${llmSettings?.provider} API.\n\nPlease check:\n1. Your internet connection\n2. API key is correct\n3. Base URL is correct`;
    }
  } else if (error.message.includes('API key') || 
             error.message.includes('401') || 
             error.message.includes('403')) {
    errorTitle = 'Authentication Error';
    errorMessage = 'Invalid API key';
    errorDetail = `Please check your ${llmSettings?.provider} API key in Settings.`;
  } else if (error.message.includes('not enabled')) {
    errorTitle = 'LLM Not Enabled';
    errorMessage = 'AI command assistance is disabled';
    errorDetail = 'Please enable "Enable AI command assistance" in Settings.';
  } else if (error.message.includes('No active session')) {
    errorTitle = 'No Active Session';
    errorMessage = 'No active terminal session';
    errorDetail = 'Please connect to a session first.';
  } else if (error.message.includes('not connected')) {
    errorTitle = 'Session Not Connected';
    errorMessage = 'The current session is not connected';
    errorDetail = 'Please reconnect to the session.';
  }

  return {
    title: errorTitle,
    message: errorMessage,
    detail: errorDetail,
    error: error // Pass original error for system info
  };
}

