'use client';

import '@xyflow/react/dist/style.css';

import { streamText } from 'ai';
import { FC, useEffect, useState } from 'react';
import Markdown from 'react-markdown';

import { createGoogleGenerativeAI } from '@ai-sdk/google';
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
    question?: string;
    content?: string;
  };
}

const google = createGoogleGenerativeAI({
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_GENAI_APIKEY,
});
const model = google('gemini-1.5-flash-latest');

type CustomNodeTypes = AnswerNodeType;

const AnswerNode: FC<NodeProps<AnswerNodeType>> = ({ id, data }) => {
  const { addNodes, setNodes, addEdges } = useReactFlow();

  const [completed, setCompleted] = useState(false);

  const addNewNode = (question: string) => {
    const newNode: AnswerNodeType = {
      id: `node-${Math.random()}`,
      type: 'answer',
      position: { x: 0, y: 0 },
      data: {
        question,
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
  };

  const updateContent = (content: string) => {
    setNodes((values) =>
      values.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: {
              ...node.data,
              content,
            },
          };
        }
        return node;
      }),
    );
  };

  const handleAddQuestion = () => {
    const question = prompt('What is your question?');
    if (question) addNewNode(question);
  };

  useEffect(() => {
    (async () => {
      if (data.question && !data.content) {
        let content = '';
        const result = await streamText({
          model,
          temperature: 0,
          prompt: data.question,
        });
        for await (const text of result.textStream) {
          content += text;
          updateContent(content);
        }
      }
      setCompleted(true);
    })();
  }, [data.question]);

  return (
    <>
      <div
        className="card bg-base-100 max-w-[600px] border shadow-lg"
        id={`node-${id}`}
      >
        <div className="card-body p-4">
          {data.title && <h2 className="card-title">{data.title}</h2>}
          {data.content && <Markdown>{data.content}</Markdown>}
          {completed && (
            <div className="card-actions justify-end">
              <button
                className="btn btn-xs btn-primary"
                onClick={handleAddQuestion}
              >
                Ask
              </button>
            </div>
          )}
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
    data: {},
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
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
