export interface Task {
    id: string;
    name: string;
    description: string;
    dependencies: string[];
    sessionRequirements: {
        "requiresNewSession": boolean,
        "continuesSessionFrom"?: string,
        "providesSessionTo"?: string
    };
    dataRequirements: {
        "inputs": {
            "requiredData": string[];
        }
        "outputs": {
            "produces": string[];
        }
    },
    status: 'pending' | 'running' | 'completed' | 'failed';
    outgoingContext?: string;
}

export interface TaskContext {
    globalContext: Record<string, any>;
}

export class TaskGraph {
    private tasks: Map<string, Task>;
    private reverseDependencies: Map<string, string[]>;
    private forwardDependencies: Map<string, string[]>;
    private completedTaskIds: Set<string>;
    private totalTasks: number;

    constructor(JSONLlm?: Record<string, any> | null) {
        this.tasks = new Map();
        this.reverseDependencies = new Map();
        this.forwardDependencies = new Map();
        this.completedTaskIds = new Set();
        this.totalTasks = 0;
        if (JSONLlm) this.parseJSON(JSONLlm);
    }

    addTask(task: Task): void {
        this.tasks.set(task.id, task);
        if (!this.forwardDependencies.has(task.id)) {
            this.forwardDependencies.set(task.id, []);
        }
        task.dependencies.forEach(depId => {
            if (!this.reverseDependencies.has(depId)) {
                this.reverseDependencies.set(depId, []);
            }
            this.reverseDependencies.get(depId)!.push(task.id);
            this.forwardDependencies.get(task.id)!.push(depId);
        });
    }

    parseJSON(JSONLLm: Record<string, any>) {
        try {
            if (JSONLLm.taskGraph && Array.isArray(JSONLLm.taskGraph.tasks)) {
                JSONLLm.taskGraph.tasks.forEach((taskData: Task) => {
                    taskData.status = 'pending';
                    this.addTask(taskData);
                    this.totalTasks++;
                });
            }
        } catch (e: any) {
            throw new Error(`Failed to parse task graph JSON: ${e.message}`);
        }
    }

    getRootTasks(): Task[] {
        return Array.from(this.tasks.values())
            .filter(task => task.dependencies.length === 0);
    }

    getTasksReadyToRun(globalContext: Record<string, any>): Task[] {
        return Array.from(this.tasks.values())
            .filter(task =>
                task.status === 'pending' &&
                task.dependencies.every(depId => this.completedTaskIds.has(depId)) &&
                task.dataRequirements.inputs.requiredData.every(dataKey => 
                    dataKey in globalContext
                )
            );
    }

    getAllTasks(): Task[] {
        return Array.from(this.tasks.values());
    }

    getAllTasksCount(): number {
        return this.totalTasks;
    }

    getTask(id: string): Task | undefined {
        return this.tasks.get(id);
    }

    getDependentTasks(taskId: string): Task[] {
        const dependentIds = this.reverseDependencies.get(taskId) || [];
        return dependentIds.map(id => this.tasks.get(id)!).filter(Boolean);
    }

    checkAllTasksCompleted(): boolean {
        return this.completedTaskIds.size == this.totalTasks;
    }

    addCompletedTask(taskId: string) {
        this.completedTaskIds.add(taskId);
    }
}
