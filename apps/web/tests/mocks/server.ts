/**
 * MSW server setup for Node.js (testing environment)
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Create MSW server with handlers
export const server = setupServer(...handlers);
