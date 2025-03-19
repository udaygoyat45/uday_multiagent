import { Browser, BrowserContext, Page } from 'playwright';
import { Stagehand } from '@browserbasehq/stagehand';
import StagehandConfig from '../stagehand.config';
import { PromptGenerator, PromptType } from './PromptGeneration';

import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

interface LoginMetadata {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone: string;
}

export class WebAgent {
    private promptGenerator: PromptGenerator = new PromptGenerator();
    private stagehands: Map<string, Stagehand> = new Map();
    private stagehandCounter: number = 0;
    private initialURL: string;
    private loginMetadata: LoginMetadata = {
        firstName: '', lastName: '', email: '', password: '', phone: '',
    };

    constructor(headless: boolean) {
        if (!process.env.INITIAL_URL)
            throw new Error('[Web Agent] INITIAL_URL not declared within the environment variables.');
        this.initialURL = process.env.INITIAL_URL;
        if (this.initialURL.includes("doordash.com")) {
            const {
                DOORDASH_FIRST_NAME,
                DOORDASH_LAST_NAME,
                DOORDASH_EMAIL,
                DOORDASH_PASSWORD,
                DOORDASH_PHONE,
            } = process.env;

            if (
                !DOORDASH_FIRST_NAME ||
                !DOORDASH_LAST_NAME ||
                !DOORDASH_EMAIL ||
                !DOORDASH_PASSWORD ||
                !DOORDASH_PHONE
            ) {
                throw new Error('One or more required DOORDASH_* environment variables are missing.');
            }

            this.loginMetadata = {
                firstName: DOORDASH_FIRST_NAME,
                lastName: DOORDASH_LAST_NAME,
                email: DOORDASH_EMAIL,
                password: DOORDASH_PASSWORD,
                phone: DOORDASH_PHONE,
            };
        }
    }

    async createBrowserContext(): Promise<string> {
        const stagehand = new Stagehand({
            ...StagehandConfig
        });

        await stagehand.init();
        await stagehand.page.goto(this.initialURL);
        const stagehandId = `stagehand-${this.stagehandCounter++}`;
        this.stagehands.set(stagehandId, stagehand);
        return stagehandId;
    }

    async destroyBrowserContext(stagehandId: string): Promise<void> {
        const stagehand = this.stagehands.get(stagehandId);
        if (stagehand) {
            await stagehand.close();
            this.stagehands.delete(stagehandId);
        }
    }

    async destroyAllBrowsers() {
        for (const stagehandId of this.stagehands.keys())
            await this.destroyBrowserContext(stagehandId);
    }

    private delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async execute(task: Record<string, any>, globalContext: Record<string, any>, actionsPerformed: Record<string, any>[], stagehandId: string | undefined) {
        let extractedData;
        if (stagehandId) {
            const stagehand = this.stagehands.get(stagehandId);
            if (!stagehand)
                throw new Error(`No appropriate stagehand context found for ${task.id}`);

            console.log(`Executing Task: ${task.name}`);
            console.log(`Required Inputs: ${task.dataRequirements.inputs.requiredData}`);
            console.log('Available Context:', globalContext);

            const prePageSnapshot = await this.promptGenerator.pageSnapshot(stagehand);
            const observeInstruction = await this.promptGenerator.generatePrompt(
                task, globalContext, PromptType.OBSERVE, prePageSnapshot
            );
            console.log('Observe Instruction:', observeInstruction);

            const observationResults = await stagehand.page.observe({
                instruction: observeInstruction,
                returnAction: true,
            });

            for (const observation of observationResults) {
                actionsPerformed.push(observation);
                await stagehand.page.act(observation);
                await this.delay(500);
                console.log(`Action performign for ${task.id}`, observation);
            }

            const postPageSnapshot = await this.promptGenerator.pageSnapshot(stagehand)
            const extractParams = await this.promptGenerator.generatePrompt(
                task, globalContext, PromptType.EXTRACT, postPageSnapshot
            )
            console.log('Extraction Instruction:', extractParams);

            extractedData = await stagehand.page.extract(extractParams);
            console.log('Extracted Data:', extractedData);
        }

        const finalOutput = await this.promptGenerator.generatePrompt(
            task, globalContext, PromptType.PRODUCE_OUTPUT, extractedData
        );
        const finalOutputJSON = JSON.parse(finalOutput);
        console.log("Final JSON Output: ", finalOutputJSON);

        Object.assign(globalContext, finalOutputJSON);
        console.log('Updated Global Context:', globalContext);
    }
}
