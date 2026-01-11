import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { HAClient } from '../ha/client.js';
import { handleToolError } from '../utils/errors.js';

// Export Home Assistant tool definitions
export function getHATools() {
  return [
    {
      name: 'ha_get_states',
      description:
        'Get all entity states from Home Assistant. Returns a list of all entities with their current states and attributes.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'ha_get_state',
      description:
        'Get the current state of a specific entity by entity_id. Returns entity state, attributes, and last updated time.',
      inputSchema: {
        type: 'object',
        properties: {
          entity_id: {
            type: 'string',
            description: 'The entity ID (e.g., "light.living_room", "switch.bedroom")',
          },
        },
        required: ['entity_id'],
      },
    },
    {
      name: 'ha_set_state',
      description:
        'Set or update the state of an entity. Note: This only updates the state in Home Assistant\'s state machine, it does not trigger automations or call services.',
      inputSchema: {
        type: 'object',
        properties: {
          entity_id: {
            type: 'string',
            description: 'The entity ID to update',
          },
          state: {
            type: 'string',
            description: 'The new state value (e.g., "on", "off", "25")',
          },
          attributes: {
            type: 'object',
            description: 'Optional attributes to set on the entity',
          },
        },
        required: ['entity_id', 'state'],
      },
    },
    {
      name: 'ha_call_service',
      description:
        'Call a Home Assistant service to control devices or trigger automations. This is the primary way to control devices (e.g., turn on lights, set temperature).',
      inputSchema: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            description: 'The service domain (e.g., "light", "switch", "climate", "automation")',
          },
          service: {
            type: 'string',
            description: 'The service to call (e.g., "turn_on", "turn_off", "toggle")',
          },
          service_data: {
            type: 'object',
            description: 'Optional service data (e.g., {"brightness": 255, "rgb_color": [255, 0, 0]})',
          },
          target: {
            type: 'object',
            description: 'Target entities, devices, or areas',
            properties: {
              entity_id: {
                type: ['string', 'array'],
                description: 'Entity ID or array of entity IDs',
              },
              device_id: {
                type: ['string', 'array'],
                description: 'Device ID or array of device IDs',
              },
              area_id: {
                type: ['string', 'array'],
                description: 'Area ID or array of area IDs',
              },
            },
          },
        },
        required: ['domain', 'service'],
      },
    },
    {
      name: 'ha_get_services',
      description:
        'Get all available services from Home Assistant. Returns a list of all service domains and their available services with descriptions.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'ha_get_history',
      description:
        'Get historical state data for entities. Useful for tracking changes over time or analyzing patterns.',
      inputSchema: {
        type: 'object',
        properties: {
          entity_id: {
            type: 'string',
            description: 'The entity ID to get history for',
          },
          start_time: {
            type: 'string',
            description: 'ISO 8601 datetime string for history start (e.g., "2024-01-01T00:00:00")',
          },
          end_time: {
            type: 'string',
            description: 'ISO 8601 datetime string for history end (defaults to now)',
          },
          minimal_response: {
            type: 'boolean',
            description: 'If true, returns minimal data (state and timestamp only)',
            default: false,
          },
        },
      },
    },
  ];
}

// Handle Home Assistant tool calls
export async function handleHAToolCall(
  request: any,
  haClient: HAClient
): Promise<any> {
  const toolName = request.params.name;

  try {
    switch (toolName) {
      case 'ha_get_states': {
        const states = await haClient.getStates();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(states, null, 2),
            },
          ],
        };
      }

      case 'ha_get_state': {
        const { entity_id } = request.params.arguments || {};
        if (!entity_id) {
          throw new Error('entity_id is required');
        }
        const state = await haClient.getState(entity_id);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(state, null, 2),
            },
          ],
        };
      }

      case 'ha_set_state': {
        const { entity_id, state, attributes } = request.params.arguments || {};
        if (!entity_id || !state) {
          throw new Error('entity_id and state are required');
        }
        const result = await haClient.setState(entity_id, state, attributes);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'ha_call_service': {
        const { domain, service, service_data, target } = request.params.arguments || {};
        if (!domain || !service) {
          throw new Error('domain and service are required');
        }
        const result = await haClient.callService({
          domain,
          service,
          service_data,
          target,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'ha_get_services': {
        const services = await haClient.getServices();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(services, null, 2),
            },
          ],
        };
      }

      case 'ha_get_history': {
        const { entity_id, start_time, end_time, minimal_response } = request.params.arguments || {};
        const history = await haClient.getHistory({
          entity_id,
          start_time,
          end_time,
          minimal_response,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(history, null, 2),
            },
          ],
        };
      }

      default:
        return null; // Tool not handled by this module
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: handleToolError(error),
        },
      ],
      isError: true,
    };
  }
}
