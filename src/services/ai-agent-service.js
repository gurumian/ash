/**
 * AI Agent Service - Intelligent system diagnosis agent
 * Plans, executes, analyzes, and replans based on goals
 */

import LLMService from './llm-service';
import { executeCommandAndWait } from '../utils/command-executor';

class AIAgentService {
  constructor(llmSettings, sshConnection, outputCapture) {
    this.llmService = new LLMService({
      ...llmSettings,
      temperature: llmSettings.temperature || 0.3, // Lower temperature for consistency
      maxTokens: Math.max(llmSettings.maxTokens || 4000, 4000) // Ensure enough tokens for complete JSON
    });
    this.sshConnection = sshConnection;
    this.outputCapture = outputCapture;
    this.maxIterations = 20;
    this.commandTimeout = 10000; // 10 seconds
  }

  /**
   * Detect if goal requires full agent mode or quick command mode
   * @param {string} goal - User's goal
   * @returns {Promise<'quick'|'agent'>} Mode to use
   */
  async detectMode(goal) {
    const quickKeywords = ['list', 'show', 'find', 'count', 'display', 'print', 'cat', 'ls', 'grep', 'search'];
    const agentKeywords = ['diagnose', 'check', 'analyze', 'investigate', 'troubleshoot', 'status', 'health', 'monitor', 'report'];
    
    const lowerGoal = goal.toLowerCase();
    
    // Check for agent keywords
    if (agentKeywords.some(keyword => lowerGoal.includes(keyword))) {
      return 'agent';
    }
    
    // Check for quick keywords
    if (quickKeywords.some(keyword => lowerGoal.includes(keyword)) && 
        !agentKeywords.some(keyword => lowerGoal.includes(keyword))) {
      return 'quick';
    }
    
    // Default to agent mode for safety (more capable)
    return 'agent';
  }

  /**
   * Quick command mode - simple command conversion and execution
   * @param {string} naturalLanguage - Natural language input
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<string>} Executed command
   */
  async quickCommand(naturalLanguage, onProgress = null) {
    try {
      if (onProgress) {
        onProgress({
          phase: 'generating',
          message: 'Generating command...',
          step: null,
          history: []
        });
      }

      // Use LLM to convert natural language to command
      const context = {
        currentDirectory: 'unknown'
      };

      const command = await this.llmService.convertToCommand(naturalLanguage, context);

      if (onProgress) {
        onProgress({
          phase: 'executing',
          message: `Executing: ${command}`,
          step: { step: 1, command, purpose: naturalLanguage },
          history: []
        });
      }

      // Execute command
      const result = await this.executeCommand(command);

      if (onProgress) {
        onProgress({
          phase: 'complete',
          message: 'Command executed',
          step: null,
          history: [{ command, output: result.output, error: result.error }]
        });
      }

      return command;
    } catch (error) {
      console.error('Quick command error:', error);
      throw error;
    }
  }

  /**
   * Main diagnosis method - plans, executes, analyzes, and replans
   * @param {string} goal - User's goal (e.g., "Diagnose router status")
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} Final diagnosis report
   */
  async diagnose(goal, onProgress = null) {
    const executionHistory = [];
    let plan = null;
    let iteration = 0;
    let isComplete = false;

    try {
      // Step 1: Create initial plan
      if (onProgress) {
        onProgress({
          phase: 'planning',
          message: 'Creating plan...',
          step: null,
          history: []
        });
      }

      plan = await this.createPlan(goal, executionHistory);
      
      if (onProgress) {
        onProgress({
          phase: 'executing',
          message: `Plan created: ${plan.steps.length} steps`,
          step: null,
          history: executionHistory,
          plan: plan
        });
      }

      // Step 2: Execute plan with replanning
      while (iteration < this.maxIterations && !isComplete) {
        for (let i = 0; i < plan.steps.length; i++) {
          const step = plan.steps[i];
          
          if (onProgress) {
            onProgress({
              phase: 'executing',
              message: `Step ${step.step}/${plan.steps.length}: ${step.purpose}`,
              step: step,
              history: executionHistory,
              plan: plan
            });
          }

          // Execute command
          const result = await this.executeCommand(step.command);
          
          const executionResult = {
            step: step,
            command: step.command,
            output: result.output,
            error: result.error,
            timestamp: Date.now()
          };
          
          executionHistory.push(executionResult);

          if (onProgress) {
            onProgress({
              phase: 'analyzing',
              message: 'Analyzing results...',
              step: step,
              history: executionHistory,
              plan: plan
            });
          }

          // Analyze result
          const analysis = await this.analyzeResult(
            executionResult,
            goal,
            executionHistory
          );

          // Check if replanning is needed
          if (analysis.needsReplan) {
            if (onProgress) {
              onProgress({
                phase: 'replanning',
                message: `Replanning: ${analysis.reason}`,
                step: step,
                history: executionHistory,
                plan: plan
              });
            }

            plan = await this.replan(goal, executionHistory, analysis.reason);
            break; // Break from step loop, restart with new plan
          }

          // Check if complete
          if (analysis.complete) {
            isComplete = true;
            break;
          }
        }

        iteration++;
        
        // If we've gone through all steps without replanning, we're done
        if (!analysis?.needsReplan && !isComplete) {
          isComplete = true;
        }
      }

      // Step 3: Generate final report
      if (onProgress) {
        onProgress({
          phase: 'reporting',
          message: 'Generating final diagnosis report...',
          step: null,
          history: executionHistory,
          plan: plan
        });
      }

      const report = await this.generateReport(goal, executionHistory);

      if (onProgress) {
        onProgress({
          phase: 'complete',
          message: 'Diagnosis complete',
          step: null,
          history: executionHistory,
          plan: plan,
          report: report
        });
      }

      return report;

    } catch (error) {
      console.error('Agent diagnosis error:', error);
      throw error;
    }
  }

