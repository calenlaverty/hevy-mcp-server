# **Hevy MCP Server Specification**

## **Overview**

A local MCP server that connects to the official Hevy API and exposes workout data to AI assistants via both stdio (for Claude Desktop) and SSE/HTTP (for [Poke.com](http://Poke.com)).

## **Architecture**

```
┌─────────────────┐         ┌─────────────────┐
│   Poke.com      │         │ Claude Desktop  │
│   (Remote)      │         │    (Local)      │
└────────┬────────┘         └────────┬────────┘
         │ HTTPS                     │ stdio
         ↓                           ↓
    ┌─────────────────────────────────┐
    │       ngrok Tunnel              │
    │   (Optional - for Poke only)    │
    └────────────┬────────────────────┘
                 │
                 ↓
    ┌─────────────────────────────────┐
    │     Hevy MCP Server             │
    │   Port 3000 (configurable)      │
    │   SSE + HTTP / stdio            │
    └────────────┬────────────────────┘
                 │
                 ↓
    ┌─────────────────────────────────┐
    │      Hevy API                   │
    │   api.hevyapp.com               │
    │   (Requires PRO + API Key)      │
    └─────────────────────────────────┘
```

## **Core Features**

### **MCP Tools to Implement**

#### **1. Workout Management**

- `get-workouts` - Get paginated workout list with date filtering
- `get-workout` - Get single workout by ID with full details
- `create-workout` - Create new workout with exercises and sets
- `update-workout` - Update existing workout
- `get-workout-count` - Get total workout count for stats
- `get-workout-events` - Get workout update/delete events since date

#### **2. Routine Management**

- `get-routines` - List all saved routines
- `get-routine` - Get single routine by ID
- `create-routine` - Create new workout routine template
- `update-routine` - Update existing routine
- `delete-routine` - Remove routine

#### **3. Exercise Data**

- `get-exercise-templates` - Browse available exercises (standard + custom)
- `get-exercise-template` - Get single exercise by ID
- `get-exercise-progress` - Track progress for specific exercises over time
- `get-exercise-stats` - Get personal records and 1RM estimates

#### **4. Folder Organization**

- `get-routine-folders` - List routine folders
- `create-routine-folder` - Create new folder
- `get-routine-folder` - Get folder by ID

#### **5. Webhooks** (Optional for v1)

- `get-webhook-subscription` - Check current webhook config
- `create-webhook-subscription` - Set up webhooks
- `delete-webhook-subscription` - Remove webhooks

-----

## **Technical Stack**

```typescript
// Dependencies
{
  "@modelcontextprotocol/sdk": "^1.0.0",
  "express": "^4.18.0",
  "eventsource-parser": "^1.1.0",
  "zod": "^3.22.0",
  "dotenv": "^16.0.0"
}
```

### **File Structure**

```
hevy-mcp-server/
├── src/
│   ├── index.ts              # Main entry point + transport router
│   ├── server.ts             # MCP server core logic
│   ├── transports/
│   │   ├── stdio.ts          # stdio transport (Claude Desktop)
│   │   └── sse.ts            # SSE + HTTP transport (Poke.com)
│   ├── hevy/
│   │   ├── client.ts         # Hevy API client wrapper
│   │   └── types.ts          # TypeScript types for Hevy data
│   ├── tools/
│   │   ├── workouts.ts       # Workout-related tools
│   │   ├── routines.ts       # Routine-related tools
│   │   ├── exercises.ts      # Exercise-related tools
│   │   ├── folders.ts        # Folder-related tools
│   │   └── webhooks.ts       # Webhook-related tools (optional)
│   └── utils/
│       ├── formatters.ts     # Data formatting helpers
│       ├── validators.ts     # Input validation with Zod
│       └── errors.ts         # Error handling
├── dist/                     # Compiled output
├── .env.example
├── .env
├── package.json
├── tsconfig.json
└── README.md
```

-----

## **Environment Variables**

```bash
# .env.example
HEVY_API_KEY=your_hevy_api_key_here
HEVY_API_BASE_URL=https://api.hevyapp.com

# Transport configuration
TRANSPORT=stdio                    # stdio | sse | both
PORT=3000                          # Port for SSE/HTTP mode
HOST=127.0.0.1                     # Host for SSE/HTTP mode

# SSE Configuration (for Poke.com)
SSE_PATH=/mcp                      # SSE endpoint path
HEARTBEAT_INTERVAL=30000           # ms - keep connection alive
AUTH_TOKEN=                        # Optional bearer token

# ngrok (for Poke.com access)
NGROK_AUTH_TOKEN=                  # Your ngrok auth token
NGROK_DOMAIN=                      # Optional custom domain
```

-----

## **Key Implementation Details**

### **1. Dual Transport Support**

```typescript
// src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createSSETransport } from './transports/sse.js';

const transport = process.env.TRANSPORT || 'stdio';

if (transport === 'stdio' || transport === 'both') {
  const stdioTransport = new StdioServerTransport();
  await server.connect(stdioTransport);
}

if (transport === 'sse' || transport === 'both') {
  const sseApp = createSSETransport(server);
  sseApp.listen(PORT, HOST);
}
```

### **2. SSE Transport for Poke.com**

```typescript
// src/transports/sse.ts
import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

export function createSSETransport(server: Server) {
  const app = express();
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // SSE endpoint for MCP
  app.get('/mcp', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Session management
    const sessionId = req.headers['mcp-session-id'] as string || 
                      crypto.randomUUID();

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, parseInt(process.env.HEARTBEAT_INTERVAL || '30000'));

    // Handle MCP messages
    req.on('close', () => {
      clearInterval(heartbeat);
    });

    // Initialize MCP session
    // ... SSE message handling
  });

  // POST endpoint for tool calls
  app.post('/mcp', express.json(), async (req, res) => {
    // Handle MCP requests
    // ... request processing
  });

  return app;
}
```

### **3. Hevy API Client**

```typescript
// src/hevy/client.ts
import { HevyConfig, Workout, Routine, Exercise } from './types.js';

export class HevyClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: HevyConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.hevyapp.com';
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'api-key': this.apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Hevy API error: ${response.statusText}`);
    }

    return response.json();
  }

  // Workout methods
  async getWorkouts(params: {
    page?: number;
    pageSize?: number;
  }): Promise<Workout[]> {
    return this.request(`/v1/workouts?page=${params.page || 0}&pageSize=${params.pageSize || 10}`);
  }

  async getWorkout(id: string): Promise<Workout> {
    return this.request(`/v1/workouts/${id}`);
  }

  async createWorkout(data: CreateWorkoutInput): Promise<Workout> {
    return this.request('/v1/workouts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getWorkoutCount(): Promise<{ workout_count: number }> {
    return this.request('/v1/workouts/count');
  }

  // Routine methods
  async getRoutines(): Promise<Routine[]> {
    return this.request('/v1/routines');
  }

  async getRoutine(id: string): Promise<Routine> {
    return this.request(`/v1/routines/${id}`);
  }

  // Exercise methods
  async getExerciseTemplates(params?: {
    page?: number;
    pageSize?: number;
  }): Promise<Exercise[]> {
    return this.request(`/v1/exercise_templates?page=${params?.page || 0}&pageSize=${params?.pageSize || 50}`);
  }

  // ... additional methods
}
```

### **4. Example Tool Implementation**

```typescript
// src/tools/workouts.ts
import { z } from 'zod';
import { HevyClient } from '../hevy/client.js';

