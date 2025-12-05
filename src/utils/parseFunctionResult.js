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
 * Extract thinking/reasoning content from text
 * Handles patterns like <thinking>...</thinking> or <reasoning>...</reasoning>
 * @param {string} content - Content that may contain thinking tags
 * @returns {string} Extracted thinking content
 */
export function extractThinking(content) {
  if (!content || typeof content !== 'string') {
    return '';
  }

  // Pattern: <thinking>...</thinking> or <reasoning>...</reasoning>
  const thinkingPattern = /<(?:thinking|reasoning)>(.*?)<\/(?:thinking|reasoning)>/gis;
  const matches = [...content.matchAll(thinkingPattern)];
  
  if (matches.length > 0) {
    // Combine all thinking blocks
    return matches.map(m => m[1].trim()).join('\n\n');
  }
  
  return '';
}

/**
 * Remove thinking tags from content
 * @param {string} content - Content to clean
 * @returns {string} Content with thinking tags removed
 */
export function removeThinkingTags(content) {
  if (!content || typeof content !== 'string') {
    return content;
  }

  // Remove <thinking>...</thinking> or <reasoning>...</reasoning> tags
  const thinkingPattern = /<(?:thinking|reasoning)>.*?<\/(?:thinking|reasoning)>/gis;
  let cleaned = content.replace(thinkingPattern, '');
  
  // Clean up extra newlines
  cleaned = cleaned.replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
  
  return cleaned;
}

/**
 * Extract plan/todos from content
 * Looks for patterns like "Plan:", "TODO:", "Steps:", etc.
 * @param {string} content - Content that may contain plan/todos
 * @returns {{ plan: string, todos: Array<string> }}
 */
export function extractPlanAndTodos(content) {
  if (!content || typeof content !== 'string') {
    return { plan: '', todos: [] };
  }

  let plan = '';
  const todos = [];
  
  // Look for plan sections (markdown headers or patterns)
  const planPattern = /(?:^|\n)(?:##?\s*)?(?:Plan|Planning|Strategy|Approach):\s*\n([\s\S]*?)(?=\n(?:##|$)|$)/i;
  const planMatch = content.match(planPattern);
  if (planMatch) {
    plan = planMatch[1].trim();
  }
  
  // Look for TODO items - more strict pattern
  // Only match actual TODO: patterns, not content that happens to contain "TODO"
  // Pattern: "TODO:" or "- TODO:" or "1. TODO:" at the start of a line
  const todoPattern = /(?:^|\n)[\s-]*TODO[:\s]+([^\n]{1,200}?)(?=\n|$)/gi;
  const todoMatches = [...content.matchAll(todoPattern)];
  
  // Filter out false positives (like "TODOs:" in headers or long content)
  const validTodos = todoMatches
    .map(m => m[1].trim())
    .filter(todo => {
      // Filter out if it's too long (likely not a TODO item)
      if (todo.length > 200) return false;
      // Filter out if it contains markdown headers or code blocks
      if (todo.includes('**') && todo.includes(':')) return false;
      // Filter out if it looks like data/statistics (contains numbers and units)
      if (/\d+\s*(GiB|MiB|GB|MB|%|bytes)/i.test(todo)) return false;
      return true;
    });
  
  todos.push(...validTodos);
  
  return { plan, todos };
}

/**
 * Parse content and extract both function results and cleaned content
 * @param {string} content - Content to parse
 * @returns {{ functionResults: Array<Object>, cleanedContent: string, thinking: string, plan: string, todos: Array<string> }}
 */
export function parseAndCleanContent(content) {
  const functionResults = parseFunctionResults(content);
  const thinking = extractThinking(content);
  const { plan, todos } = extractPlanAndTodos(content);
  
  // Remove thinking tags and function patterns
  let cleanedContent = removeThinkingTags(content);
  cleanedContent = removeFunctionPatterns(cleanedContent);
  
  return {
    functionResults,
    cleanedContent,
    thinking,
    plan,
    todos
  };
}

