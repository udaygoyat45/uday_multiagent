import { EventEmitter } from 'events';
import { TaskGraph, Task } from './TaskGraph';
import { WebAgent } from './WebAgent';
import * as fs from 'fs';
import { PromptGenerator } from './PromptGeneration';

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

    constructor(maxConcurrentTasks: number = 5) {
        super();
        this.maxConcurrentTasks = maxConcurrentTasks;
        this.status = OrchestrationStatus.AwaitingPrompt;
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
        this.status = OrchestrationStatus.ConvertingPromptToTaskGraph;
        await this.delay(5000);

        let rawLlmOutput = fs.readFileSync(SAMPLE_OUTPUT_FILEPATH, "utf-8");
        let JsonLlmOutput = this.validateJSON(rawLlmOutput);
        let validationAttempts = 0;
        
        while (!JsonLlmOutput && validationAttempts < this.totalValidationAttempts) {
            rawLlmOutput = fs.readFileSync(SAMPLE_OUTPUT_FILEPATH, "utf-8");
            JsonLlmOutput = this.validateJSON(rawLlmOutput);
            validationAttempts++;
        }

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