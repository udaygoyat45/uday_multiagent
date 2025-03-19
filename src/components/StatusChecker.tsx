import { useEffect, useState } from "react";
import { usePolling } from "../functions/usePolling";
import './StatusChecker.css';

// This is COPIED CODE FROM BACKEND. PLEASE FIX LATER
export enum OrchestrationStatus {
    AwaitingPrompt,
    ConvertingPromptToTaskGraph,
    RunningWebAgents,
    CuratingFinalAnswer,
    Done,
    Error
}

export function StatusChecker({ requestId, setStatus }: { requestId: string, setStatus: React.Dispatch<React.SetStateAction<number>> }) {
    const { status, error } = usePolling(`http://localhost:4000/check-status/${requestId}`, 3000);
    const [currentStatus, setCurrentStatus] = useState(status);

    useEffect(() => {
        if (status !== currentStatus) {
            setCurrentStatus(status);
            setStatus(status);
        }
    }, [status, currentStatus, setStatus]);

    return (
        <div>
            <p className="status-message">
                {currentStatus === OrchestrationStatus.AwaitingPrompt && "⌛ Awaiting Prompt..."}
                {currentStatus === OrchestrationStatus.ConvertingPromptToTaskGraph && "🔄 Converting Prompt To Task Graph..."}
                {currentStatus === OrchestrationStatus.RunningWebAgents && "🕵️ Running Web Agents..."}
                {currentStatus === OrchestrationStatus.CuratingFinalAnswer && "✨ Curating Final Answer 🙂"}
                {currentStatus === OrchestrationStatus.Done && "✨ Final Answer Ready"}
                {![OrchestrationStatus.AwaitingPrompt, OrchestrationStatus.ConvertingPromptToTaskGraph, OrchestrationStatus.RunningWebAgents, OrchestrationStatus.CuratingFinalAnswer].includes(currentStatus) &&
                    "⚠️ Unknown Status Code"}
            </p>
        </div>
    );
}