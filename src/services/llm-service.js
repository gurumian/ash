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
   * @returns {Promise<string>} - Generated command
   */
  async convertToCommand(naturalLanguage, context = {}, onChunk = null) {
    const prompt = this.buildPrompt(naturalLanguage, context);
    
    try {
      const response = await this.callLLM(prompt, onChunk);
      return this.parseResponse(response);
    } catch (error) {
      console.error('LLM Service error:', error);
      throw new Error(`Failed to convert to command: ${error.message}`);
    }
  }

  /**
   * Build prompt for LLM
   */
  buildPrompt(naturalLanguage, context) {
    const systemPrompt = `You are a helpful assistant that converts natural language requests into shell commands.
Rules:
1. Return ONLY the shell command, nothing else
2. Do not include explanations or comments
3. Use appropriate commands for the user's request
4. If the request is ambiguous, use the most common interpretation
5. For file operations, use relative paths when possible
6. Return a single command, or multiple commands separated by && if necessary

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
   * @returns {Promise<string>} - Full response
   */
  async callLLM(prompt, onChunk = null) {
    switch (this.provider) {
      case 'ollama':
        return await this.callOllama(prompt, onChunk);
      case 'openai':
        return await this.callOpenAI(prompt, onChunk);
      case 'anthropic':
        return await this.callAnthropic(prompt, onChunk);
      default:
        throw new Error(`Unsupported provider: ${this.provider}`);
    }
  }

  /**
   * Call Ollama API with streaming support
   */
  async callOllama(prompt, onChunk = null) {
    const url = `${this.baseURL}/api/generate`;
    
    // Use streaming if onChunk callback is provided
    if (onChunk) {
      const response = await fetch(url, {
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
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.response) {
                const text = data.response;
                fullResponse += text;
                onChunk(text);
              }
              if (data.done) {
                break;
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      return fullResponse;
    } else {
      // Non-streaming fallback
      const response = await fetch(url, {
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
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.response || data.text || '';
    }
  }

  /**
   * Call OpenAI API with streaming support
   */
  async callOpenAI(prompt, onChunk = null) {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    const url = `${this.baseURL}/chat/completions`;
    
    // Use streaming if onChunk callback is provided
    if (onChunk) {
      const response = await fetch(url, {
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
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim() && line.startsWith('data: '));

          for (const line of lines) {
            const data = line.replace(/^data: /, '');
            if (data === '[DONE]') break;

            try {
              const json = JSON.parse(data);
              const delta = json.choices[0]?.delta?.content;
              if (delta) {
                fullResponse += delta;
                onChunk(delta);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      return fullResponse;
    } else {
      // Non-streaming fallback
      const response = await fetch(url, {
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
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || '';
    }
  }

  /**
   * Call Anthropic API with streaming support
   */
  async callAnthropic(prompt, onChunk = null) {
    if (!this.apiKey) {
      throw new Error('Anthropic API key is required');
    }

    const url = `${this.baseURL}/messages`;
    
    // Use streaming if onChunk callback is provided
    if (onChunk) {
      const response = await fetch(url, {
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
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim() && line.startsWith('data: '));

          for (const line of lines) {
            const data = line.replace(/^data: /, '');
            if (data === '[DONE]') break;

            try {
              const json = JSON.parse(data);
              if (json.type === 'content_block_delta' && json.delta?.text) {
                const text = json.delta.text;
                fullResponse += text;
                onChunk(text);
              } else if (json.type === 'message_stop') {
                break;
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      return fullResponse;
    } else {
      // Non-streaming fallback
      const response = await fetch(url, {
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
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.content[0]?.text || '';
    }
  }

  /**
   * Parse LLM response to extract command
   */
  parseResponse(response) {
    if (!response) {
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
      throw new Error('No command found in LLM response');
    }

    return command;
  }
}

export default LLMService;

