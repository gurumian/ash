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
          // Only treat this as a tool result if it was marked [function]:
          // or it looks like an actual command result (has output/exitCode).
          // Bare `{ "success": ... }` in prose should not become a command row.
          const looksLikeResult = Boolean(
            prefix.includes('[function]:') ||
            parsed.output !== undefined ||
            parsed.stdout !== undefined ||
            parsed.exitCode !== undefined
          );
          if (parsed.success !== undefined && looksLikeResult) {
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

const THINK_NAME = String.raw`(?:think|thinking|reasoning)`;

// Fresh regexes every call — module-level /g regexes keep lastIndex and skip later messages.
function thinkCompleteRe() {
  return new RegExp(
    `<\\s*${THINK_NAME}\\b[^>]*>[\\s\\S]*?<\\s*/\\s*${THINK_NAME}\\s*>` +
    `|&lt;\\s*${THINK_NAME}\\s*&gt;[\\s\\S]*?&lt;\\s*/\\s*${THINK_NAME}\\s*&gt;` +
    `|(?:(?:^|\\n)\\s*think>|(?<![</])think>)[\\s\\S]*?(?:<\\s*/\\s*${THINK_NAME}\\s*>|&lt;\\s*/\\s*${THINK_NAME}\\s*&gt;)`,
    'gi'
  );
}

function thinkCaptureRe() {
  return new RegExp(
    `(?:<\\s*${THINK_NAME}\\b[^>]*>|&lt;\\s*${THINK_NAME}\\s*&gt;|(?:^|\\n)\\s*think>|(?<![</])think>)` +
    `([\\s\\S]*?)` +
    `(?:<\\s*/\\s*${THINK_NAME}\\s*>|&lt;\\s*/\\s*${THINK_NAME}\\s*&gt;|$)`,
    'gi'
  );
}

function thinkOpenRe() {
  return new RegExp(
    `<\\s*${THINK_NAME}\\b[^>]*>|&lt;\\s*${THINK_NAME}\\s*&gt;|(?:^|\\n)\\s*think>|(?<![</])think>`,
    'gi'
  );
}

function thinkCloseRe() {
  return new RegExp(
    `<\\s*/\\s*${THINK_NAME}\\s*>|&lt;\\s*/\\s*${THINK_NAME}\\s*&gt;`,
    'gi'
  );
}

function thinkUnclosedBlockRe() {
  return new RegExp(
    `(?:<\\s*${THINK_NAME}\\b[^>]*>|&lt;\\s*${THINK_NAME}\\s*&gt;|(?:^|\\n)\\s*think>|(?<![</])think>)[\\s\\S]*$`,
    'i'
  );
}

/**
 * Extract thinking/reasoning content from text.
 * Handles <think>, leftover `think>` (when markdown ate `<`), and unclosed tags.
 */
export function extractThinking(content) {
  if (!content || typeof content !== 'string') {
    return '';
  }

  const matches = [...content.matchAll(thinkCaptureRe())];
  if (matches.length > 0) {
    return matches.map((m) => (m[1] || '').trim()).filter(Boolean).join('\n\n');
  }

  return '';
}

/**
 * Remove thinking tags so they never reach the visible reply.
 * @param {string} content
 * @param {{ swallowUnclosed?: boolean }} [options]
 *   swallowUnclosed (default true): drop everything after an unclosed think tag.
 *   Set false for tool stdout so a leftover `think>` does not wipe useful output.
 */
export function removeThinkingTags(content, options = {}) {
  if (!content || typeof content !== 'string') {
    return content;
  }

  const swallowUnclosed = options.swallowUnclosed !== false;
  let cleaned = content.replace(thinkCompleteRe(), '');
  if (swallowUnclosed) {
    cleaned = cleaned.replace(thinkUnclosedBlockRe(), '');
  }
  cleaned = cleaned.replace(thinkCloseRe(), '');
  cleaned = cleaned.replace(thinkOpenRe(), '');
  cleaned = cleaned.replace(/(^|\n)\s*think>\s*/gi, '$1');
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