export function registerWorkoutTools(server: Server, client: HevyClient) {
  
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'get-workouts',
        description: 'Get a list of workouts with optional date filtering',
        inputSchema: {
          type: 'object',
          properties: {
            startDate: {
              type: 'string',
              description: 'ISO 8601 date string (YYYY-MM-DD)',
            },
            endDate: {
              type: 'string',
              description: 'ISO 8601 date string (YYYY-MM-DD)',
            },
            limit: {
              type: 'number',
              description: 'Max workouts to return (default: 10)',
              default: 10,
            },
          },
        },
      },
      // ... more tools
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === 'get-workouts') {
      const { startDate, endDate, limit = 10 } = request.params.arguments;
      
      const workouts = await client.getWorkouts({
        page: 0,
        pageSize: limit,
      });

      // Filter by date range if provided
      let filtered = workouts;
      if (startDate || endDate) {
        filtered = workouts.filter(w => {
          const workoutDate = new Date(w.start_time);
          if (startDate && workoutDate < new Date(startDate)) return false;
          if (endDate && workoutDate > new Date(endDate)) return false;
          return true;
        });
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(filtered, null, 2),
        }],
      };
    }
  });
}
```

-----

## **Setup Instructions**

### **1. Get Hevy API Key**

- Requires Hevy PRO subscription
- Get API key at: <https://hevy.com/settings?developer>

### **2. Install & Configure**

```bash
# Clone/create project
mkdir hevy-mcp-server && cd hevy-mcp-server
npm init -y

