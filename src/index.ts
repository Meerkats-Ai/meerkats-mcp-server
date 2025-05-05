#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import {
  ScrapeUrlReturnMarkdown,
  WebSearch,
} from './scraper/scraper.js';

import logger from './utils/logger.js';
import { formatError } from './utils/errorCodes.js';

// Note: All logging is redirected to stderr (console.error) to ensure visibility
// when the server is connected via stdio protocol, as stdout is used for MCP communication

class MeerkatsServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'meerkats',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'scrape_url',
          description: 'Scrape a URL and return the content as markdown',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL to scrape',
              },
              wait: {
                type: 'number',
                description: 'Time to wait in seconds before scraping (optional)',
              }
            },
            required: ['url'],
          },
        },
        {
          name: 'web_search',
          description: 'Search on web and return the results',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Query to search for on web',
              },
            },
            required: ['query'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {

      try {
        const args = request.params.arguments ?? {};
        const url: any = args.url;
        const query: any = args.query;
        switch (request.params.name) {
          case 'scrape_url': {
            const result = await ScrapeUrlReturnMarkdown(url);
            return {
              content: [
                {
                  type: 'text',
                  text: result.markdown || result.error || 'No content found',
                },
              ],
              isError: !result.status,
            };
          }
          case 'web_search': {
            const result = await WebSearch(query);
            return {
              content: [
                {
                  type: 'text',
                  text: result.markdown || result.error || 'No search results found',
                },
              ],
              isError: !result.status,
            };
          }
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error: any) {
        logger.error(`Error executing tool ${request.params.name}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Meerkats error: ${error?.message}`
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('Meerkats.ai MCP server running on stdio');
  }
}

const server = new MeerkatsServer();
server.run().catch(console.error);
