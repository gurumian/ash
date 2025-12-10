/**
 * LLM Service - Handles communication with various LLM providers
 */

class LLMService {
  constructor(settings) {
    this.provider = settings.provider || 'ollama';
    this.apiKey = settings.apiKey || '';
    this.baseURL = settings.baseURL || 'http://localhost:11434';
    this.model = settings.model || 'llama3.2';
    this.temperature = settings.temperature || 0.7;
    this.maxTokens = settings.maxTokens || 1000;
  }

  /**
   * Convert natural language to shell command
   * @param {string} naturalLanguage - Natural language input
   * @param {Object} context - Context information
   * @param {Function} onChunk - Callback for streaming chunks (optional)
   * @param {AbortSignal} abortSignal - Signal for cancellation (optional)
   * @returns {Promise<string>} - Generated command
   */
  async convertToCommand(naturalLanguage, context = {}, onChunk = null, abortSignal = null) {
    const prompt = this.buildPrompt(naturalLanguage, context);
    
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('LLM Service - Calling LLM with prompt:', prompt);
      }
      
      const response = await this.callLLM(prompt, onChunk, abortSignal);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('LLM Service - Raw response:', response);
      }
      
      return this.parseResponse(response);
    } catch (error) {
      // Handle abort errors
      if (abortSignal?.aborted || error?.name === 'AbortError' || error?.message?.includes('aborted') || error?.message?.includes('cancelled')) {
        throw new Error('Request cancelled by user');
      }
      console.error('LLM Service error:', error);
      throw new Error(`Failed to convert to command: ${error.message}`);
    }
  }

  /**
   * Build prompt for LLM
   */
  buildPrompt(naturalLanguage, context) {
    const systemPrompt = `You are a helpful assistant that converts natural language requests into shell commands.

CRITICAL RULES:
1. Return ONLY the shell command, nothing else
2. Do NOT include any prompt symbols like $, >, or # at the beginning or anywhere in the command
3. Do NOT include explanations, comments, or markdown code blocks
4. Return the pure command that can be executed directly
5. Use appropriate commands for the user's request
6. If the request is ambiguous, use the most common interpretation
7. For file operations, use relative paths when possible
8. Return a single command, or multiple commands separated by && if necessary

Examples:
- User: "find all jpg files"
  Correct: find . -type f -iname "*.jpg" -o -iname "*.jpeg"
  Wrong: $ find . -type f $ -iname "*.jpg" $ -print

- User: "list files in current directory"
  Correct: ls -la
  Wrong: $ ls -la

Current directory: ${context.currentDirectory || 'unknown'}
User request: ${naturalLanguage}

Command:`;

    return {
      system: systemPrompt,
      user: naturalLanguage
    };
  }

  /**
   * Call LLM API based on provider
   * @param {Object} prompt - Prompt object
   * @param {Function} onChunk - Callback for streaming chunks (optional)
   * @param {AbortSignal} abortSignal - Signal for cancellation (optional)
   * @returns {Promise<string>} - Full response
   */
  async callLLM(prompt, onChunk = null, abortSignal = null) {
    switch (this.provider) {
      case 'ollama':
        return await this.callOllama(prompt, onChunk, abortSignal);
      case 'openai':
        return await this.callOpenAI(prompt, onChunk, abortSignal);
      case 'anthropic':
        return await this.callAnthropic(prompt, onChunk, abortSignal);
      case 'ash':
        return await this.callAsh(prompt, onChunk, abortSignal);
      default:
        throw new Error(`Unsupported provider: ${this.provider}`);
    }
  }

  /**
   * Call Ollama API with streaming support
   */
  async callOllama(prompt, onChunk = null, abortSignal = null) {
    const url = `${this.baseURL}/api/generate`;
    
    // Use streaming if onChunk callback is provided
    if (onChunk) {
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            prompt: `${prompt.system}\n\n${prompt.user}`,
            stream: true,
            options: {
              temperature: this.temperature,
              num_predict: this.maxTokens
            }
          }),
          signal: abortSignal
        });
      } catch (fetchError) {
        if (fetchError.name === 'AbortError' || abortSignal?.aborted) {
          throw new Error('Request cancelled by user');
        }
        throw fetchError;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          
          // Keep the last incomplete line in buffer
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            
            try {
              const data = JSON.parse(line);
              if (data.response) {
                const text = data.response;
                fullResponse += text;
                if (onChunk) {
                  onChunk(text);
                }
              }
              if (data.done) {
                break;
              }
            } catch (e) {
              // Skip invalid JSON lines
              if (process.env.NODE_ENV === 'development') {
                console.warn('LLM Service - Failed to parse JSON line:', line, e);
              }
            }
          }
        }
      } catch (streamError) {
        if (streamError?.name === 'AbortError' || streamError?.message?.includes('cancelled') || abortSignal?.aborted) {
          try {
            reader.cancel();
          } catch (cancelError) {
            // Ignore cancel errors
          }
          throw new Error('Request cancelled by user');
        }
        throw streamError;
      } finally {
        try {
          reader.releaseLock();
        } catch (lockError) {
          // Ignore lock release errors
        }
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('LLM Service - Ollama streaming response length:', fullResponse.length);
      }

      return fullResponse;
    } else {
      // Non-streaming fallback
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            prompt: `${prompt.system}\n\n${prompt.user}`,
            stream: false,
            options: {
              temperature: this.temperature,
              num_predict: this.maxTokens
            }
          }),
          signal: abortSignal
        });
      } catch (fetchError) {
        if (fetchError.name === 'AbortError' || abortSignal?.aborted) {
          throw new Error('Request cancelled by user');
        }
        throw fetchError;
      }

      if (!response.ok) {
        try {
          const errorText = await response.text();
          throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
        } catch (textError) {
          if (textError.name === 'AbortError' || abortSignal?.aborted) {
            throw new Error('Request cancelled by user');
          }
          throw textError;
        }
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        if (jsonError.name === 'AbortError' || abortSignal?.aborted) {
          throw new Error('Request cancelled by user');
        }
        throw jsonError;
      }
      
      const result = data.response || data.text || '';
      
      // Check if aborted before returning
      if (abortSignal?.aborted) {
        throw new Error('Request cancelled by user');
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('LLM Service - Ollama non-streaming response:', result);
      }
      
      return result;
    }
  }

  /**
   * Call OpenAI API with streaming support
   */
  async callOpenAI(prompt, onChunk = null, abortSignal = null) {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    const url = `${this.baseURL}/chat/completions`;
    
    // Use streaming if onChunk callback is provided
    if (onChunk) {
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              { role: 'system', content: prompt.system },
              { role: 'user', content: prompt.user }
            ],
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            stream: true
          }),
          signal: abortSignal
        });
      } catch (fetchError) {
        if (fetchError.name === 'AbortError' || abortSignal?.aborted) {
          throw new Error('Request cancelled by user');
        }
        throw fetchError;
      }

      if (!response.ok) {
        try {
          const errorText = await response.text();
          throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
        } catch (textError) {
          if (textError.name === 'AbortError' || abortSignal?.aborted) {
            throw new Error('Request cancelled by user');
          }
          throw textError;
        }
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      try {
        while (true) {
          // Check if aborted
          if (abortSignal?.aborted) {
            reader.cancel();
            throw new Error('Request cancelled by user');
          }
          
          let done, value;
          try {
            const result = await reader.read();
            done = result.done;
            value = result.value;
          } catch (readError) {
            if (readError.name === 'AbortError' || abortSignal?.aborted) {
              reader.cancel();
              throw new Error('Request cancelled by user');
            }
            throw readError;
          }
          
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim() && line.startsWith('data: '));

          for (const line of lines) {
            // Check if aborted during processing
            if (abortSignal?.aborted) {
              reader.cancel();
              throw new Error('Request cancelled by user');
            }
            
            const data = line.replace(/^data: /, '');
            if (data === '[DONE]') break;

            try {
              const json = JSON.parse(data);
              const delta = json.choices[0]?.delta?.content;
              if (delta) {
                fullResponse += delta;
                if (onChunk && !abortSignal?.aborted) {
                  onChunk(delta);
                }
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      } catch (streamError) {
        if (streamError?.name === 'AbortError' || streamError?.message?.includes('cancelled') || abortSignal?.aborted) {
          try {
            reader.cancel();
          } catch (cancelError) {
            // Ignore cancel errors
          }
          throw new Error('Request cancelled by user');
        }
        throw streamError;
      } finally {
        try {
          reader.releaseLock();
        } catch (lockError) {
          // Ignore lock release errors
        }
      }

      // Check if aborted before returning
      if (abortSignal?.aborted) {
        throw new Error('Request cancelled by user');
      }

      return fullResponse;
    } else {
      // Non-streaming fallback
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              { role: 'system', content: prompt.system },
              { role: 'user', content: prompt.user }
            ],
            temperature: this.temperature,
            max_tokens: this.maxTokens
          }),
          signal: abortSignal
        });
      } catch (fetchError) {
        if (fetchError.name === 'AbortError' || abortSignal?.aborted) {
          throw new Error('Request cancelled by user');
        }
        throw fetchError;
      }

      if (!response.ok) {
        try {
          const errorText = await response.text();
          throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
        } catch (textError) {
          if (textError.name === 'AbortError' || abortSignal?.aborted) {
            throw new Error('Request cancelled by user');
          }
          throw textError;
        }
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        if (jsonError.name === 'AbortError' || abortSignal?.aborted) {
          throw new Error('Request cancelled by user');
        }
        throw jsonError;
      }
      
      // Check if aborted before returning
      if (abortSignal?.aborted) {
        throw new Error('Request cancelled by user');
      }
      
      return data.choices[0]?.message?.content || '';
    }
  }

  /**
   * Call Anthropic API with streaming support
   */
  async callAnthropic(prompt, onChunk = null, abortSignal = null) {
    if (!this.apiKey) {
      throw new Error('Anthropic API key is required');
    }

    const url = `${this.baseURL}/messages`;
    
    // Use streaming if onChunk callback is provided
    if (onChunk) {
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              { role: 'user', content: `${prompt.system}\n\n${prompt.user}` }
            ],
            temperature: this.temperature,
            max_tokens: this.maxTokens,
            stream: true
          }),
          signal: abortSignal
        });
      } catch (fetchError) {
        if (fetchError.name === 'AbortError' || abortSignal?.aborted) {
          throw new Error('Request cancelled by user');
        }
        throw fetchError;
      }

      if (!response.ok) {
        try {
          const errorText = await response.text();
          throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
        } catch (textError) {
          if (textError.name === 'AbortError' || abortSignal?.aborted) {
            throw new Error('Request cancelled by user');
          }
          throw textError;
        }
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      try {
        while (true) {
          // Check if aborted
          if (abortSignal?.aborted) {
            reader.cancel();
            throw new Error('Request cancelled by user');
          }
          
          let done, value;
          try {
            const result = await reader.read();
            done = result.done;
            value = result.value;
          } catch (readError) {
            if (readError.name === 'AbortError' || abortSignal?.aborted) {
              reader.cancel();
              throw new Error('Request cancelled by user');
            }
            throw readError;
          }
          
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim() && line.startsWith('data: '));

          for (const line of lines) {
            // Check if aborted during processing
            if (abortSignal?.aborted) {
              reader.cancel();
              throw new Error('Request cancelled by user');
            }
            
            const data = line.replace(/^data: /, '');
            if (data === '[DONE]') break;

            try {
              const json = JSON.parse(data);
              if (json.type === 'content_block_delta' && json.delta?.text) {
                const text = json.delta.text;
                fullResponse += text;
                if (onChunk && !abortSignal?.aborted) {
                  onChunk(text);
                }
              } else if (json.type === 'message_stop') {
                break;
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      } catch (streamError) {
        if (streamError?.name === 'AbortError' || streamError?.message?.includes('cancelled') || abortSignal?.aborted) {
          try {
            reader.cancel();
          } catch (cancelError) {
            // Ignore cancel errors
          }
          throw new Error('Request cancelled by user');
        }
        throw streamError;
      } finally {
        try {
          reader.releaseLock();
        } catch (lockError) {
          // Ignore lock release errors
        }
      }

      // Check if aborted before returning
      if (abortSignal?.aborted) {
        throw new Error('Request cancelled by user');
      }

      return fullResponse;
    } else {
      // Non-streaming fallback
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              { role: 'user', content: `${prompt.system}\n\n${prompt.user}` }
            ],
            temperature: this.temperature,
            max_tokens: this.maxTokens
          }),
          signal: abortSignal
        });
      } catch (fetchError) {
        if (fetchError.name === 'AbortError' || abortSignal?.aborted) {
          throw new Error('Request cancelled by user');
        }
        throw fetchError;
      }

      if (!response.ok) {
        try {
          const errorText = await response.text();
          throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
        } catch (textError) {
          if (textError.name === 'AbortError' || abortSignal?.aborted) {
            throw new Error('Request cancelled by user');
          }
          throw textError;
        }
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        if (jsonError.name === 'AbortError' || abortSignal?.aborted) {
          throw new Error('Request cancelled by user');
        }
        throw jsonError;
      }
      
      // Check if aborted before returning
      if (abortSignal?.aborted) {
        throw new Error('Request cancelled by user');
      }
      
      return data.content[0]?.text || '';
    }
  }

  /**
   * Call Ash API with streaming support (using /v1/generate interface)
   */
  async callAsh(prompt, onChunk = null, abortSignal = null) {
    // Ensure baseURL ends with /v1
    const baseURL = this.baseURL.endsWith('/v1') ? this.baseURL : `${this.baseURL.replace(/\/$/, '')}/v1`;
    const url = `${baseURL}/generate`;
    
    // Build headers
    const headers = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }
    
    // Use streaming if onChunk callback is provided
    if (onChunk) {
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            model: this.model,
            prompt: `${prompt.system}\n\n${prompt.user}`,
            stream: true,
            options: {
              temperature: this.temperature,
              num_predict: this.maxTokens
            }
          }),
          signal: abortSignal
        });
      } catch (fetchError) {
        if (fetchError.name === 'AbortError' || abortSignal?.aborted) {
          throw new Error('Request cancelled by user');
        }
        throw fetchError;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ash API error: ${response.status} - ${errorText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          
          // Keep the last incomplete line in buffer
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            
            try {
              const data = JSON.parse(line);
              if (data.response) {
                const text = data.response;
                fullResponse += text;
                if (onChunk) {
                  onChunk(text);
                }
              }
              if (data.done) {
                break;
              }
            } catch (e) {
              // Skip invalid JSON lines
              if (process.env.NODE_ENV === 'development') {
                console.warn('LLM Service - Failed to parse JSON line:', line, e);
              }
            }
          }
        }
      } catch (streamError) {
        if (streamError?.name === 'AbortError' || streamError?.message?.includes('cancelled') || abortSignal?.aborted) {
          try {
            reader.cancel();
          } catch (cancelError) {
            // Ignore cancel errors
          }
          throw new Error('Request cancelled by user');
        }
        throw streamError;
      } finally {
        try {
          reader.releaseLock();
        } catch (lockError) {
          // Ignore lock release errors
        }
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('LLM Service - Ash streaming response length:', fullResponse.length);
      }

      return fullResponse;
    } else {
      // Non-streaming fallback
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            model: this.model,
            prompt: `${prompt.system}\n\n${prompt.user}`,
            stream: false,
            options: {
              temperature: this.temperature,
              num_predict: this.maxTokens
            }
          }),
          signal: abortSignal
        });
      } catch (fetchError) {
        if (fetchError.name === 'AbortError' || abortSignal?.aborted) {
          throw new Error('Request cancelled by user');
        }
        throw fetchError;
      }

      if (!response.ok) {
        try {
          const errorText = await response.text();
          throw new Error(`Ash API error: ${response.status} - ${errorText}`);
        } catch (textError) {
          if (textError.name === 'AbortError' || abortSignal?.aborted) {
            throw new Error('Request cancelled by user');
          }
          throw textError;
        }
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        if (jsonError.name === 'AbortError' || jsonError?.aborted) {
          throw new Error('Request cancelled by user');
        }
        throw jsonError;
      }
      
      const result = data.response || data.text || '';
      
      // Check if aborted before returning
      if (abortSignal?.aborted) {
        throw new Error('Request cancelled by user');
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('LLM Service - Ash non-streaming response:', result);
      }
      
      return result;
    }
  }

  /**
   * Parse LLM response to extract command
   */
  parseResponse(response) {
    if (!response || (typeof response === 'string' && !response.trim())) {
      if (process.env.NODE_ENV === 'development') {
        console.error('LLM Service - Empty response received:', response);
      }
      throw new Error('Empty response from LLM');
    }

    // Remove markdown code blocks if present
    let command = response.trim();
    command = command.replace(/^```[\w]*\n?/g, '');
    command = command.replace(/\n?```$/g, '');
    command = command.trim();

    // Remove any leading $ or > prompts
    command = command.replace(/^[\$>]\s*/, '');

    // Take first line if multiple lines
    command = command.split('\n')[0].trim();

    if (!command) {
      if (process.env.NODE_ENV === 'development') {
        console.error('LLM Service - No command found after parsing. Original response:', response);
      }
      throw new Error('No command found in LLM response');
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('LLM Service - Parsed command:', command);
    }

    return command;
  }
}

export default LLMService;