# Install dependencies
npm install @modelcontextprotocol/sdk express zod dotenv

# Install dev dependencies
npm install -D typescript @types/node @types/express tsx

# Copy environment file
cp .env.example .env
# Add your HEVY_API_KEY
```

### **3. Run Locally (Claude Desktop)**

```bash
# stdio mode
npm run dev -- --transport stdio
```

**Claude Desktop Config** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "hevy": {
      "command": "node",
      "args": ["/path/to/hevy-mcp-server/dist/index.js"],
      "env": {
        "HEVY_API_KEY": "your_api_key",
        "TRANSPORT": "stdio"
      }
    }
  }
}
```

### **4. Run for Poke.com (SSE + ngrok)**

```bash
# Terminal 1: Start MCP server in SSE mode
npm run dev -- --transport sse

# Terminal 2: Start ngrok tunnel
ngrok http 3000
```

**Connect to Poke.com**:

1. Go to <https://poke.com/settings/connections>
2. Add new MCP connection
3. Enter your ngrok URL: `https://your-id.ngrok.io/mcp`
4. Test: “Tell the subagent to use the ‘hevy’ integration’s ‘get-workouts’ tool”

-----

## **Data Types**

```typescript
// src/hevy/types.ts
export interface Workout {
  id: string;
  title: string;
  description?: string;
  start_time: string;  // ISO 8601
  end_time: string;    // ISO 8601
  exercises: WorkoutExercise[];
}

export interface WorkoutExercise {
  exercise_template_id: string;
  superset_id?: string;
  notes?: string;
  sets: ExerciseSet[];
}

export interface ExerciseSet {
  type: 'normal' | 'warmup' | 'dropset' | 'failure';
  weight_kg?: number;
  reps?: number;
  distance_meters?: number;
  duration_seconds?: number;
  rpe?: number;
}

export interface Routine {
  id: string;
  title: string;
  folder_id?: string;
  exercises: RoutineExercise[];
}

export interface Exercise {
  id: string;
  title: string;
  primary_muscle_group: string;
  secondary_muscle_groups: string[];
  is_custom: boolean;
}
```

-----

## **Priority Implementation Order**

### **Phase 1: Core (MVP)**

1. ✅ Basic project setup + Hevy API client
2. ✅ stdio transport for Claude Desktop
3. ✅ `get-workouts`, `get-workout`, `get-workout-count`
4. ✅ `get-routines`, `get-routine`
5. ✅ `get-exercise-templates`

### **Phase 2: Write Operations**

1. ✅ `create-workout` - Log new workouts
2. ✅ `update-workout` - Edit existing workouts
3. ✅ `create-routine` - Save workout templates

### **Phase 3: Poke.com Support**

1. ✅ SSE transport implementation
2. ✅ ngrok integration for public access
3. ✅ Session management + heartbeats

-----

## **Testing Strategy**

```typescript
// Test with Claude Desktop
"Show me my last 5 workouts"
"What was my best bench press weight?"
"Create a new Push Day routine with 3 exercises"

// Test with Poke.com
"Tell the subagent to use the 'hevy' integration's 'get-workouts' tool 
with startDate '2025-01-01' and limit 10"
```
