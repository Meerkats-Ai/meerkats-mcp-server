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
import catchAllController from './controllers/catchAll.controller.js';
const { guessEmail, verifyEmail, isDomainCatchAll, domainMxRecords } = catchAllController;

import googleController, { GoogleMapPlaces } from './controllers/google.controller.js';
const { GoogleSerp, GoogleMap } = googleController;

import logger from './utils/logger.js';

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
          name: 'google_places',
          description: 'Get Google Maps Places API data for a location lat,lng coordinates or zipcode within given radius',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'search query',
              },
              location: {
                type: 'string',
                description: 'location parameter. Can be in "latitude,longitude" format (e.g., "37.7749,-122.4194") or a zipcode.',
              },
              radius: {
                type: 'number',
                description: 'Search radius in meters (default: 10000)'
              },
            },
              required: ['query', 'location', 'radius'],
          },
        },
        {
          name: 'verify_email',
          description: 'Verify if an email address is valid and active using SMTP verification.',
          inputSchema: {
            type: 'object',
            properties: {
              email: {
                type: 'string',
                description: 'Email address to verify',
              },
              fromEmail: {
                type: 'string',
                description: 'Email address to use as the sender in SMTP verification (optional)',
              },
            },
            required: ['email'],
          },
        },
        {
          name: 'generate_support_emails',
          description: 'generate group of support email addresses are valid and active at a domain. Checks common group email patterns.',
          inputSchema: {
            type: 'object',
            properties: {
              emails: {
                type: 'string',
                description: 'List of email prefixes to check, separated by commas (optional)',
              },
              domain: {
                type: 'string',
                description: 'Domain of the group email addresses',
              },
              fromEmail: {
                type: 'string',
                description: 'Email address to use as the sender in SMTP verification (optional)',
              },
            },
            required: ['domain'],
          },
        },
        {
          name: 'guess_email',
          description: 'Guess an email address based on name and domain using common email patterns.',
          inputSchema: {
            type: 'object',
            properties: {
              firstName: {
                type: 'string',
                description: 'First name of the person',
              },
              lastName: {
                type: 'string',
                description: 'Last name of the person',
              },
              domain: {
                type: 'string',
                description: 'Company domain name',
              },
              fromEmail: {
                type: 'string',
                description: 'Email address to use as the sender in SMTP verification (optional)',
              },
            },
            required: ['firstName', 'lastName', 'domain'],
          },
        },
        {
          name: 'check_domain_catch_all',
          description: 'Check if a domain has a catch-all email address.',
          inputSchema: {
            type: 'object',
            properties: {
              domain: {
                type: 'string',
                description: 'Domain to check',
              },
            },
            required: ['domain'],
          }
        },
        {
          name: 'get_mx_for_domain',
          description: 'get MX records for a domain.',
          inputSchema: {
            type: 'object',
            properties: {
              domain: {
                type: 'string',
                description: 'Domain to check',
              },
            },
            required: ['domain'],
          }
        },
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
              formats: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: [
                    'markdown',
                    'html',
                  ],
                },
                default: ['markdown'],
                description: "Content formats to extract (default: ['markdown'])",
              },
              onlyMainContent: {
                type: 'boolean',
                description:
                  'Extract only the main content, filtering out navigation, footers, etc.',
              },
              includeTags: {
                type: 'array',
                items: { type: 'string' },
                description: 'HTML tags to specifically include in extraction',
              },
              excludeTags: {
                type: 'array',
                items: { type: 'string' },
                description: 'HTML tags to exclude from extraction',
              },
              waitFor: {
                type: 'number',
                description: 'Time in milliseconds to wait for dynamic content to load',
              },
              timeout: {
                type: 'number',
                description:
                  'Maximum time in milliseconds to wait for the page to load',
              },
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
        {
          name: 'google_serp',
          description: 'Get Google search results for a query with page limit',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (default: 10)',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'google_map',
          description: 'Get Google Maps data for a location query, optionally at specific coordinates',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Location search query',
              },
              location: {
                type: 'string',
                description: 'Optional location parameter. If in "latitude,longitude" format (e.g., "37.7749,-122.4194"), will search at those coordinates. Otherwise, will be added to the search query.',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (default: 10)',
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
        logger.info(`Executing tool:`, args);
        switch (request.params.name) {
          case 'scrape_url': {
            let wait: any = args.wait
            wait = wait ? parseInt(wait ?? '0') : 0;
            const result = await ScrapeUrlReturnMarkdown(url, query, wait);
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
          case 'verify_email': {
            const email = args.email as string;
            const fromEmail = (args.fromEmail as string) || "test@example.com"; // Provide a default value
            const isValid = await verifyEmail(email, fromEmail);
            logger.info(`Email verification result:`, isValid);
            return {
              content: [
                {
                  type: 'text',
                  text: isValid.exists ? `Email: ${email} is valid` : `Email: ${email} is not valid`,
                },
              ],
              isError: false,
            };
          }
          case 'generate_support_emails': {
            let emails: any = args.emails as string;
            emails = emails ? emails.split(',') : [];
            emails = emails.map((email: any) => email.trim());
            const domain = args.domain as string;
            const fromEmail = (args.fromEmail as string) || `noreply@${domain}`;
            // const result = await verifyGroupEmail(emails, domain, fromEmail);
            const alreadyEmails = ['info', 'admin', 'sales', 'support', 'hello',  'contact', 'help', 'service','billing','marketing']
            emails = emails.concat(alreadyEmails)
            emails= [...new Set(emails)]
            emails = emails.map((email: any) => `${email}@${domain}`)
            logger.info(`Emails to verify:`, emails);
            let result = await Promise.all(emails.map((email: any) => verifyEmail(email, fromEmail)));
            result = result.filter((email: any) => email.exists).map((email: any) => email.email);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result),
                },
              ],
              isError: false,
            };
          }
          case 'guess_email': {
            const firstName = args.firstName as string;
            const lastName = args.lastName as string;
            const domain = args.domain as string;
            const fromEmail = (args.fromEmail as string) || undefined;
            const guessedEmail = await guessEmail({ firstName, lastName, domain, fromEmail });

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(guessedEmail),
                },
              ],
              isError: false,
            };
          }
          case 'check_domain_catch_all': {
            const domain = args.domain as string;
            const result = await isDomainCatchAll(domain);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result),
                },
              ],
              isError: false,
            };
          }
          case 'get_mx_for_domain': {
            const domain = args.domain as string;
            const result = await domainMxRecords(domain);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result),
                },
              ],
              isError: false,
            };
          }
          case 'google_serp': {
            const result = await GoogleSerp(args);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result),
                },
              ],
              isError: !result.status,
            };
          }
          case 'google_map': {
            const result = await GoogleMap(args);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result),
                },
              ],
              isError: !result.status,
            };
          }
          case 'google_places': {
            console.log(args)
            const result = await GoogleMapPlaces(args);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result),
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
