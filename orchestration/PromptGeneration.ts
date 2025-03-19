import { OpenAI } from "openai";
import { Stagehand } from "@browserbasehq/stagehand";
import dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const SYSTEM_PROMPT_FILEPATH = "./orchestration/prompts/system_prompt.txt";

export enum PromptType {
    OBSERVE = "observe",
    EXTRACT = "extract",
    PRODUCE_OUTPUT = "produce_output",
}

export class PromptGenerator {
    private api_key: string;
    private openai: OpenAI;
    private systemPrompt: string;

    constructor() {
        const process_api_key = process.env.OPENAI_API_KEY;
        if (!process_api_key)
            throw new Error(`Missing OPENAI_API_KEY`);
        this.api_key = process_api_key;
        this.openai = new OpenAI({
            apiKey: this.api_key,
        });

        this.systemPrompt = fs.readFileSync(SYSTEM_PROMPT_FILEPATH, "utf-8");
    }

    async curateFinalAnswer(globalContext, alltasks) {
        const prompt = `
ALL TASKS:
${JSON.stringify(alltasks)}

GLOBAL CONTEXT:
${JSON.stringify(globalContext)}

INSTRUCTION:
All the tasks have finished. Please reference all tasks with special attention to root task. Then analyze the global context, to deliver the user with a detailed final answer along with the reasoning.
Since the output will be displayed directly to the user, ensure only client-facing final reasoning is presented.`

        const chatResponse = await this.openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "You are an expert system for reading tasks performed by previous web agents and reading what they produced (through global context). Your role is to analyze the given background information and follow through with the instruction" },
                { role: "user", content: prompt },
            ],
        });

        const messageContent = chatResponse.choices[0]?.message?.content;
        if (!messageContent) {
            throw new Error("Received empty response from OpenAI");
        }
        return messageContent.trim();

    }

    private buildPrompt(task: any, globalContext: any, type: PromptType, extractedData: any): string {
        let extractedDataStringified;
        if (extractedData == null) {
            extractedDataStringified = "";
        } else {
            if (type == PromptType.OBSERVE || type == PromptType.EXTRACT) extractedDataStringified = "Current Page Snapshot:\n";
            else extractedDataStringified = "Extracted Data From Web Automation:\n"
            extractedDataStringified += JSON.stringify(extractedData);
        }

        switch (type) {
            case PromptType.OBSERVE:
                return `
Task:
${JSON.stringify(task, null, 2)}

Global Context:
${JSON.stringify(globalContext, null, 2)}

${extractedDataStringified}

Instruction:
Based on the task description, global context, and task progress, what should be observed or acted on next on the current web page?

The instruction should:
- Be no more than 2 sentences.
- Be action focused, without containing reasoning.
- Mention **1-2 clear, low-level actions**: scrolling, typing characters, mouse click, text input, checkboxes, radio buttons, select options, type characters, keys and shortcuts, focus element, drag and drop.
- If a keyboard related action has taken place, also remember to specify any submission related action, for instance clicking submit button or pressing the enter button
- Assume **no prior steps have been completed unless explicitly stated.**
        `.trim();

            case PromptType.EXTRACT:
                return `
Task:
${JSON.stringify(task, null, 2)}

Global Context:
${JSON.stringify(globalContext, null, 2)}

${extractedDataStringified}

Instruction:
You are tasked with determining what specific information should be extracted from the current web page in order to fulfill the task requirements.
Focus only on the relevant data points needed to accomplish the task, based on the given context.
Do not suggest or describe any actions.
Provide a clear, precise extraction instruction in one or two concise sentences.
If no relevant data is present, clearly state: "No relevant data available."
        `.trim();

            case PromptType.PRODUCE_OUTPUT:
                return `
Task:
${JSON.stringify(task, null, 2)}

Gloabl Context:
${JSON.stringify(globalContext, null, 2)}

${extractedDataStringified}

Instruction:
Read the task description and extracted data. Global context contains key and values describing extracted data from web automation and reasoning from previous tasks. 
Produce a JSON object matching the output keys:
${JSON.stringify(task.dataRequirements.outputs.produces, null, 2)}

Ensure the JSON is valid and matches the required structure. Ensure nothing else is output except for a valid JSON object.
        `.trim();

            default:
                throw new Error(`Unsupported prompt type: ${type}`);
        }
    }

    public async generatePrompt(task: any, globalContext: any, type: PromptType, extractedData: any = null): Promise<string> {
        const prompt = this.buildPrompt(task, globalContext, type, extractedData);
        console.log("PROMPT:");
        console.log(prompt);

        const chatResponse = await this.openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: prompt },
            ],
        });

        const messageContent = chatResponse.choices[0]?.message?.content;
        if (!messageContent) {
            throw new Error("Received empty response from OpenAI");
        }
        return messageContent.trim();
    }

    public async pageSnapshot(stagehand: Stagehand) {
        return await stagehand.page.evaluate(() => {
            const headings = Array.from(document.querySelectorAll<HTMLElement>('h1, h2, h3'))
                .map(el => el.innerText.trim())
                .filter(Boolean)
                .slice(0, 3);

            const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a'))
                .map(el => ({
                    text: el.innerText.trim(),
                    href: el.href,
                }))
                .filter(link => link.text && link.href)
                .slice(0, 3);

            const buttons = Array.from(document.querySelectorAll<HTMLElement>('button, input[type="submit"]'))
                .map(el => el.innerText.trim())
                .filter(Boolean)
                .slice(0, 3);

            const paragraphs = Array.from(document.querySelectorAll<HTMLElement>('p'))
                .map(el => el.innerText.trim())
                .filter(p => p.length > 0)
                .slice(0, 3);

            const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input'))
                .filter(el => el.type !== 'hidden')
                .map(el => ({
                    type: el.type,
                    name: el.name,
                    placeholder: el.placeholder,
                    value: el.type === "password" ? "" : el.value.slice(0, 100),
                }))
                .slice(0, 3);

            const textareas = Array.from(document.querySelectorAll<HTMLTextAreaElement>('textarea'))
                .map(el => ({
                    name: el.name,
                    placeholder: el.placeholder,
                    value: el.value.slice(0, 200),
                }))
                .slice(0, 3);

            const selects = Array.from(document.querySelectorAll<HTMLSelectElement>('select'))
                .map(el => ({
                    name: el.name,
                    selectedOptions: Array.from(el.selectedOptions).map(opt => opt.text).slice(0, 3),
                }))
                .slice(0, 3);

            return {
                url: window.location.href,
                title: document.title,
                headings,
                buttons,
                links,
                paragraphs,
                inputs,
                textareas,
                selects,
            };
        });
    }
}