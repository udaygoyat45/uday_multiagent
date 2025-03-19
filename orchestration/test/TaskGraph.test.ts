import { TaskGraph } from '../TaskGraph';
import * as fs from 'fs';

const SAMPLE_OUTPUT_FILEPATH = '/Users/udayg/Documents/Coding/yutori_take_home/uday_multiagent/orchestration/prompts/sample_output.json';

jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    readFileSync: jest.fn((path) => {
      return jest.requireActual('fs').readFileSync(path);
    })
  }));


describe('TaskGraph', () => {
    let graph: TaskGraph;

    beforeAll(() => {
        const rawLLMOutput = fs.readFileSync(SAMPLE_OUTPUT_FILEPATH, 'utf-8');
        const llmOutputJSON = JSON.parse(rawLLMOutput);
        graph = new TaskGraph(llmOutputJSON);
    });

    test('should create a TaskGraph from JSON', () => {
        expect(graph).toBeDefined();
    });

    test('should identify root tasks correctly', () => {
        const rootTasks = graph.getRootTasks();
        expect(rootTasks).toHaveLength(3);
    });

    test('should identify dependent tasks correctly', () => {
        const dependentTasks = graph.getDependentTasks('task1');
        expect(dependentTasks).toHaveLength(1);
    });

    test('should identify ready tasks correctly', () => {
        const readyTasks = graph.getTasksReadyToRun();
        expect(readyTasks).toHaveLength(3);
    });
});
