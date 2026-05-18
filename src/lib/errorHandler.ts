import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Circuit breaker implementation to prevent cascading failures
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;

  constructor(failureThreshold = 5, timeout?: number, resetTimeout = 30000) {
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
    // timeout parameter is kept for compatibility but currently unused in this basic implementation
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      if (this.state === 'HALF_OPEN') {
        this.reset();
      }
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  private reset() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
}

/**
 * Retry utility with exponential backoff
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      if (error?.status === 400 || error?.status === 401 || error?.status === 403) {
        throw error;
      }
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Create an enhanced Supabase client from the existing one
 */
export function createEnhancedSupabaseClient(
  client: any,
  options: {
    maxRetries?: number;
    circuitBreakerOptions?: {
      failureThreshold?: number;
      timeout?: number;
      resetTimeout?: number;
    };
  } = {}
): any {
  const circuitBreaker = new CircuitBreaker(
    options.circuitBreakerOptions?.failureThreshold,
    options.circuitBreakerOptions?.timeout,
    options.circuitBreakerOptions?.resetTimeout
  );
  const maxRetries = options.maxRetries || 3;

  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'executeQuery') {
        return async <T>(operation: () => Promise<{ data: T | null; error: any }>) => {
          return circuitBreaker.execute(() =>
            retryWithBackoff(() => operation(), maxRetries)
          );
        };
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return value.bind(target);
      }
      return value;
    }
  });
}

/**
 * Custom error classes for better error handling
 */
export class DatabaseError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public readonly details?: Record<string, any>) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Handle Supabase errors and convert to our custom error types
 */
export function handleSupabaseError(error: any): Error {
  if (!error) return new Error('Unknown error');
  
  if (
    error?.message?.includes('Failed to fetch') ||
    (error?.name === 'TypeError' && error?.message?.includes('fetch'))
  ) {
    return new NetworkError('Network connection failed. Please check your internet connection.');
  }
  
  if (
    error?.status === 401 ||
    error?.message?.includes('invalid') ||
    error?.message?.includes('unauthorized')
  ) {
    return new Error('Authentication failed. Please log in again.');
  }
  
  if (
    error?.status === 400 ||
    error?.message?.includes('validation') ||
    error?.code === '23505'
  ) {
    return new ValidationError(
      error?.message || 'Validation failed',
      error?.details
    );
  }
  
  return new DatabaseError(
    error?.message || 'Database error occurred',
    error?.code
  );
}
