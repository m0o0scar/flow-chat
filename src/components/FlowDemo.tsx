'use client';

import '@xyflow/react/dist/style.css';

import {
  CoreAssistantMessage,
  CoreMessage,
  CoreUserMessage,
  streamText,
} from 'ai';
import { FC, useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { createGoogleGenerativeAI } from '@ai-sdk/google';
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
    parentId?: string;
  };
}

const google = createGoogleGenerativeAI({
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_GENAI_APIKEY,
});
const model = google('gemini-1.5-flash-latest');

type CustomNodeTypes = AnswerNodeType;

const AnswerNode: FC<NodeProps<AnswerNodeType>> = ({
  id,
  positionAbsoluteX,
  positionAbsoluteY,
  width = 0,
  data,
}) => {
  const { addNodes, setNodes, addEdges, getNode } = useReactFlow();

  const [completed, setCompleted] = useState(false);

  const addNewNode = (question: string) => {
    const newNode: AnswerNodeType = {
      id: `node-${Math.random()}`,
      type: 'answer',
      position: { x: positionAbsoluteX + width + 200, y: positionAbsoluteY },
      data: {
        question,
        parentId: id,
      },
    };

    const newEdge: Edge = {
      id: `edge-${id}-${newNode.id}`,
      source: id,
      target: newNode.id,
      label: question,
    };

    addNodes(newNode);
    addEdges(newEdge);
  };

  const getConversationHistory = () => {
    const nodes: Node[] = [];
    let parentId = data.parentId;
    while (parentId) {
      const node = getNode(parentId);
      if (node) nodes.push(node);
      parentId = (node?.data as CustomNodeTypes['data']).parentId;
    }

    const messages: CoreMessage[] = [];
    nodes.forEach((node) => {
      const { question, content } = node.data as CustomNodeTypes['data'];
      if (question && content) {
        const userMessage: CoreUserMessage = {
          role: 'user',
          content: question,
        };
        const aiMessage: CoreAssistantMessage = {
          role: 'assistant',
          content: content,
        };
        messages.push(userMessage, aiMessage);
      }
    });

    return messages;
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

        const messages: CoreMessage[] = [
          ...getConversationHistory(),
          { role: 'user', content: data.question },
        ];
        console.log('messages:', messages);

        const result = await streamText({
          model,
          temperature: 0,
          messages,
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
          {data.content && (
            <Markdown
              remarkPlugins={[remarkGfm]}
              className="prose-sm max-h-[500px] overflow-y-auto nowheel"
            >
              {data.content}
            </Markdown>
          )}
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

export function FlowDemo() {
  const [nodes, setNodes] = useState<CustomNodeTypes[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>([]);

  const onNodesChange: OnNodesChange<CustomNodeTypes> = (changes) =>
    setNodes((nds) => applyNodeChanges(changes, nds));
  const onEdgesChange: OnEdgesChange = (changes) =>
    setEdges((eds) => applyEdgeChanges(changes, eds));

  return (
    <div className="absolute left-0 right-0 top-0 bottom-0">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        snapGrid={[50, 50]}
        snapToGrid
        minZoom={0.2}
        maxZoom={1}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
