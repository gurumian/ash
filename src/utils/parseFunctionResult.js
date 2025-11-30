/**
 * Parse [function]: {...} pattern from content and extract structured data
 * 
 * Handles patterns like:
 * [function]: {"success": false, "output": "...", "error": "", "exitCode": 3}
 */

/**
 * Extract and parse function result patterns from text
 * @param {string} content - Content that may contain [function]: {...} patterns
 * @returns {Array<Object>} Array of parsed function results
 */
export function parseFunctionResults(content) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const results = [];
  
  // Pattern: [function]: {"success": true, "output": "...", "error": "", "exitCode": 0}
  // This pattern can span multiple lines
  const functionPattern = /\[function\]:\s*(\{[^}]*"success"[^}]*\}|\{[^}]+\})/gs;
  
  let match;
  while ((match = functionPattern.exec(content)) !== null) {
    try {
      const jsonStr = match[1];
      const parsed = JSON.parse(jsonStr);
      
      results.push({
        name: parsed.name || 'function',
        success: parsed.success !== undefined ? parsed.success : true,
        exitCode: parsed.exitCode !== undefined ? parsed.exitCode : 0,
        stdout: parsed.output || '',
        stderr: parsed.error || '',
        raw: match[0], // Original matched string for removal
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    } catch (e) {
      // Skip invalid JSON
      console.warn('Failed to parse function result JSON:', jsonStr, e);
    }
  }
  
  return results;
}

/**
 * Remove function result patterns from content
 * @param {string} content - Content to clean
 * @returns {string} Content with function patterns removed
 */
export function removeFunctionPatterns(content) {
  if (!content || typeof content !== 'string') {
    return content;
  }

  let cleaned = content;
  
  // Remove [function]: {...} patterns
  const functionPattern = /\[function\]:\s*\{[^}]*"success"[^}]*\}/gs;
  cleaned = cleaned.replace(functionPattern, '');
  
  // Remove standalone JSON patterns like {"success": true, ...}
  const jsonPattern = /\{"success":\s*(?:true|false)[^}]+\}/gs;
  cleaned = cleaned.replace(jsonPattern, '');
  
  // Clean up extra newlines
  cleaned = cleaned.replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
  
  return cleaned;
}

/**
 * Parse content and extract both function results and cleaned content
 * @param {string} content - Content to parse
 * @returns {{ functionResults: Array<Object>, cleanedContent: string }}
 */
export function parseAndCleanContent(content) {
  const functionResults = parseFunctionResults(content);
  const cleanedContent = removeFunctionPatterns(content);
  
  return {
    functionResults,
    cleanedContent
  };
}