  /**
   * Create initial plan from goal
   */
  async createPlan(goal, history = []) {
    const prompt = this.buildPlanningPrompt(goal, history);
    
    try {
      const response = await this.llmService.callLLM(prompt);
      const plan = this.parsePlan(response);
      
      if (!plan || !plan.steps || plan.steps.length === 0) {
        throw new Error('Failed to create valid plan');
      }
      
      return plan;
    } catch (error) {
      console.error('Plan creation error:', error);
      // Fallback to simple plan - start with OS detection
      return {
        steps: [
          {
            step: 1,
            command: 'uname -a || cat /etc/os-release || echo "OS detection failed"',
            purpose: 'Detect operating system type'
          },
          {
            step: 2,
            command: 'ip addr show || ifconfig || echo "Network command not available"',
            purpose: 'Check network interfaces'
          }
        ]
      };
    }
  }

  /**
   * Replan based on new information
   */
  async replan(goal, history, reason) {
    const prompt = this.buildReplanPrompt(goal, history, reason);
    
    try {
      const response = await this.llmService.callLLM(prompt);
      const plan = this.parsePlan(response);
      
      if (!plan || !plan.steps || plan.steps.length === 0) {
        throw new Error('Failed to create valid replan');
      }
      
      return plan;
    } catch (error) {
      console.error('Replan error:', error);
      // Return minimal plan to continue
      return {
        steps: [
          {
            step: history.length + 1,
            command: 'echo "Additional investigation needed"',
            purpose: 'Additional investigation'
          }
        ]
      };
    }
  }

  /**
   * Execute command and capture output
   */
  async executeCommand(command) {
    return await executeCommandAndWait(
      this.sshConnection,
      command,
      this.outputCapture,
      this.commandTimeout
    );
  }

  /**
   * Analyze execution result
   */
  async analyzeResult(result, goal, history) {
    const prompt = this.buildAnalysisPrompt(result, goal, history);
    
    try {
      const response = await this.llmService.callLLM(prompt);
      return this.parseAnalysis(response);
    } catch (error) {
      console.error('Analysis error:', error);
      // Default: continue unless error
      return {
        needsReplan: !!result.error,
        reason: result.error || 'Unknown issue',
        complete: false
      };
    }
  }

