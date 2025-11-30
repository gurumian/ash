/**
 * Agent Service - Implements ReAct pattern for complex multi-step tasks
 * 
 * Architecture:
 * 1. LLM generates commands freely (no tool registry constraints)
 * 2. Agent Loop - ReAct pattern: Think → Act → Observe → Think
 * 3. State Management - OS type, current directory, command history, results
 * 4. Safety - Dangerous command filtering
 */

import LLMService from './llm-service.js';

class AgentService {
  constructor(llmSettings, connection, terminal, osType = 'linux', onThoughtUpdate = null) {
    this.llmService = new LLMService(llmSettings);
    this.connection = connection;
    this.terminal = terminal;
    this.osType = osType; // 'linux', 'windows', 'darwin', etc.
    this.onThoughtUpdate = onThoughtUpdate; // Callback to update thought overlay
    
    // Agent state
    this.state = {
      osType: osType,
      currentDirectory: 'unknown',
      commandHistory: [],
      results: [],
      iteration: 0,
      maxIterations: 10
    };
    
    // Dangerous commands that should be blocked or require confirmation
    this.dangerousCommands = [
      'rm -rf /',
      'rm -rf /*',
      'format',
      'mkfs',
      'dd if=/dev/zero',
      'shutdown',
      'reboot',
      'halt',
      'poweroff',
      'del /f /s /q',
      'format c:'
    ];
  }
  
  /**
   * Detect OS type from connection
   */
  async detectOS() {
    try {
      const result = await this.connection.executeCommand('uname -s 2>/dev/null || echo Windows');
      const output = result.output?.toLowerCase() || '';
      
      if (output.includes('linux')) {
        return 'linux';
      } else if (output.includes('darwin') || output.includes('mac')) {
        return 'darwin';
      } else if (output.includes('windows') || output.includes('microsoft')) {
        return 'windows';
      } else if (output.includes('cygwin')) {
        return 'windows';
      }
      
      // Fallback: try Windows command
      try {
        await this.connection.executeCommand('ver');
        return 'windows';
      } catch {
        return 'linux'; // Default to linux
      }
    } catch (error) {
      console.warn('Failed to detect OS, defaulting to linux:', error);
      return 'linux';
    }
  }
  
  /**
   * Check if command is dangerous
   */
  isDangerousCommand(command) {
    const cmdLower = command.toLowerCase().trim();
    return this.dangerousCommands.some(dangerous => 
      cmdLower.includes(dangerous.toLowerCase())
    );
  }

  /**
   * Execute a command and capture output
   */
  async executeCommand(command) {
    if (!this.connection || !this.connection.isConnected) {
      throw new Error('Connection not available');
    }

    try {
      const result = await this.connection.executeCommand(command);
      
      // Update current directory if cd command
      if (command.trim().startsWith('cd ')) {
        const path = command.trim().substring(3).trim();
        this.state.currentDirectory = path;
      }
      
      return result;
    } catch (error) {
      throw new Error(`Command execution failed: ${error.message}`);
    }
  }

  /**
   * Write to terminal with formatting
   */
  writeToTerminal(text, color = '90') {
    if (this.terminal) {
      this.terminal.write(`\x1b[${color}m${text}\x1b[0m`);
    }
  }

