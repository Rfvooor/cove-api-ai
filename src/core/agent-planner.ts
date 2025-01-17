import { BaseLanguageModel, PromptInput } from './base-language-model.js';
import { Task } from './task.js';
import { Tool } from './tool.js';

export class AgentPlanner {
  private readonly languageModel: BaseLanguageModel;
  private readonly maxSteps: number = 3;

  constructor(languageModel: BaseLanguageModel) {
    this.languageModel = languageModel;
  }

  async generatePlan(task: Task, tools: Tool[]): Promise<string[]> {
    const taskJson = task.toJSON();
    const promptInput: PromptInput = {
      text: `# Task Planning System

## Context
- Type: Execution Plan Generation
- Max Steps: ${this.maxSteps}
- Format: Markdown with Regex-Parseable Sections

## Task Information
- Name: ${taskJson.name}
- Description: ${taskJson.input.description || 'No description provided'}

## Available Tools
${tools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

## Requirements
### Step Format
\`\`\`
[Action] using [Tool] with {parameters}
\`\`\`

### Step Criteria
- Must use specific tool
- Must have clear success criteria
- Must be self-contained
- Must be executable

### Focus Areas
- Essential actions only
- Direct tool usage
- Clear validation

## Example Plan
\`\`\`
Analyze text using TextTool with {mode: "summary"}
Extract data using DataTool with {format: "json"}
\`\`\`

## Response Format
Your response must contain these sections:

### Execution Plan
[PLAN]
Step-by-step execution plan here
[/PLAN]

### Tool Validation
[VALIDATION]
- Tools required: [list tools]
- Parameters verified: [yes/no]
- Dependencies checked: [yes/no]
[/VALIDATION]

### Error Handling
[ERROR_HANDLING]
- Potential failures identified
- Recovery steps outlined
[/ERROR_HANDLING]

Provide your response below:
`
    };

    try {
      const response = await this.languageModel.generateText(promptInput);
      const steps = response.text
        .split('\n')
        .map(step => step.trim())
        .filter(step => step.length > 0 && !step.startsWith('#') && !step.startsWith('Step'));

      // Validate step count
      if (steps.length === 0) {
        throw new Error('No valid steps generated');
      }
      if (steps.length > this.maxSteps) {
        return steps.slice(0, this.maxSteps);
      }

      // Validate each step has required format
      const validSteps = steps.filter(step => {
        const hasToolReference = tools.some(tool => step.includes(tool.name));
        const hasParameters = step.includes('with {') && step.includes('}');
        return hasToolReference && hasParameters;
      });

      if (validSteps.length === 0) {
        throw new Error('No valid steps after format validation');
      }

      return validSteps;
    } catch (error) {
      console.error('Error generating plan:', error);
      // Return a minimal fallback plan
      return [`Execute task using ${tools[0]?.name || 'available tool'} with {}`];
    }
  }

  async validatePlan(steps: string[], tools: Tool[]): Promise<boolean> {
    // Validate step count
    if (steps.length === 0 || steps.length > this.maxSteps) {
      return false;
    }

    // Validate each step format and tool references
    for (const step of steps) {
      const hasValidTool = tools.some(tool => step.includes(tool.name));
      const hasValidFormat = step.includes('using') && step.includes('with {') && step.includes('}');
      if (!hasValidTool || !hasValidFormat) {
        return false;
      }
    }

    return true;
  }

  async optimizePlan(steps: string[]): Promise<string[]> {
    // If plan is already optimal length, return as is
    if (steps.length <= this.maxSteps) {
      return steps;
    }

    const promptInput: PromptInput = {
      text: `# Plan Optimization

## Original Plan
\`\`\`
${steps.join('\n')}
\`\`\`

## Optimization Requirements
- Maximum Steps: ${this.maxSteps}
- Must maintain core functionality
- Must preserve format: "[Action] using [Tool] with {parameters}"

## Response Format
Your response must contain these sections:

### Optimized Plan
[PLAN]
Your optimized steps here
[/PLAN]

### Changes Summary
[CHANGES]
- Steps removed: [number]
- Steps combined: [number]
- Functionality preserved: [yes/no]
[/CHANGES]

### Validation
[VALIDATION]
- Format maintained: [yes/no]
- Tools verified: [yes/no]
- Dependencies checked: [yes/no]
[/VALIDATION]

Provide your optimized plan below:
`
    };

    try {
      const response = await this.languageModel.generateText(promptInput);
      
      // Extract plan section using regex
      const planMatch = response.text.match(/\[PLAN\]([\s\S]*?)\[\/PLAN\]/);
      if (!planMatch) {
        console.warn('No plan section found in response');
        return steps.slice(0, this.maxSteps);
      }

      // Extract changes summary
      const changesMatch = response.text.match(/\[CHANGES\]([\s\S]*?)\[\/CHANGES\]/);
      if (changesMatch && changesMatch[1].includes('Functionality preserved: no')) {
        console.warn('Optimization may have compromised functionality');
      }

      // Extract validation section
      const validationMatch = response.text.match(/\[VALIDATION\]([\s\S]*?)\[\/VALIDATION\]/);
      const validationPassed = validationMatch &&
        validationMatch[1].includes('Format maintained: yes') &&
        validationMatch[1].includes('Tools verified: yes');

      if (!validationPassed) {
        console.warn('Plan validation warnings detected');
      }

      // Parse and validate optimized steps
      const optimizedSteps = planMatch[1]
        .split('\n')
        .map(step => step.trim())
        .filter(step => {
          if (step.length === 0 || step.startsWith('#')) return false;
          
          // Validate step format using regex
          const stepPattern = /^[A-Z][a-zA-Z0-9\s]+ using [A-Za-z]+ with \{.*\}$/;
          return stepPattern.test(step);
        });

      return optimizedSteps.slice(0, this.maxSteps);
    } catch (error) {
      console.error('Error optimizing plan:', error);
      return steps.slice(0, this.maxSteps);
    }
  }
}