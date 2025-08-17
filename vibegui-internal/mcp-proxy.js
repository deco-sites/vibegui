#!/usr/bin/env node

/**
 * Simple MCP HTTP-to-stdio proxy
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Create HTTP client to connect to your server
const client = new Client({
  name: 'mcp-proxy-client',
  version: '1.0.0'
}, {
  capabilities: {}
});

// Create stdio server for Claude Desktop
const server = new Server({
  name: 'vibegui-blog-proxy',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

// Proxy list tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const result = await client.listTools();
  return result;
});

// Proxy tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const result = await client.callTool(request.params);
  return result;
});

async function main() {
  try {
    console.error('Starting MCP proxy...');
    
    // Connect client to your HTTP server
    const transport = new StreamableHTTPClientTransport(new URL('http://localhost:50040/mcp'));
    await client.connect(transport);
    console.error('Connected to HTTP MCP server');
    
    // Start stdio server for Claude Desktop
    const stdioTransport = new StdioServerTransport();
    await server.connect(stdioTransport);
    console.error('MCP proxy ready');
    
  } catch (error) {
    console.error('Failed to start MCP proxy:', error);
    process.exit(1);
  }
}

main();