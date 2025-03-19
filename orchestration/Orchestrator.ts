import { EventEmitter } from 'events';
import { TaskGraph, Task } from './TaskGraph';
import { WebAgent } from './WebAgent';
import * as fs from 'fs';
import { PromptGenerator } from './PromptGeneration';
import {OpenAI} from 'openai';

const SAMPLE_OUTPUT_FILEPATH = './orchestration/prompts/sample_output.json';
const ORCHESTRATOR_PROMPT_FILEPATH = './orchestration/prompts/prompt2graph.txt';

export enum OrchestrationStatus {
    AwaitingPrompt,
    ConvertingPromptToTaskGraph,
    RunningWebAgents,
    CuratingFinalAnswer,
    Done,
    Error
}

export class TaskOrchestrator extends EventEmitter {
    private taskGraph: TaskGraph = new TaskGraph();
    private promptGenerator: PromptGenerator = new PromptGenerator();
    private webAgent: WebAgent = new WebAgent(true);
    private globalContext: Record<string, any> = {};
    private actionsPerformed: Record<string, any>[] = [];
    private taskToWebContext: Map<string, string> = new Map<string, string>();
    private runningTasks: Set<string> = new Set<string>();
    private maxConcurrentTasks;
    private totalValidationAttempts = 5;
    private status: OrchestrationStatus;
    private finalResponse : string | undefined = undefined;
    private openai: OpenAI;

    constructor(maxConcurrentTasks: number = 5) {
        super();
        this.maxConcurrentTasks = maxConcurrentTasks;
        this.status = OrchestrationStatus.AwaitingPrompt;

        const processApiKey = process.env.OPENAI_API_KEY;
        if (!processApiKey)
            throw new Error(`Missing OPENAI_API_KEY`);
        this.openai = new OpenAI({
            apiKey: processApiKey,
        });
    }

    taskGraphPopulated() {
        return this.taskGraph.getAllTasksCount() > 0;
    }

    private validateJSON(rawLLMOutput: string): Record<string, any> | undefined {
        try {
            const parsed = JSON.parse(rawLLMOutput);
            if (typeof parsed === "object" && parsed !== null) {
                return parsed;
            }
        } catch (error) {
            // Invalid JSON, return undefined
        }
        return undefined;

    }

