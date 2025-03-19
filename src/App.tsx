import React, { useEffect, useState, useRef, ChangeEvent } from 'react';
import './App.css';
import doordashLogo from './assets/doordash-logo.png';
import ubereatsLogo from './assets/ubereats-logo.png';
import googleLogo from './assets/google-logo.png';
import TaskGraphComponent from "./components/TaskGraphComponent";
import FinalResultComponent from './components/FinalResultComponent';
import { StatusChecker, OrchestrationStatus } from './components/StatusChecker';

function App() {
  const [taskRepresentation, setTaskRepresentation] = useState<Record<string, any> | null>(null);
  const [globalContext, setGlobalContext] = useState(null);
  const [prompt, setPrompt] = useState<string>("");
  const [status, setStatus] = useState<number>(0);
  const [chatIdx, setChatIdx] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<string | null>(null);

  useEffect(() => {
    if (status > OrchestrationStatus.ConvertingPromptToTaskGraph) {
      const fetchTaskGraph = async () => {
        try {
          const response = await fetch(`http://localhost:4000/get-task-graph/${chatIdx}`);
          if (!response.ok) throw new Error("Failed to fetch task graph");
          const data = await response.json();
          setTaskRepresentation(data);
        } catch (err) {
          console.error("Error loading task graph:", err);
        }
      };
      fetchTaskGraph();
      const intervalId = setInterval(fetchTaskGraph, 2000);
      return () => clearInterval(intervalId);
    }
  }, [status, chatIdx]);

  useEffect(() => {
    const fetchFinalResult = async () => {
        try {
      const response = await fetch(`http://localhost:4000/get-final-result/${chatIdx}`);
          if (!response.ok) throw new Error("Failed to fetch final result");
          const data = await response.json();
          setFinalResult(data.finalResult); 
        } catch (err) {
          console.error("Error loading final result:", err);
        }
    }
    if (status == OrchestrationStatus.Done) {
        fetchFinalResult(); 
    }
  }, [status])

  useEffect(() => {
    if (status > OrchestrationStatus.ConvertingPromptToTaskGraph) {
      const fetchGlobalContext = async () => {
        try {
          const response = await fetch(`http://localhost:4000/get-global-context/${chatIdx}`);
          if (!response.ok) throw new Error("Failed to fetch global context");
          const data = await response.json();
          setGlobalContext(data.globalContext);
        } catch (err) {
          console.error("Error loading global context:", err);
        }
      };

      // Initial fetch
      fetchGlobalContext();

      // Set interval to keep polling
      const intervalId = setInterval(fetchGlobalContext, 2000);

      return () => clearInterval(intervalId);
    }
  }, [status, chatIdx]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  async function submitPrompt() {
    if (prompt.length == 0)
      return;
    const response = await fetch("http://localhost:4000/submit-prompt", {
      method: "POST",
      body: JSON.stringify({ prompt }),
      headers: { "Content-Type": "application/json" },
    });
    const resJson = await response.json();
    setChatIdx(resJson.idx);
  }

  const handleTextareaChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
    setPrompt(e.target.value);
  };

  return (
    <div className="App">
      <h1 className="app-title">YUTORI MINI</h1>
      <div className="website-boxes">
        <div className="website-box website-selected">
          <img
            src={googleLogo}
            alt="Google"
            className="website-logo"
          />
        </div>
        <div className="website-box">
          <img
            src={doordashLogo}
            alt="DoorDash"
            className="website-logo"
          />
        </div>
        <div className="website-box">
          <img
            src={ubereatsLogo}
            alt="UberEats"
            className="website-logo"
          />
        </div>
        <button className="add-website-btn">+</button>
      </div>

      <div className="chat-container">
        <form onSubmit={handleSubmit}>
          <textarea
            placeholder="Send a message..."
            className="chat-input"
            onChange={(e) => handleTextareaChange(e)}
            rows={1}
          />
          <button type="submit" className="submit-btn" onClick={submitPrompt}>
          </button>
        </form>
      </div>

      <div className="task-graph-container">
        {taskRepresentation ? <TaskGraphComponent taskRepresentation={taskRepresentation} /> : <p></p>}
      </div>

      <div className='final-result-container'>
        {finalResult ? <FinalResultComponent finalResult={finalResult} /> : <p></p>}
      </div>

      <div className='global-context-container'>
        <div className='status-container'>
          <h3 className="font-bold">Status</h3>
          {chatIdx ? <StatusChecker
            setStatus={setStatus}
            requestId={chatIdx}
          /> : <p className='status-message'>Submit a prompt </p>}
        </div>
        <div className='global-context-section'>
          <h3 className="font-bold mb-1">Global Context:</h3>
          {globalContext && (
            <div className="p-2 bg-gray-100 rounded">
              <pre className="text-sm">{JSON.stringify(globalContext, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>

  );
}

export default App;
