# Meerkats.ai MCP Server

This is a Model Context Protocol (MCP) server for the Meerkats.ai web scraping service. It provides tools for web scraping, RSS feed processing, and Google search.

## Features

- **Web Scraping**: Scrape any URL and get the content as markdown
- **RSS Feed Processing**: Process RSS feeds and get the content
- **Google Search**: Search Google and get the results

## Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file based on `.env.example` and add your Meerkats.ai API key
4. Build the project:
   ```
   npm run build
   ```

## Configuration

Add the MCP server to your MCP settings configuration file:

```json
{
  "mcpServers": {
    "meerkats": {
      "command": "node",
      "args": ["path/to/meerkats.ai/build/index.js"],
      "env": {
        "MEERKATS_API_KEY": "your_api_key_here",
        "SCRAPPER_API_URL": "https://api.meerkats.ai",
        "SCRAPPER_CALLBACK_API_URL": "https://api.meerkats.ai/callback"
      }
    }
  }
}
```

## Available Tools

### scrape_url

Scrape a URL and return the content as markdown.

**Parameters:**
- `url` (required): URL to scrape
- `wait` (optional): Time to wait in seconds before scraping
- `query` (optional): Query to search for on the page

### rss_feed

Process an RSS feed and return the content.

**Parameters:**
- `url` (required): URL of the RSS feed
- `wait` (optional): Time to wait in seconds before processing

### google_search

Search Google and return the results.

**Parameters:**
- `query` (required): Query to search for on Google

## Example Usage

```javascript
// Example of using the scrape_url tool
const result = await use_mcp_tool({
  server_name: "meerkats",
  tool_name: "scrape_url",
  arguments: {
    url: "https://example.com",
    wait: 2
  }
});

// Example of using the google_search tool
const searchResult = await use_mcp_tool({
  server_name: "meerkats",
  tool_name: "google_search",
  arguments: {
    query: "meerkats.ai web scraping"
  }
});
```

## License

MIT