  /**
   * Build agent messages for chat API with conversation history (ReAct mode)
   */
  buildAgentMessages(naturalLanguage, previousSteps = []) {
    // OS-specific guidance
    const osGuidance = {
      linux: 'Use Linux/Unix commands (ls, find, grep, cat, etc.)',
      windows: 'Use Windows commands (dir, findstr, type, etc.)',
      darwin: 'Use macOS/Unix commands (ls, find, grep, cat, etc.)'
    };

    const systemMessage = {
      role: 'user',
      content: `You are an AI agent that helps users accomplish complex tasks by breaking them down into steps.

Operating System: ${this.state.osType}
${osGuidance[this.state.osType] || osGuidance.linux}

You must follow the ReAct pattern:
1. **Thought**: Analyze what needs to be done in this step
2. **Command**: Generate the exact shell command to execute (for ${this.state.osType})

IMPORTANT RULES:
- Generate ONLY Thought and Command. Do NOT generate Observation - you will receive the actual result after execution.
- Generate commands appropriate for ${this.state.osType}
- Do NOT include shell prompt symbols ($, >, #) in commands - return only the command itself
- Use proper command syntax for the operating system
- Check current directory with 'pwd' (Linux/Mac) or 'cd' (Windows) if needed
- List files with 'ls' (Linux/Mac) or 'dir' (Windows) before operating on them
- Wait for the actual command result before deciding the next step
- If task is complete, respond with "TASK_COMPLETE" instead of a command
- Break complex tasks into smaller steps
- Use && to chain commands if needed (Linux/Mac) or & (Windows)

Current directory: ${this.state.currentDirectory}`
    };

    const messages = [systemMessage];

    // Add initial user request
    if (previousSteps.length === 0) {
      messages.push({
        role: 'user',
        content: `Task: ${naturalLanguage}\n\nStart by analyzing the task and executing the first step.`
      });
    } else {
      // Add conversation history
      previousSteps.forEach((step, i) => {
        messages.push({
          role: 'assistant',
          content: `Thought: ${step.thought}
Command: ${step.command}`
        });
        
        messages.push({
          role: 'user',
          content: `Command executed. Result:\n${step.result}\n\n${i === previousSteps.length - 1 ? 'Analyze the result and continue with the next step, or respond with TASK_COMPLETE if the task is done.' : 'Continue with the next step.'}`
        });
      });
    }

    return messages;
  }

  /**
   * Parse LLM response to extract thought and command
   */
  parseAgentResponse(response) {
    if (process.env.NODE_ENV === 'development') {
      console.log('AgentService - Parsing response:', response);
    }
    
    // Check if task is complete first
    if (response.includes('TASK_COMPLETE')) {
      const thoughtMatch = response.match(/Thought:\s*(.+?)(?:\n|$)/is);
      const thought = thoughtMatch ? thoughtMatch[1].trim() : 'Task completed';
      return { thought, command: null, isComplete: true };
    }
    
    // Extract Thought (stop at Command: or end)
    const thoughtMatch = response.match(/Thought:\s*(.+?)(?:\n\s*Command:|$)/is);
    // Extract Command (stop at Observation: or end, ignore Observation completely)
    const commandMatch = response.match(/Command:\s*(.+?)(?:\n\s*Observation:|$)/is);
    
    const thought = thoughtMatch ? thoughtMatch[1].trim() : '';
    let command = commandMatch ? commandMatch[1].trim() : '';
    
    // If no command found, try to extract from the response directly
    if (!command) {
      // Try to find command-like text after Thought
      const afterThought = response.split(/Thought:/i)[1];
      if (afterThought) {
        const possibleCommand = afterThought.split(/Command:/i)[1];
        if (possibleCommand) {
          command = possibleCommand.split(/Observation:/i)[0].trim();
        }
      }
    }
    
    // Remove markdown code blocks if present
    command = command.replace(/^```[\w]*\n?/g, '');
    command = command.replace(/\n?```$/g, '');
    command = command.replace(/^[\$>]\s*/, '').trim();
    
    // Remove any Observation text that might be in the command
    command = command.split(/Observation:/i)[0].trim();
    
    // Only mark as complete if explicitly TASK_COMPLETE or command is empty AND thought says task is done
    if (!command) {
      // If no command but thought suggests completion, check
      if (thought.toLowerCase().includes('complete') || 
          thought.toLowerCase().includes('done') ||
          thought.toLowerCase().includes('finished')) {
        return { thought, command: null, isComplete: true };
      }
      // Otherwise, it's an error - we need a command
      if (process.env.NODE_ENV === 'development') {
        console.warn('AgentService - No command found in response:', response);
      }
      throw new Error('No command found in LLM response. Please provide a Command.');
    }
    
    return { thought, command, isComplete: false };
  }

