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

  // Find all potential starts: [function]: { OR just { matching our pattern
  // We scan the string manually to handle nested braces correctly

  let i = 0;
  while (i < content.length) {
    // Optimization: fast forward to next '{'
    const nextBrace = content.indexOf('{', i);
    if (nextBrace === -1) break;

    // Check if this looks like a function result candidate
    // 1. Preceded by [function]:
    // 2. Or is a standalone JSON that looks like a result (contains "success":)

    let startIndex = nextBrace;
    let prefix = '';

    // Check for [function]: prefix
    const potentialPrefixStart = content.lastIndexOf('[function]:', nextBrace);
    if (potentialPrefixStart !== -1) {
      const gap = content.slice(potentialPrefixStart + 11, nextBrace);
      if (!gap.trim()) {
        startIndex = potentialPrefixStart;
        prefix = content.slice(potentialPrefixStart, nextBrace);
      }
    }

    // Now attempt to extract a balanced JSON object starting at nextBrace
    const extraction = extractBalancedJson(content, nextBrace);

    if (extraction) {
      try {
        const jsonStr = extraction.text;
        // Optimization check before parsing: must contain "success"
        if (jsonStr.includes('"success"')) {
          const parsed = JSON.parse(jsonStr);

          // Double check it has the structure we expect
          if (parsed.success !== undefined) {
            results.push({
              name: parsed.name || 'function',
              success: parsed.success,
              exitCode: parsed.exitCode !== undefined ? parsed.exitCode : 0,
              stdout: parsed.output || parsed.stdout || '',
              stderr: parsed.error || parsed.stderr || '',
              // include prefix in raw so it can be stripped too
              raw: prefix + jsonStr,
              startIndex: startIndex,
              endIndex: nextBrace + extraction.length
            });

            // Move index past this object
            i = nextBrace + extraction.length;
            continue;
          }
        }
      } catch (e) {
        // Not valid JSON, ignore
      }
    }

    // If we didn't match a valid object, just move past the brace
    i = nextBrace + 1;
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

  // Use the same parser to identify ranges to remove
  // We process from end to start to preserve indices
  const results = parseFunctionResults(content);

  // Sort by start index descending
  results.sort((a, b) => b.startIndex - a.startIndex);

  let cleaned = content;
  for (const result of results) {
    cleaned = cleaned.slice(0, result.startIndex) + cleaned.slice(result.endIndex);
  }

  // Clean up extra newlines left behind
  cleaned = cleaned.replace(/\n\s*\n\s*\n+/g, '\n\n').trim();

  return cleaned;
}

/**
 * Helper to extract a balanced JSON string starting at a given index
 * Handles nested braces and strings
 * @param {string} text 
 * @param {number} startIndex - index of the first '{'
 * @returns {{text: string, length: number} | null}
 */
function extractBalancedJson(text, startIndex) {
  if (text[startIndex] !== '{') return null;

  let braceCount = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else {
        if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
      }
    } else {
      if (char === '"') {
        inString = true;
      } else if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          // Found the matching closing brace
          const jsonText = text.slice(startIndex, i + 1);
          return { text: jsonText, length: i + 1 - startIndex };
        }
      }
    }
  }

  return null; // Unbalanced or malformed
}

/**
 * Extract thinking/reasoning content from text
 * Handles patterns like <think>...</think>, <thinking>...</thinking> or <reasoning>...</reasoning>
 * Supports partial/unclosed tags for streaming
 * @param {string} content - Content that may contain thinking tags
 * @returns {string} Extracted thinking content
 */
export function extractThinking(content) {
  if (!content || typeof content !== 'string') {
    return '';
  }

  // Pattern: <think>... (optional </think>)
  // We use a non-global regex loop or specific match to handle the "open at end" case
  // But matchAll works if we construct the regex correctly to match closed OR open-at-end

  // Regex: <tag> content (</tag> OR end-of-string)
  const thinkingPattern = /<(?:think|thinking|reasoning)>([\s\S]*?)(?:<\/(?:think|thinking|reasoning)>|$)/gis;
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

  // Remove <think>...</think> (closed) OR <think>...$ (unclosed)
  const thinkingPattern = /<(?:think|thinking|reasoning)>[\s\S]*?(?:<\/(?:think|thinking|reasoning)>|$)/gis;
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

