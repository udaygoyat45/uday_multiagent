import React, { useEffect, useState } from "react";
import ReactFlow, { Edge, Node, Background } from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";
import './TaskGraph.css';

const TaskGraphComponent: React.FC<{ taskRepresentation: Record<string, any> | null }> = ({ taskRepresentation }) => {
    const [nodesData, setNodesData] = useState<Node[]>([]);
    const [nodesWeb, setNodesWeb] = useState<Node[]>([]);
    const [edgesData, setEdgesData] = useState<Edge[]>([]);
    const [edgesWeb, setEdgesWeb] = useState<Edge[]>([]);
    const [allTasks, setAllTasks] = useState<any[]>([]);

    const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
        const dagreGraph = new dagre.graphlib.Graph();
        dagreGraph.setDefaultEdgeLabel(() => ({}));
        dagreGraph.setGraph({
            rankdir: "TB",
            align: 'DL',
            ranksep: 100,
        });

        nodes.forEach(node => dagreGraph.setNode(node.id, { width: 200, height: 50 }));
        edges.forEach(edge => dagreGraph.setEdge(edge.source, edge.target));
        dagre.layout(dagreGraph);

        return nodes.map(node => {
            const { x, y } = dagreGraph.node(node.id);
            return { ...node, position: { x, y } };
        });
    };

    useEffect(() => {
        if (taskRepresentation)
            setAllTasks(taskRepresentation.allTasks);
    }, [taskRepresentation])

    const getNodeStyleByStatus = (status: string) => {
        switch (status.toLowerCase()) {
         case "running": 
            return { backgroundColor: "ffffff", color: "black" }; // Green
          case "completed":
            return { backgroundColor: "#4caf50", color: "white" }; // Green
          case "failed":
            return { backgroundColor: "#f44336", color: "white" }; // Red
          default:
            return { backgroundColor: "#9e9e9e", color: "white" };
        }
      };

    useEffect(() => {
        const newNodes: Node[] = allTasks.map((task, index) => ({
            id: task.id,
            data: { label: `${task.name} (${task.status})` },
            position: { x: 0, y: 0 }, 
            style: getNodeStyleByStatus(task.status),
        }));

        const dependencyEdges: Edge[] = [];
        const dependencyEdges2: Edge[] = [];

        allTasks.forEach(task => {
            task.dependencies.forEach((depId: string) => {
                dependencyEdges.push({
                    id: `dep-${task.id}-${depId}`,
                    source: depId,
                    target: task.id,
                    label: "depends on",
                    animated: true,
                    style: { stroke: "#ff0072" },
                });
            });

            task.dataRequirements.inputs.requiredData.forEach((dataId: string) => {
                dependencyEdges2.push({
                    id: `data-${task.id}-${dataId}`,
                    source: dataId,
                    target: task.id,
                    label: "needs data",
                    animated: true,
                    style: { stroke: "#0077ff" },
                });
            });
        });

        const layoutedNodes = getLayoutedElements(newNodes, dependencyEdges);
        const layoutedNodes2 = getLayoutedElements(newNodes, dependencyEdges2);

        setNodesData(layoutedNodes);
        setNodesWeb(layoutedNodes2);
        setEdgesData(dependencyEdges);
        setEdgesWeb(dependencyEdges2);
    }, [allTasks]);

    return (
        <div style={{ width: "100%", height: "500px", display: "flex", alignItems: "center", padding: "20px", gap: "30px" }}>
            <div style={{ flex: 1,  padding: "10px", height: "100%" }}>
                <h2 className=".inter-apply" style={{ width: "100%", textAlign: "center" }}>Data Elements Dependence</h2>
                <ReactFlow style={{border: "1px solid black", borderRadius: "4px"}} nodes={nodesData} edges={edgesData}>
                    <Background />
                </ReactFlow>
            </div>

            <div style={{ flex: 1,  padding: "10px", height: "100%" }}>
                <h2 className=".inter-apply" style={{ width: "100%", textAlign: "center" }}>Web Session Dependence</h2>
                <ReactFlow style={{ border: "1px solid black", borderRadius: "4px"}} nodes={nodesWeb} edges={edgesWeb}>
                    <Background />
                </ReactFlow>
            </div>
        </div>
    );
};

export default TaskGraphComponent;