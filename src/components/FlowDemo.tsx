'use client';

import '@xyflow/react/dist/style.css';

import { FC, useEffect, useState } from 'react';

import Dagre from '@dagrejs/dagre';
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  Edge,
  Handle,
  Node,
  NodeProps,
  NodeTypes,
  OnEdgesChange,
  OnNodesChange,
  Position,
  ReactFlow,
  useReactFlow,
} from '@xyflow/react';

interface AnswerNodeType extends Node {
  type: 'answer';
  data: {
    title?: string;
    content?: string;
  };
}

type CustomNodeTypes = AnswerNodeType;

const AnswerNode: FC<NodeProps<AnswerNodeType>> = ({ id, data }) => {
  const { addNodes, addEdges } = useReactFlow();

  const handleAddQuestion = () => {
    const question = prompt('What is your question?');
    if (question) {
      const newNode: AnswerNodeType = {
        id: `node-${Math.random()}`,
        type: 'answer',
        position: { x: 0, y: 0 },
        data: {
          title: question,
        },
      };

      const newEdge: Edge = {
        id: `edge-${Math.random()}`,
        source: id,
        target: newNode.id,
        label: question,
      };

      addNodes(newNode);
      addEdges(newEdge);
    }
  };

  return (
    <>
      <div
        className="card bg-base-100 max-w-80 border shadow-lg"
        id={`node-${id}`}
      >
        <div className="card-body p-4">
          {data.title && <h2 className="card-title">{data.title}</h2>}
          {data.content && <p>{data.content}</p>}
          <div className="card-actions justify-end">
            <button
              className="btn btn-xs btn-primary"
              onClick={handleAddQuestion}
            >
              Ask
            </button>
          </div>
        </div>
      </div>

      {/* inputs */}
      <Handle type="target" position={Position.Left} />

      {/* outputs */}
      <Handle type="source" position={Position.Right} />
    </>
  );
};

const nodeTypes: NodeTypes = {
  answer: AnswerNode,
};

const initialNodes: CustomNodeTypes[] = [
  {
    id: '1',
    data: { content: 'this is the starting node' },
    position: { x: 0, y: 0 },
    type: 'answer',
  },
];

const getLayoutedElements = (nodes: CustomNodeTypes[], edges: Edge[]) => {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR' });

  const rects: Record<string, DOMRect> = {};
  const getRect = (id: string) => {
    if (!rects[id]) {
      const rect = document
        .getElementById(`node-${id}`)!
        .getBoundingClientRect();
      rects[id] = rect;
    }
    return rects[id];
  };

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });
  nodes.forEach((node) => {
    const { width, height } = getRect(node.id);
    g.setNode(node.id, {
      ...node,
      width,
      height,
    });
  });

  Dagre.layout(g);

  return {
    nodes: nodes.map((node) => {
      const position = g.node(node.id);
      const { width, height } = getRect(node.id);
      // We are shifting the dagre node position (anchor=center center) to the top left
      // so it matches the React Flow node anchor point (top left).
      const x = position.x - width / 2;
      const y = position.y - height / 2;

      return { ...node, position: { x, y } };
    }),
    edges,
  };
};

export function FlowDemo() {
  const [nodes, setNodes] = useState<CustomNodeTypes[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>([]);

  const onNodesChange: OnNodesChange<CustomNodeTypes> = (changes) =>
    setNodes((nds) => applyNodeChanges(changes, nds));
  const onEdgesChange: OnEdgesChange = (changes) =>
    setEdges((eds) => applyEdgeChanges(changes, eds));

  useEffect(() => {
    setTimeout(() => {
      const layouted = getLayoutedElements(nodes, edges);
      setNodes([...layouted.nodes]);
      setEdges([...layouted.edges]);
      console.log('layout');
    }, 0);
  }, [edges.length]);

  return (
    <div className="absolute left-0 right-0 top-0 bottom-0">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
