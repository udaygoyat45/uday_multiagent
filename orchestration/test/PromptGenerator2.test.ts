import { PromptGenerator, PromptType } from "../PromptGeneration";
import { Stagehand } from "@browserbasehq/stagehand";
import StageHandConfig from '../../stagehand.config';
import { z } from "zod";
import dotenv from 'dotenv';

const promptGenerator = new PromptGenerator();

dotenv.config();

const mockTask = {
    "id": "task1",
    "name": "Search for Nam Phuong Buford Highway",
    "description": "Open a new browser session and search for 'Nam Phuong Buford Highway' on a review platform (e.g., Yelp or Google Maps). Extract the rating and price range.",
    "dependencies": [],
    "sessionRequirements": {
      "requiresNewSession": true,
      "continuesSessionFrom": null,
      "providesSessionTo": null
    },
    "dataRequirements": {
      "inputs": {
        "requiredData": []
      },
      "outputs": {
        "produces": ["nam_phuong_rating", "nam_phuong_price"]
      }
    }
  }

const mockGlobalContext = {

}

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }


async function testPropmtGeneration() {
    // const stagehand = new Stagehand({
    //     ...StageHandConfig
    // });
    // await stagehand.init();
    // await stagehand.page.goto("https://www.google.com");
    // const pageData = await promptGenerator.pageSnapshot(stagehand);
    // const observeInstruction = await promptGenerator.generatePrompt(mockTask, mockGlobalContext, PromptType.OBSERVE, pageData);
    // console.log("INSTRUCTION");
    // console.log(observeInstruction);

    // const observationResults = await stagehand.page.observe({
    //     instruction: observeInstruction,
    //     returnAction: true,
    // });
    // for (const observation of observationResults) {
    //     await stagehand.page.act(observation);
    //     console.log("Performing action:", observation);
    //     await delay(500);
    // }
    // const postPageSnapshot = await promptGenerator.pageSnapshot(stagehand);
    // const extractParams = await promptGenerator.generatePrompt(
    //     mockTask, mockGlobalContext, PromptType.EXTRACT, postPageSnapshot
    // )
    // console.log('Extraction Instruction:', extractParams);
    // const extractedData = await stagehand.page.extract(extractParams);
    // console.log('Extracted Data:', extractedData);

    const output = await promptGenerator.generatePrompt(
        mockTask, mockGlobalContext, PromptType.PRODUCE_OUTPUT, {"extraction": '4.6\n$20'}
    )
    const outputJSON = JSON.parse(output);
    console.log(outputJSON);
}

testPropmtGeneration();