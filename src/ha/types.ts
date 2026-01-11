export interface HAConfig {
  baseUrl: string;
  token: string;
}

export interface HAState {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
  last_updated: string;
  context: {
    id: string;
    parent_id: string | null;
    user_id: string | null;
  };
}

export interface HAServiceCallData {
  domain: string;
  service: string;
  service_data?: Record<string, any>;
  target?: {
    entity_id?: string | string[];
    device_id?: string | string[];
    area_id?: string | string[];
  };
}

export interface HAHistoryParams {
  entity_id?: string;
  start_time?: string;
  end_time?: string;
  minimal_response?: boolean;
}

export interface HAServiceDomain {
  domain: string;
  services: Record<string, HAService>;
}

export interface HAService {
  name: string;
  description: string;
  fields: Record<string, HAServiceField>;
}

export interface HAServiceField {
  name: string;
  description: string;
  required?: boolean;
  example?: any;
  selector?: any;
}