  /**
   * Generate final diagnosis report
   */
  async generateReport(goal, history) {
    const prompt = this.buildReportPrompt(goal, history);
    
    try {
      const response = await this.llmService.callLLM(prompt);
      return {
        goal: goal,
        summary: this.parseReport(response),
        history: history,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Report generation error:', error);
      return {
        goal: goal,
        summary: 'Diagnosis completed. Please refer to execution history for details.',
        history: history,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Build planning prompt
   */
  buildPlanningPrompt(goal, history) {
    // Extract OS type from history if available
    let osContext = '';
    if (history && history.length > 0) {
      const lastOutput = history[history.length - 1]?.output || '';
      if (lastOutput.includes('Linux') || lastOutput.includes('GNU') || lastOutput.includes('/bin/bash') || lastOutput.includes('/bin/sh')) {
        osContext = 'The system appears to be Linux/Unix. Use Linux commands like: uname -a, cat /etc/os-release, ip addr, ps, systemctl, etc.';
      } else if (lastOutput.includes('Cisco') || lastOutput.includes('IOS') || lastOutput.match(/Router|Switch/i)) {
        osContext = 'The system appears to be Cisco IOS. Use Cisco commands like: show version, show running-config, show ip interface brief, etc.';
      } else if (lastOutput.includes('Windows') || lastOutput.includes('Microsoft')) {
        osContext = 'The system appears to be Windows. Use Windows commands like: systeminfo, ipconfig, netstat, etc.';
      }
    }

    const systemPrompt = `You are a system diagnosis expert. Create a step-by-step plan to achieve the user's goal.

IMPORTANT - OS Detection:
1. FIRST, determine the operating system type (Linux/Unix, Cisco IOS, Windows, etc.)
2. Use commands appropriate for the detected OS:
   - Linux/Unix: uname -a, cat /etc/os-release, ip addr, ps aux, systemctl status, etc.
   - Cisco IOS: show version, show running-config, show ip interface brief, show ip route, etc.
   - Windows: systeminfo, ipconfig, netstat, tasklist, etc.
3. NEVER use "show version" on Linux - use "uname -a" or "cat /etc/os-release" instead
4. NEVER use Linux commands on Cisco IOS devices

${osContext ? `Context from previous commands: ${osContext}` : 'No previous context available. Start with OS detection command.'}

CRITICAL - JSON Format Requirements:
1. You MUST return COMPLETE, valid JSON
2. Do NOT truncate or cut off the JSON response
3. Ensure all strings are properly quoted and escaped
4. Ensure all arrays and objects are properly closed
5. Return ONLY the JSON object, no additional text before or after

Goal: ${goal}

Return a COMPLETE JSON object in this exact format (do not truncate):
{
  "steps": [
    {
      "step": 1,
      "command": "command to execute",
      "purpose": "purpose of this step"
    }
  ]
}`;

    return {
      system: systemPrompt,
      user: `Create a plan to achieve the goal: "${goal}". Return ONLY valid, complete JSON.`
    };
  }

  /**
   * Build replanning prompt
   */
  buildReplanPrompt(goal, history, reason) {
    const recentHistory = history.slice(-5); // Last 5 executions
    const historyText = recentHistory.map(h => 
      `Command: ${h.command}\nOutput: ${h.output?.substring(0, 500)}`
    ).join('\n\n');

    // Detect OS from history
    let osContext = '';
    const allOutput = recentHistory.map(h => h.output || '').join(' ');
    if (allOutput.includes('Linux') || allOutput.includes('GNU') || allOutput.includes('/bin/bash') || allOutput.includes('/bin/sh')) {
      osContext = 'The system is Linux/Unix. Use Linux commands: uname -a, cat /etc/os-release, ip addr, ps, systemctl, etc.';
    } else if (allOutput.includes('Cisco') || allOutput.includes('IOS') || allOutput.match(/Router|Switch/i)) {
      osContext = 'The system is Cisco IOS. Use Cisco commands: show version, show running-config, show ip interface brief, etc.';
    } else if (allOutput.includes('Windows') || allOutput.includes('Microsoft')) {
      osContext = 'The system is Windows. Use Windows commands: systeminfo, ipconfig, netstat, etc.';
    } else {
      osContext = 'OS type unclear. Use OS detection commands first (uname -a for Linux, show version for Cisco, systeminfo for Windows).';
    }

    const systemPrompt = `You are a system diagnosis expert. An unexpected situation has occurred, so you need to create a new plan.

IMPORTANT - Use correct commands for the OS:
${osContext}

Original goal: ${goal}
Situation that occurred: ${reason}

Recent execution history:
${historyText}

Create a new plan in JSON format to address this situation. Use commands appropriate for the detected OS:
{
  "steps": [
    {
      "step": ${history.length + 1},
      "command": "command to execute",
      "purpose": "purpose of this step"
    }
  ]
}`;

    return {
      system: systemPrompt,
      user: `Create a new plan.`
    };
  }

  /**
   * Build analysis prompt
   */
  buildAnalysisPrompt(result, goal, history) {
    // Detect OS from command and output
    let osContext = '';
    const command = result.command || '';
    const output = result.output || '';
    
    if (command.includes('show ') || output.includes('Cisco') || output.includes('IOS')) {
      osContext = 'This appears to be a Cisco IOS device.';
    } else if (command.includes('uname') || command.includes('cat /etc') || output.includes('Linux') || output.includes('GNU')) {
      osContext = 'This appears to be a Linux/Unix system.';
    } else if (command.includes('systeminfo') || command.includes('ipconfig') || output.includes('Windows')) {
      osContext = 'This appears to be a Windows system.';
    }

    const systemPrompt = `You are a system diagnosis expert. Analyze the command execution result and decide the next step.

${osContext ? `OS Context: ${osContext}` : ''}

Goal: ${goal}

Command executed: ${result.command}
Command output: ${result.output?.substring(0, 1000)}
Error: ${result.error || 'none'}

IMPORTANT: If the command failed or returned unexpected output, consider:
- Was the command appropriate for the OS type? (e.g., "show version" only works on Cisco IOS, not Linux)
- Should we use a different command for this OS?
- Do we need to detect the OS first?

Analyze the following:
1. Does the result match expectations?
2. Are there any problems or anomalies?
3. Was the command appropriate for the detected OS?
4. Is additional investigation needed?
5. Has the goal been achieved?

Respond in JSON format:
{
  "needsReplan": true/false,
  "reason": "reason for replanning (if needed)",
  "complete": true/false,
  "analysis": "result analysis"
}`;

    return {
      system: systemPrompt,
      user: `Analyze the command execution result.`
    };
  }

  /**
   * Build report prompt
   */
  buildReportPrompt(goal, history) {
    const historySummary = history.map(h => 
      `- ${h.command}: ${h.output?.substring(0, 200)}`
    ).join('\n');

    const systemPrompt = `You are a system diagnosis expert. Write a final diagnosis report based on all collected information.

Goal: ${goal}

Execution history:
${historySummary}

Write a comprehensive diagnosis report including:
1. Goal achievement status
2. Key findings
3. Issues (if any)
4. Recommended actions

Write in detail using natural language.`;

    return {
      system: systemPrompt,
      user: `Write the final diagnosis report.`
    };
  }

  /**
   * Parse plan from LLM response
   */
  parsePlan(response) {
    try {
      // Try to extract JSON from response
      let jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        let jsonStr = jsonMatch[0];
        
        // Try to fix incomplete JSON (common when LLM response is cut off)
        // If JSON is incomplete, try to close it properly
        if (!this.isValidJSON(jsonStr)) {
          // Try to fix incomplete array or object
          jsonStr = this.fixIncompleteJSON(jsonStr);
        }
        
        try {
          return JSON.parse(jsonStr);
        } catch (parseError) {
          // If still fails, try to extract partial plan
          return this.extractPartialPlan(jsonStr);
        }
      }
      
      // If no JSON found, try parsing entire response
      return JSON.parse(response);
    } catch (error) {
      console.error('Failed to parse plan:', error);
      console.log('Response:', response.substring(0, 500));
      return null;
    }
  }

  /**
   * Check if JSON string is valid
   */
  isValidJSON(str) {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Try to fix incomplete JSON
   */
  fixIncompleteJSON(jsonStr) {
    // Count braces and brackets to see what's missing
    const openBraces = (jsonStr.match(/\{/g) || []).length;
    const closeBraces = (jsonStr.match(/\}/g) || []).length;
    const openBrackets = (jsonStr.match(/\[/g) || []).length;
    const closeBrackets = (jsonStr.match(/\]/g) || []).length;
    
    let fixed = jsonStr;
    
    // Close incomplete arrays
    if (openBrackets > closeBrackets) {
      fixed += ']'.repeat(openBrackets - closeBrackets);
    }
    
    // Close incomplete objects
    if (openBraces > closeBraces) {
      fixed += '}'.repeat(openBraces - closeBraces);
    }
    
    // If still in a string, try to close it
    if (fixed.match(/"[^"]*$/)) {
      fixed += '"';
    }
    
    return fixed;
  }

  /**
   * Extract partial plan from incomplete JSON
   */
  extractPartialPlan(jsonStr) {
    try {
      // Try to find steps array even if incomplete
      const stepsMatch = jsonStr.match(/"steps"\s*:\s*\[([\s\S]*?)(?:\]|$)/);
      if (stepsMatch) {
        const stepsContent = stepsMatch[1];
        // Use regex with global flag and manual iteration for better compatibility
        const stepRegex = /\{\s*"step"\s*:\s*(\d+)\s*,\s*"command"\s*:\s*"([^"]*)"\s*,\s*"purpose"\s*:\s*"([^"]*)"\s*\}/g;
        
        const steps = [];
        let match;
        while ((match = stepRegex.exec(stepsContent)) !== null) {
          steps.push({
            step: parseInt(match[1]),
            command: match[2],
            purpose: match[3]
          });
        }
        
        if (steps.length > 0) {
          return { steps };
        }
      }
    } catch (error) {
      console.error('Failed to extract partial plan:', error);
    }
    
    return null;
  }

  /**
   * Parse analysis from LLM response
   */
  parseAnalysis(response) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          needsReplan: parsed.needsReplan || false,
          reason: parsed.reason || '',
          complete: parsed.complete || false,
          analysis: parsed.analysis || ''
        };
      }
      // Fallback: try to infer from text
      const lowerResponse = response.toLowerCase();
      return {
        needsReplan: lowerResponse.includes('replan') || lowerResponse.includes('re-plan'),
        reason: response.substring(0, 200),
        complete: lowerResponse.includes('complete') || lowerResponse.includes('done'),
        analysis: response
      };
    } catch (error) {
      console.error('Failed to parse analysis:', error);
      return {
        needsReplan: false,
        reason: '',
        complete: false,
        analysis: response
      };
    }
  }

  /**
   * Parse report from LLM response
   */
  parseReport(response) {
    // Report is just text, return as is
    return response.trim();
  }
}

export default AIAgentService;

