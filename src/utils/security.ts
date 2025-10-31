import { timingSafeEqual, createHash } from 'crypto';
import sanitizeHtml from 'sanitize-html';

/**
 * Compare two strings in constant time to prevent timing attacks
 * @param a First string
 * @param b Second string
 * @returns true if strings match
 */
export function secureCompare(a: string, b: string): boolean {
  if (!a || !b) {
    return false;
  }

  // Convert to buffers for timing-safe comparison
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  // If lengths differ, create dummy buffer to maintain constant time
  if (bufA.length !== bufB.length) {
    const dummyA = createHash('sha256').update(a).digest();
    const dummyB = createHash('sha256').update(b).digest();
    timingSafeEqual(dummyA, dummyB); // Will throw, but maintains timing
    return false;
  }

  try {
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param input Raw HTML/text input
 * @returns Sanitized text
 */
export function sanitizeInput(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [], // Strip all HTML tags
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  });
}

/**
 * Sanitize and truncate text fields
 * @param input Text input
 * @param maxLength Maximum allowed length
 * @returns Sanitized and truncated text
 */
export function sanitizeText(input: string, maxLength: number = 10000): string {
  const sanitized = sanitizeInput(input);
  return sanitized.substring(0, maxLength);
}

/**
 * Encode query parameters for URL safety
 * @param params Object with query parameters
 * @returns URL-encoded query string
 */
export function encodeQueryParams(params: Record<string, string | number | undefined>): string {
  const encoded = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      encoded.append(key, String(value));
    }
  }

  return encoded.toString();
}

/**
 * Sanitize error message for production (remove sensitive info)
 * @param error Error object or message
 * @param isProduction Whether running in production
 * @returns Safe error message
 */
export function sanitizeErrorMessage(error: unknown, isProduction: boolean = true): string {
  if (!isProduction) {
    // In development, return full error details
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  // In production, return generic messages
  if (error instanceof Error) {
    // Only return safe, generic messages in production
    if (error.message.includes('API error')) {
      return 'External API request failed';
    }
    if (error.message.includes('Validation')) {
      return 'Invalid input provided';
    }
    if (error.message.includes('Unauthorized') || error.message.includes('401')) {
      return 'Authentication failed';
    }
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return 'Network connection error';
    }
  }

  return 'An error occurred while processing your request';
}