  /**
   * Main agent loop - ReAct pattern
   */
  async executeTask(naturalLanguage, onStep = null, onChunk = null) {
    // Initialize
    this.state.iteration = 0;
    this.state.commandHistory = [];
    this.state.results = [];
    
    // Detect OS type
    this.state.osType = await this.detectOS();
    
    // Get initial directory
    try {
      const pwdCommand = this.state.osType === 'windows' ? 'cd' : 'pwd';
      const pwdResult = await this.executeCommand(pwdCommand);
      this.state.currentDirectory = pwdResult.output || 'unknown';
    } catch (error) {
      console.warn('Failed to get current directory:', error);
    }
    
    const steps = [];
    
    while (this.state.iteration < this.state.maxIterations) {
      this.state.iteration++;
      
      // Build messages with conversation history
      const messages = this.buildAgentMessages(naturalLanguage, steps);
      
      // Display step header in terminal
      if (this.terminal) {
        this.writeToTerminal(`\r\n[Step ${this.state.iteration}/${this.state.maxIterations}] Thinking...\r\n`, '36');
      }
      
      // Call LLM with chat API (conversation history)
      let streamingText = '';
      let thoughtText = '';
      let isInThought = false;
      const response = await this.llmService.callLLM(
        messages,
        onChunk ? (chunk) => {
          streamingText += chunk;
          
          // Extract only Thought part from streaming (stop at Command:)
          if (!isInThought && chunk.includes('Thought:')) {
            isInThought = true;
            const thoughtStart = chunk.indexOf('Thought:') + 'Thought:'.length;
            thoughtText = chunk.substring(thoughtStart);
          } else if (isInThought) {
            if (chunk.includes('Command:')) {
              // Stop at Command:
              const commandStart = chunk.indexOf('Command:');
              thoughtText += chunk.substring(0, commandStart);
              isInThought = false;
            } else {
              thoughtText += chunk;
            }
          }
          
          // Update thought overlay (not terminal)
          if (this.onThoughtUpdate && thoughtText) {
            // Clean up thought text (remove "Thought:" prefix if present)
            let cleanThought = thoughtText.replace(/^Thought:\s*/i, '').trim();
            this.onThoughtUpdate(cleanThought, this.state.iteration, this.state.maxIterations);
          }
          
          if (onChunk) {
            onChunk(chunk);
          }
        } : null,
        true // useChat = true
      );
      
      // Clear thought overlay when done
      if (this.onThoughtUpdate) {
        this.onThoughtUpdate(null, this.state.iteration, this.state.maxIterations);
      }
      
      // Parse response
      const { thought, command, isComplete } = this.parseAgentResponse(response);
      
      // Check if task is complete
      if (isComplete || !command) {
        steps.push({
          thought: thought || 'Task completed',
          command: 'TASK_COMPLETE',
          result: 'Task completed successfully'
        });
        
        if (this.terminal) {
          this.writeToTerminal(`\r\n[Step ${this.state.iteration}] Task completed successfully\r\n`, '32');
        }
        break;
      }
      
      // Check for dangerous commands
      if (this.isDangerousCommand(command)) {
        const errorMsg = `Error: Dangerous command blocked: ${command}`;
        steps.push({
          thought,
          command,
          result: errorMsg
        });
        
        if (this.terminal) {
          this.writeToTerminal(`\r\n[Step ${this.state.iteration}] ${errorMsg}\r\n`, '31');
        }
        
        if (onStep) {
          onStep({
            iteration: this.state.iteration,
            thought,
            command,
            result: { error: 'Dangerous command blocked' }
          });
        }
        continue;
      }
      
      // Display parsed thought and action in terminal (final parsed values only)
      if (this.terminal) {
        this.writeToTerminal(`Thought: ${thought || '(no thought)'}\r\n`, '90');
        this.writeToTerminal(`Action: ${command}\r\n`, '32');
      }
      
      // Execute command
      let result;
      try {
        result = await this.executeCommand(command);
        
        const resultOutput = result.output || result.error || 'Command executed';
        
        steps.push({
          thought,
          command,
          result: resultOutput
        });
        
        // Display result in terminal
        if (this.terminal) {
          this.writeToTerminal(`Result: ${resultOutput}\r\n`, '33');
        }
        
        if (onStep) {
          onStep({
            iteration: this.state.iteration,
            thought,
            command,
            result
          });
        }
      } catch (error) {
        const errorMsg = `Error: ${error.message}`;
        steps.push({
          thought,
          command,
          result: errorMsg
        });
        
        if (this.terminal) {
          this.writeToTerminal(`Result: ${errorMsg}\r\n`, '31');
        }
        
        if (onStep) {
          onStep({
            iteration: this.state.iteration,
            thought,
            command,
            result: { error: error.message }
          });
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return {
      success: this.state.iteration < this.state.maxIterations,
      steps,
      finalResult: steps[steps.length - 1]?.result,
      osType: this.state.osType
    };
  }
}

export default AgentService;

