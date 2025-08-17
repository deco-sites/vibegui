#!/usr/bin/env node

/**
 * Standalone MCP Server for Claude Desktop
 * This creates a native MCP server that exposes the blog tools
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';

// Import drizzle
import { eq } from 'drizzle-orm';
import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core';

// Define schema inline (copied from schema.ts)
const postsTable = sqliteTable("posts", {
  id: text("id").primaryKey(),
  originalSlug: text("original_slug").notNull().unique(),
  content: text("content").notNull(),
  originalLanguage: text("original_language").notNull(),
  authorName: text("author_name"),
  authorEmail: text("author_email"),
  publishedDate: text("published_date"),
  interactionCount: integer("interaction_count").default(0),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
});

const postMetadataTable = sqliteTable("post_metadata", {
  id: text("id").primaryKey(),
  postId: text("post_id").notNull(),
  languageCode: text("language_code").notNull(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull(),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
});

const postTranslationsTable = sqliteTable("post_translations", {
  id: text("id").primaryKey(),
  postId: text("post_id").notNull(),
  languageCode: text("language_code").notNull(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull(),
  translatedContent: text("translated_content"),
  isStale: integer("is_stale").default(0),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
});

// Create database connection (using local SQLite for MCP)
const sqlite = new Database('./blog.db');
const db = drizzle(sqlite);

// Create the MCP server
const server = new Server(
  {
    name: 'vibegui-blog-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_blog_posts',
        description: 'List all blog posts from the database',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of posts to return',
              default: 50
            },
            offset: {
              type: 'number', 
              description: 'Number of posts to skip',
              default: 0
            }
          }
        }
      },
      {
        name: 'get_blog_post',
        description: 'Get a specific blog post by ID',
        inputSchema: {
          type: 'object',
          properties: {
            postId: {
              type: 'string',
              description: 'The ID of the blog post to retrieve',
              required: true
            },
            languageCode: {
              type: 'string',
              description: 'Language code for translation (pt, en, etc)',
              default: 'en'
            }
          },
          required: ['postId']
        }
      },
      {
        name: 'search_blog_posts',
        description: 'Search blog posts by title or content',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query string',
              required: true
            },
            language: {
              type: 'string',
              description: 'Filter by language (pt, en, etc)',
            }
          },
          required: ['query']
        }
      },
      {
        name: 'get_blog_stats',
        description: 'Get statistics about the blog posts',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ]
  };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_blog_posts': {
        const limit = args?.limit || 50;
        const offset = args?.offset || 0;

        const posts = await db
          .select({
            id: postsTable.id,
            originalSlug: postsTable.originalSlug,
            content: postsTable.content,
            originalLanguage: postsTable.originalLanguage,
            title: postMetadataTable.title,
            excerpt: postMetadataTable.excerpt,
            authorName: postsTable.authorName,
            publishedDate: postsTable.publishedDate,
            interactionCount: postsTable.interactionCount,
            createdAt: postsTable.createdAt,
          })
          .from(postsTable)
          .leftJoin(
            postMetadataTable,
            eq(postsTable.id, postMetadataTable.postId)
          )
          .limit(limit)
          .offset(offset);

        return {
          content: [
            {
              type: 'text',
              text: `Found ${posts.length} blog posts:\n\n` +
                posts.map((post, i) => 
                  `${i + 1}. **${post.title || 'No title'}** (${post.originalLanguage || 'unknown'})\n` +
                  `   ID: ${post.id}\n` +
                  `   Author: ${post.authorName || 'Unknown'}\n` +
                  `   Excerpt: ${(post.excerpt || 'No excerpt').substring(0, 100)}...\n`
                ).join('\n')
            }
          ]
        };
      }

      case 'get_blog_post': {
        const { postId, languageCode = 'en' } = args;

        // First get the original post
        const originalPost = await db
          .select()
          .from(postsTable)
          .where(eq(postsTable.id, postId))
          .limit(1);

        if (originalPost.length === 0) {
          return {
            content: [{
              type: 'text',
              text: `Blog post with ID "${postId}" not found.`
            }]
          };
        }

        const post = originalPost[0];

        // Get metadata
        const metadata = await db
          .select()
          .from(postMetadataTable)
          .where(eq(postMetadataTable.postId, postId))
          .limit(1);

        const meta = metadata[0];

        return {
          content: [
            {
              type: 'text',
              text: `# ${meta?.title || 'No title'}\n\n` +
                `**ID:** ${post.id}\n` +
                `**Language:** ${post.originalLanguage}\n` +
                `**Author:** ${post.authorName || 'Unknown'}\n` +
                `**Published:** ${post.publishedDate || 'Unknown'}\n` +
                `**Interactions:** ${post.interactionCount || 0}\n\n` +
                `## Excerpt\n${meta?.excerpt || 'No excerpt'}\n\n` +
                `## Content\n${post.content}`
            }
          ]
        };
      }

      case 'search_blog_posts': {
        const { query, language } = args;

        let searchQuery = db
          .select({
            id: postsTable.id,
            originalSlug: postsTable.originalSlug,
            originalLanguage: postsTable.originalLanguage,
            title: postMetadataTable.title,
            excerpt: postMetadataTable.excerpt,
            authorName: postsTable.authorName,
            content: postsTable.content
          })
          .from(postsTable)
          .leftJoin(
            postMetadataTable,
            eq(postsTable.id, postMetadataTable.postId)
          );

        // Apply language filter if specified
        if (language) {
          searchQuery = searchQuery.where(eq(postsTable.originalLanguage, language));
        }

        const allPosts = await searchQuery;

        // Simple text search (case insensitive)
        const searchTerm = query.toLowerCase();
        const matchingPosts = allPosts.filter(post => 
          (post.title?.toLowerCase().includes(searchTerm)) ||
          (post.excerpt?.toLowerCase().includes(searchTerm)) ||
          (post.content?.toLowerCase().includes(searchTerm))
        );

        return {
          content: [
            {
              type: 'text',
              text: `Found ${matchingPosts.length} posts matching "${query}":\n\n` +
                matchingPosts.map((post, i) => 
                  `${i + 1}. **${post.title || 'No title'}** (${post.originalLanguage})\n` +
                  `   ID: ${post.id}\n` +
                  `   Author: ${post.authorName || 'Unknown'}\n` +
                  `   Excerpt: ${(post.excerpt || 'No excerpt').substring(0, 100)}...\n`
                ).join('\n')
            }
          ]
        };
      }

      case 'get_blog_stats': {
        const allPosts = await db.select().from(postsTable);
        
        const stats = {
          total: allPosts.length,
          byLanguage: {},
          byAuthor: {},
          withTitles: 0,
          withExcerpts: 0
        };

        // Get metadata for stats
        const allMetadata = await db.select().from(postMetadataTable);
        const metaMap = {};
        allMetadata.forEach(meta => {
          metaMap[meta.postId] = meta;
        });

        allPosts.forEach(post => {
          // Count by language
          const lang = post.originalLanguage || 'unknown';
          stats.byLanguage[lang] = (stats.byLanguage[lang] || 0) + 1;

          // Count by author
          const author = post.authorName || 'Unknown';
          stats.byAuthor[author] = (stats.byAuthor[author] || 0) + 1;

          // Count posts with titles/excerpts
          const meta = metaMap[post.id];
          if (meta?.title) stats.withTitles++;
          if (meta?.excerpt) stats.withExcerpts++;
        });

        return {
          content: [
            {
              type: 'text',
              text: `# Blog Statistics\n\n` +
                `**Total Posts:** ${stats.total}\n` +
                `**Posts with Titles:** ${stats.withTitles}\n` +
                `**Posts with Excerpts:** ${stats.withExcerpts}\n\n` +
                `## By Language\n` +
                Object.entries(stats.byLanguage)
                  .map(([lang, count]) => `- ${lang}: ${count} posts`)
                  .join('\n') +
                `\n\n## By Author\n` +
                Object.entries(stats.byAuthor)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 10)
                  .map(([author, count]) => `- ${author}: ${count} posts`)
                  .join('\n')
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error executing tool "${name}": ${error.message}`
        }
      ],
      isError: true
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Blog Server started successfully');
}

main().catch(console.error);