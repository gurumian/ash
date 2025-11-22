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
   */
  async convertToCommand(naturalLanguage, context = {}) {
    const prompt = this.buildPrompt(naturalLanguage, context);
    
    try {
      const response = await this.callLLM(prompt);
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
   */
  async callLLM(prompt) {
    switch (this.provider) {
      case 'ollama':
        return await this.callOllama(prompt);
      case 'openai':
        return await this.callOpenAI(prompt);
      case 'anthropic':
        return await this.callAnthropic(prompt);
      default:
        throw new Error(`Unsupported provider: ${this.provider}`);
    }
  }

  /**
   * Call Ollama API
   */
  async callOllama(prompt) {
    const url = `${this.baseURL}/api/generate`;
    
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

  /**
   * Call OpenAI API
   */
  async callOpenAI(prompt) {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    const url = `${this.baseURL}/chat/completions`;
    
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

  /**
   * Call Anthropic API
   */
  async callAnthropic(prompt) {
    if (!this.apiKey) {
      throw new Error('Anthropic API key is required');
    }

    const url = `${this.baseURL}/messages`;
    
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