    private delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async parsePromptToGraph(prompt: string) {
        let promptToGraphAttempts = 0;
        this.status = OrchestrationStatus.ConvertingPromptToTaskGraph;
        let JsonLlmOutput;
        let rawLLMOutput;

        while (promptToGraphAttempts < 5) {
            const chatResponse = await this.openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: `
# Task Graph Generation System

You are an expert system for breaking down complex user requests into a directed graph of executable subtasks. Your role is to analyze the user's prompt and create a structured task graph that specifies both sequential dependencies and parallel execution opportunities.

## Your Task

Given a user's request, create a detailed task graph where:

1. Each task has clear dependencies (what must complete before this task starts)
2. Each task specifies browser session requirements
3. Each task includes detailed instructions for automation
4. Each task defines its data inputs and outputs

Please only output a valid JSON and no other content. 

## Output Format

Provide your response as a JSON object with the following structure:

json
{
  "taskGraph": {
    "rootTask": "The overall high-level task description",
    "tasks": [
      {
        "id": "unique-task-id",
        "name": "Short descriptive name",
        "description": "Detailed description with specific instructions for automation",
        "dependencies": ["id-of-dependency-1", "id-of-dependency-2"],
        "sessionRequirements": {
          "requiresNewSession": true/false,
          "continuesSessionFrom": "id-of-task-to-continue-session-from",
          "providesSessionTo": "id-of-task-to-provide-session-to"
        },
        "dataRequirements": {
          "inputs": {
            "requiredData": ["key1", "key2"],
          },
          "outputs": {
            "produces": ["output-key1", "output-key2"]
          }
        }
      }
    ]
  }
}

## Important Considerations

### For Tasks
- Create tasks as low level as possible.
- If data needs to be gathered for multiple entities, create a task for each ensuring the tasks run in parallel (as much as possible)

### For Task Dependencies
- Analyze which tasks truly depend on others
- Maximize opportunities for parallel execution

### For Browser Sessions
- Determine when a fresh browser session is needed
- Track which tasks should continue an existing session
- Having parallel tasks takes precedence over using existing session

### For Data Flow
- Identify what data each task requires from previous tasks
- Specify what data each task produces for downstream tasks
- Use clear, consistent naming conventions for data keys

## Mandatory Requirements
1. **Entity Separation:** ALWAYS create separate tasks for EACH entity (restaurant/product/website) even if they use identical steps
2. **Atomic Tasks:** Each task must handle ONLY ONE entity/action
3. **Parallelization:** Maximize parallel execution by isolating entity-specific tasks
4. **Explicit Outputs:** Each entity task must produce UNIQUE output keys (e.g., "<entity>-rating")
5. Only Google search engine may be used. No other services like Yelp, Best Buy should be used. 

## Output Format
Use JSON with:
- Separate task for each entity search/scrape
- Unique data keys per entity
- Parallelizable structure for entity tasks

## Critical Instructions
- NEVER combine multiple entities into single tasks
- Treat identical operations on different entities as SEPARATE tasks
- Use entity-specific identifiers in all data keys
- Create comparison/analysis tasks ONLY after all entity data is collected

## Your Process

1. First, understand the overall goal
2. Break down into logical subtasks
3. Analyze dependencies between tasks
4. Determine session requirements
5. Specify data inputs/outputs
6. Add detailed automation instructions
7. Analyze execution flow

Be comprehensive yet precise. Each task should be detailed enough that an automation system could execute it without further clarification. 

### Prompt
Equipped with this context, here is prompt to generate the data for:` },
                    { role: "user", content: prompt },
                ],
            });
            const messageContent = chatResponse.choices[0]?.message?.content;
            if (!messageContent) {
                throw new Error("Received empty response from OpenAI");
            }
            rawLLMOutput = messageContent.trim();
            console.log("Graph Creation Attempt", rawLLMOutput);
            JsonLlmOutput = this.validateJSON(rawLLMOutput);
            if (JsonLlmOutput)
                break
            promptToGraphAttempts++;
        }

        if (!JsonLlmOutput) {
            this.status = OrchestrationStatus.Error;
            throw new Error("Couldn't create a valid dependency graph");
        }
        console.log('Orchestrator JSON Output', JsonLlmOutput);
        if (!JsonLlmOutput) {
            this.emit('error', "Failed to generate a valid JSON from prompt");
        } else {
            this.taskGraph.parseJSON(JsonLlmOutput);
            this.emit('taskGraphCreated', this.taskGraph);
            this.execute();
        }
    }

    parsedGlobalContextToAnswer(): string {
        this.status = OrchestrationStatus.CuratingFinalAnswer;
        // Utilize the prompt + LLM Output + Task Graph to deliver an answer
        
        return "";
    }

    async execute(): Promise<Record<string, any>> {
        this.status = OrchestrationStatus.RunningWebAgents;

        const rootTasks = this.taskGraph.getRootTasks();
        for (const task of rootTasks) {
            this.safeScheduleTask(task);
        }

        return new Promise((resolve, reject) => {
            this.on('allTasksCompleted', () => {
                resolve(this.globalContext);
            });
            this.on('error', (error) => {
                reject(error);
            });
        });
    }

    getStatus(): OrchestrationStatus {
        return this.status;
    }

    getAllTasks() {
        return this.taskGraph.getAllTasks();
    }

    private async scheduleTask(task: Task) {
        if (this.runningTasks.size >= this.maxConcurrentTasks) {
            this.once('taskCompleted', () => this.safeScheduleTask(task));
            return;
        }

        try {
            task.status = 'running';
            this.runningTasks.add(task.id);
            this.emit('taskStarted', task);

            let webContextId;
            if (task.sessionRequirements.requiresNewSession) {
                webContextId = await this.webAgent.createBrowserContext();
                this.taskToWebContext.set(task.id, webContextId);
            } else {
                webContextId = this.taskToWebContext.get(task.id);
            }

            this.maxConcurrentTasks++;
            await this.webAgent.execute(task, this.globalContext, this.actionsPerformed, webContextId);
            this.maxConcurrentTasks--;

            task.status = 'completed';
            this.taskGraph.addCompletedTask(task.id);
            this.runningTasks.delete(task.id);
            this.emit('taskCompleted', task);

            const webSessionId = this.taskToWebContext.get(task.id);
            if (webSessionId) {
                if (task.sessionRequirements.providesSessionTo) {
                    const outgoingNode = task.sessionRequirements.providesSessionTo;
                    this.taskToWebContext.set(outgoingNode, webSessionId);
                } else {
                    await this.webAgent.destroyBrowserContext(webSessionId);
                    this.taskToWebContext.delete(task.id);
                }
            }
            this.scheduleReadyTasks();
            this.checkAllTasksCompleted();
        } catch (error) {
            task.status = 'failed';
            this.runningTasks.delete(task.id);
            throw error;
        }
    }

    private scheduleReadyTasks(): void {
        const readyTasks = this.taskGraph.getTasksReadyToRun(this.globalContext);
        for (const task of readyTasks) {
            this.safeScheduleTask(task);
        }
    }

    private safeScheduleTask(task: Task) {
        this.scheduleTask(task).catch(err => {
            console.error(`Error running task ${task.id}:`, err);
        });
    }

  private checkAllTasksCompleted(): void {
    const allCompleted = this.taskGraph.checkAllTasksCompleted();
    if (allCompleted) {
      this.emit('allTasksCompleted', this.globalContext);
      console.log("ALL TASKS FINISHED");
      this.compileFinalResult();
    }
  }

  private async compileFinalResult() {
    this.status = OrchestrationStatus.CuratingFinalAnswer; 
    this.finalResponse = await this.promptGenerator.curateFinalAnswer(this.globalContext, this.getAllTasks()); 
    this.status = OrchestrationStatus.Done;
  }

    getGlobalContext() {
        return this.globalContext;
    }

    getFinalResult() {
        return this.finalResponse;
    }
}