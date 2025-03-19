import express, { Request, Response } from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { TaskGraph } from "./orchestration/TaskGraph"; // Ensure this is correct
import { TaskOrchestrator, OrchestrationStatus } from "./orchestration/Orchestrator";

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

let ChatConfig = {
    idx: 0,
    chats: new Map<number, TaskOrchestrator>()
}


app.post('/submit-prompt', (req: Request, res: Response) => {
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({error: "Missing prompt output string"});
        }
        let orchestrator = new TaskOrchestrator();
        console.log("Given prompt", prompt.content);
        orchestrator.parsePromptToGraph(prompt);
        ChatConfig.idx++;
        ChatConfig.chats.set(ChatConfig.idx, orchestrator);
        res.json({ idx: ChatConfig.idx });
    } catch (error) {
        console.error("Error processing prompt:", error);
        res.status(500).json({ error: "Failed to process task "});
    }
});

app.get("/check-status/:chatIdx", (req, res) => {
    const orchestrator: TaskOrchestrator | undefined = ChatConfig.chats.get(parseInt(req.params.chatIdx));
    if (!orchestrator) {
        return res.status(404).json({ error: `Chat Idx ${req.params.chatIdx} doesn't exist` });
    }

    // 1. Creating JSON LLM OUtput
    // 2. Running Task Graph
    // 3. Finished ALl Tasks
    // 4. Curating a final answer
    return res.json({status: orchestrator.getStatus() }) 
});


app.get("/get-task-graph/:chatIdx", (req, res) => {
    const orchestrator: TaskOrchestrator | undefined = ChatConfig.chats.get(parseInt(req.params.chatIdx));
    if (!orchestrator) {
        return res.status(404).json({ error: `Chat Idx ${req.params.chatIdx} doesn't exist` });
    }
    const allTasks = orchestrator.getAllTasks();
    res.json({ allTasks });
})

app.get('/get-global-context/:chatIdx', (req, res) => {
    const orchestrator: TaskOrchestrator | undefined = ChatConfig.chats.get(parseInt(req.params.chatIdx));
    if (!orchestrator) {
        return res.status(404).json({ error: `Chat Idx ${req.params.chatIdx} doesn't exist` });
    }
    const globalContext = orchestrator.getGlobalContext();
    res.json({ globalContext });
})


app.get('/get-final-result/:chatIdx', (req, res) => {
    const orchestrator: TaskOrchestrator | undefined = ChatConfig.chats.get(parseInt(req.params.chatIdx));
    if (!orchestrator) {
        return res.status(404).json({ error: `Chat Idx ${req.params.chatIdx} doesn't exist` });
    }
    const finalResult = orchestrator.getFinalResult();
    res.json({ finalResult });
})



// [DEPRECATED]
// Endpoint to process LLM output and return tasks 
app.post("/process-task-graph", (req: Request, res: Response) => {
    try {
        const { llmOutput } = req.body;
        if (!llmOutput) {
            return res.status(400).json({ error: "Missing LLM output string" });
        }
        const taskGraph = new TaskGraph(llmOutput.taskGraph);
        const allTasks = taskGraph.getAllTasks();
        res.json({ allTasks });
    } catch (error) {
        console.error("Error processing task graph:", error);
        res.status(500).json({ error: "Failed to process task graph" });
    }
});

// [DEPRECATED]
app.get("/get-test-task-graph", async (req: Request, res: Response) => {
    try {
        const filePath = path.join(process.cwd(), "orchestration", "prompts", "sample_output.json");
        const data = await fs.promises.readFile(filePath, "utf-8");
        res.json({ taskGraph: JSON.parse(data) });
    } catch (err) {
        console.error("Error reading JSON file:", err);
        res.status(500).json({ error: "Failed to load JSON" });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});