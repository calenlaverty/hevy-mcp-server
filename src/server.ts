import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { HevyClient } from './hevy/client.js';
import { handleWorkoutToolCall, getWorkoutTools } from './tools/workouts.js';
import { handleRoutineToolCall, getRoutineTools } from './tools/routines.js';
import { handleExerciseToolCall, getExerciseTools } from './tools/exercises.js';
import { handleFolderToolCall, getFolderTools } from './tools/folders.js';
import { HAClient } from './ha/client.js';
import { handleHAToolCall, getHATools } from './tools/ha.js';
import { ConfigurationError } from './utils/errors.js';

export interface ServerConfig {
  apiKey: string;
  apiBaseUrl?: string;
  haBaseUrl?: string;
  haToken?: string;
}

export function createHevyMCPServer(config: ServerConfig): Server {
  // Validate configuration
  if (!config.apiKey) {
    throw new ConfigurationError('HEVY_API_KEY is required');
  }

  // Initialize Hevy API client
  const hevyClient = new HevyClient({
    apiKey: config.apiKey,
    baseUrl: config.apiBaseUrl || 'https://api.hevyapp.com',
  });

  // Initialize Home Assistant client (optional)
  let haClient: HAClient | null = null;
  if (config.haBaseUrl && config.haToken) {
    haClient = new HAClient({
      baseUrl: config.haBaseUrl,
      token: config.haToken,
    });
  }

  // Create MCP server
  const server = new Server(
    {
      name: 'hevy-ha-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Collect all tools from all modules
  const allTools: any[] = [
    ...getWorkoutTools(),
    ...getRoutineTools(),
    ...getExerciseTools(),
    ...getFolderTools(),
  ];

  // Add Home Assistant tools if configured
  if (haClient) {
    allTools.push(...getHATools());
  }

  // Register single ListToolsRequestSchema handler with all tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools,
  }));

  // Register single CallToolRequestSchema handler that routes to all modules
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    // Try each module's handler until one handles the tool
    let result = await handleWorkoutToolCall(request, hevyClient);
    if (result) return result;

    result = await handleRoutineToolCall(request, hevyClient);
    if (result) return result;

    result = await handleExerciseToolCall(request, hevyClient);
    if (result) return result;

    result = await handleFolderToolCall(request, hevyClient);
    if (result) return result;

    // Try Home Assistant handler if configured
    if (haClient) {
      result = await handleHAToolCall(request, haClient);
      if (result) return result;
    }

    // If no handler processed the tool, return an error
    return {
      content: [
        {
          type: 'text',
          text: `Unknown tool: ${request.params.name}`,
        },
      ],
      isError: true,
    };
  });

  return server;
}
