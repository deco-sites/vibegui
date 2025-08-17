/**
 * This is where you define your tools.
 *
 * Tools are the functions that will be available on your
 * MCP server. They can be called from any other Deco app
 * or from your front-end code via typed RPC. This is the
 * recommended way to build your Web App.
 *
 * @see https://docs.deco.page/en/guides/creating-tools/
 */
import { createPrivateTool, createTool } from "@deco/workers-runtime/mastra";
import { z } from "zod";
import type { Env } from "./main.ts";
import { todosTable, postsTable, postMetadataTable, postTranslationsTable } from "./schema.ts";
import { getDb } from "./db.ts";
import { eq } from "drizzle-orm";

/**
 * `createPrivateTool` is a wrapper around `createTool` that
 * will call `env.DECO_CHAT_REQUEST_CONTEXT.ensureAuthenticated`
 * before executing the tool.
 *
 * It automatically returns a 401 error if valid user credentials
 * are not present in the request. You can also call it manually
 * to get the user object.
 */
export const createGetUserTool = (env: Env) =>
  createPrivateTool({
    id: "GET_USER",
    description: "Get the current logged in user",
    inputSchema: z.object({}),
    outputSchema: z.object({
      id: z.string(),
      name: z.string().nullable(),
      avatar: z.string().nullable(),
      email: z.string(),
    }),
    execute: async () => {
      const user = env.DECO_CHAT_REQUEST_CONTEXT.ensureAuthenticated();

      if (!user) {
        throw new Error("User not found");
      }

      return {
        id: user.id,
        name: user.user_metadata.full_name,
        avatar: user.user_metadata.avatar_url,
        email: user.email,
      };
    },
  });

/**
 * This tool is declared as public and can be executed by anyone
 * that has access to your MCP server.
 */
export const createListTodosTool = (env: Env) =>
  createTool({
    id: "LIST_TODOS",
    description: "List all todos",
    inputSchema: z.object({}),
    outputSchema: z.object({
      todos: z.array(
        z.object({
          id: z.number(),
          title: z.string().nullable(),
          completed: z.boolean(),
        }),
      ),
    }),
    execute: async () => {
      const db = await getDb(env);
      const todos = await db.select().from(todosTable);
      return {
        todos: todos.map((todo) => ({
          ...todo,
          completed: todo.completed === 1,
        })),
      };
    },
  });

const TODO_GENERATION_SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "The title of the todo",
    },
  },
  required: ["title"],
};

export const createGenerateTodoWithAITool = (env: Env) =>
  createPrivateTool({
    id: "GENERATE_TODO_WITH_AI",
    description: "Generate a todo with AI",
    inputSchema: z.object({}),
    outputSchema: z.object({
      todo: z.object({
        id: z.number(),
        title: z.string().nullable(),
        completed: z.boolean(),
      }),
    }),
    execute: async () => {
      const db = await getDb(env);
      const generatedTodo = await env.DECO_CHAT_WORKSPACE_API
        .AI_GENERATE_OBJECT({
          model: "openai:gpt-oss-120b",
          messages: [
            {
              role: "user",
              content:
                "Generate a funny TODO title that i can add to my TODO list! Keep it short and sweet, a maximum of 10 words.",
            },
          ],
          temperature: 0.9,
          schema: TODO_GENERATION_SCHEMA,
        });

      const generatedTodoTitle = String(generatedTodo.object?.title);

      if (!generatedTodoTitle) {
        throw new Error("Failed to generate todo");
      }

      const todo = await db.insert(todosTable).values({
        title: generatedTodoTitle,
        completed: 0,
      }).returning({ id: todosTable.id });

      return {
        todo: {
          id: todo[0].id,
          title: generatedTodoTitle,
          completed: false,
        },
      };
    },
  });

export const createToggleTodoTool = (env: Env) =>
  createPrivateTool({
    id: "TOGGLE_TODO",
    description: "Toggle a todo's completion status",
    inputSchema: z.object({
      id: z.number(),
    }),
    outputSchema: z.object({
      todo: z.object({
        id: z.number(),
        title: z.string().nullable(),
        completed: z.boolean(),
      }),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);

      // First get the current todo
      const currentTodo = await db.select().from(todosTable).where(
        eq(todosTable.id, context.id),
      ).limit(1);

      if (currentTodo.length === 0) {
        throw new Error("Todo not found");
      }

      // Toggle the completed status
      const newCompletedStatus = currentTodo[0].completed === 1 ? 0 : 1;

      const updatedTodo = await db.update(todosTable)
        .set({ completed: newCompletedStatus })
        .where(eq(todosTable.id, context.id))
        .returning();

      return {
        todo: {
          id: updatedTodo[0].id,
          title: updatedTodo[0].title,
          completed: updatedTodo[0].completed === 1,
        },
      };
    },
  });

export const createDeleteTodoTool = (env: Env) =>
  createPrivateTool({
    id: "DELETE_TODO",
    description: "Delete a todo",
    inputSchema: z.object({
      id: z.number(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      deletedId: z.number(),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);

      // First check if the todo exists
      const existingTodo = await db.select().from(todosTable).where(
        eq(todosTable.id, context.id),
      ).limit(1);

      if (existingTodo.length === 0) {
        throw new Error("Todo not found");
      }

      // Delete the todo
      await db.delete(todosTable).where(eq(todosTable.id, context.id));

      return {
        success: true,
        deletedId: context.id,
      };
    },
  });

// ========== BLOG SYSTEM TOOLS ==========

const LANGUAGE_DETECTION_SCHEMA = {
  type: "object",
  properties: {
    language: {
      type: "string",
      enum: ["pt", "en", "es", "fr", "de", "it", "ja", "ko", "zh", "unknown"],
      description: "Detected language code (ISO 639-1)"
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "Confidence score for language detection"
    }
  },
  required: ["language", "confidence"]
};

const TITLE_EXCERPT_GENERATION_SCHEMA = {
  type: "object", 
  properties: {
    title: {
      type: "string",
      description: "Generated title in the same language as the content, maximum 100 characters"
    },
    excerpt: {
      type: "string", 
      description: "Generated excerpt in the same language as the content, maximum 300 characters"
    }
  },
  required: ["title", "excerpt"]
};

export const createDetectLanguageTool = (env: Env) =>
  createTool({
    id: "DETECT_LANGUAGE",
    description: "Detect language of given text content",
    inputSchema: z.object({
      content: z.string(),
    }),
    outputSchema: z.object({
      language: z.string(),
      confidence: z.number(),
    }),
    execute: async ({ context }) => {
      const result = await env.DECO_CHAT_WORKSPACE_API.AI_GENERATE_OBJECT({
        model: "openai:gpt-oss-120b",
        messages: [
          {
            role: "system",
            content: "You are a language detection expert. Analyze the given text and identify its primary language. Consider context, vocabulary, grammar patterns, and common phrases. Return the ISO 639-1 language code and confidence level."
          },
          {
            role: "user", 
            content: `Detect the language of this text:\n\n${context.content}`
          }
        ],
        temperature: 0.1,
        schema: LANGUAGE_DETECTION_SCHEMA,
      });

      if (!result.object?.language) {
        throw new Error("Failed to detect language");
      }

      return {
        language: result.object.language,
        confidence: result.object.confidence || 0.8,
      };
    },
  });

export const createGenerateTitleExcerptTool = (env: Env) =>
  createTool({
    id: "GENERATE_TITLE_EXCERPT",
    description: "Generate title and excerpt for blog content in the same language as the content",
    inputSchema: z.object({
      content: z.string(),
      detectedLanguage: z.string(),
      existingTitle: z.string().optional(),
      existingExcerpt: z.string().optional(),
    }),
    outputSchema: z.object({
      title: z.string(),
      excerpt: z.string(),
    }),
    execute: async ({ context }) => {
      // If both title and excerpt already exist, return them as-is
      if (context.existingTitle && context.existingTitle.trim() && 
          context.existingExcerpt && context.existingExcerpt.trim()) {
        return {
          title: context.existingTitle.trim(),
          excerpt: context.existingExcerpt.trim(),
        };
      }

      const languagePrompts = {
        pt: "Gere um título e um resumo/excerpt para este conteúdo de blog em português. O título deve ser atrativo e ter no máximo 100 caracteres. O resumo deve ser informativo e ter no máximo 300 caracteres.",
        en: "Generate a title and excerpt for this blog content in English. The title should be engaging and maximum 100 characters. The excerpt should be informative and maximum 300 characters.",
        es: "Genera un título y un resumen para este contenido del blog en español. El título debe ser atractivo y tener máximo 100 caracteres. El resumen debe ser informativo y tener máximo 300 caracteres.",
      };

      const prompt = languagePrompts[context.detectedLanguage as keyof typeof languagePrompts] || languagePrompts.en;

      const result = await env.DECO_CHAT_WORKSPACE_API.AI_GENERATE_OBJECT({
        model: "openai:gpt-oss-120b",
        messages: [
          {
            role: "system",
            content: "You are a content editor specializing in creating engaging titles and excerpts for blog posts. Generate content that matches the language and tone of the original text."
          },
          {
            role: "user",
            content: `${prompt}\n\nConteúdo:\n${context.content}`
          }
        ],
        temperature: 0.3,
        schema: TITLE_EXCERPT_GENERATION_SCHEMA,
      });

      if (!result.object?.title || !result.object?.excerpt) {
        throw new Error("Failed to generate title and excerpt");
      }

      return {
        title: result.object.title,
        excerpt: result.object.excerpt,
      };
    },
  });

export const createInsertBlogPostTool = (env: Env) =>
  createTool({
    id: "INSERT_BLOG_POST",
    description: "Insert a blog post with metadata into the database",
    inputSchema: z.object({
      id: z.string(),
      originalSlug: z.string(),
      content: z.string(),
      originalLanguage: z.string(),
      title: z.string(),
      excerpt: z.string(),
      authorName: z.string().optional(),
      authorEmail: z.string().optional(),
      publishedDate: z.string().optional(),
      interactionCount: z.number().optional(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      postId: z.string(),
      metadataId: z.string(),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);

      try {
        // Insert main post record
        await db.insert(postsTable).values({
          id: context.id,
          originalSlug: context.originalSlug,
          content: context.content,
          originalLanguage: context.originalLanguage,
          authorName: context.authorName || null,
          authorEmail: context.authorEmail || null,
          publishedDate: context.publishedDate || null,
          interactionCount: context.interactionCount || 0,
        });

        // Insert post metadata (title and excerpt in original language)
        const metadataId = `${context.id}_${context.originalLanguage}`;
        await db.insert(postMetadataTable).values({
          id: metadataId,
          postId: context.id,
          languageCode: context.originalLanguage,
          title: context.title,
          excerpt: context.excerpt,
        });

        return {
          success: true,
          postId: context.id,
          metadataId: metadataId,
        };
      } catch (error) {
        console.error("Failed to insert blog post:", error);
        throw new Error(`Failed to insert blog post: ${error}`);
      }
    },
  });

export const createListBlogPostsTool = (env: Env) =>
  createTool({
    id: "LIST_BLOG_POSTS",
    description: "List all blog posts with their metadata",
    inputSchema: z.object({
      limit: z.number().optional(),
      offset: z.number().optional(),
    }),
    outputSchema: z.object({
      posts: z.array(z.object({
        id: z.string(),
        originalSlug: z.string(),
        content: z.string(),
        originalLanguage: z.string(),
        title: z.string().nullable(),
        excerpt: z.string().nullable(),
        authorName: z.string().nullable(),
        publishedDate: z.string().nullable(),
        interactionCount: z.number(),
        createdAt: z.string().nullable(),
      })),
      total: z.number(),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);

      // Get posts with their original language metadata
      const posts = await db.select({
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
      .limit(context.limit || 100)
      .offset(context.offset || 0);

      return {
        posts: posts,
        total: posts.length,
      };
    },
  });

export const createListBlogPostIdsOnlyTool = (env: Env) =>
  createTool({
    id: "LIST_BLOG_POST_IDS_ONLY",
    description: "List blog post IDs only - minimal data for clean workflow status",
    inputSchema: z.object({
      limit: z.number().optional(),
      offset: z.number().optional(),
    }),
    outputSchema: z.object({
      postIds: z.array(z.object({
        id: z.string(),
        hasContent: z.boolean(),
      })),
      total: z.number(),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);

      // Get only post IDs and content existence - no titles, excerpts, or other metadata
      const posts = await db.select({
        id: postsTable.id,
        content: postsTable.content,
      })
      .from(postsTable)
      .limit(context.limit || 100)
      .offset(context.offset || 0);

      return {
        postIds: posts.map(post => ({
          id: post.id,
          hasContent: !!post.content && post.content.trim().length > 0,
        })),
        total: posts.length,
      };
    },
  });

export const createGetSingleBlogPostTool = (env: Env) =>
  createTool({
    id: "GET_SINGLE_BLOG_POST",
    description: "Get a single blog post by ID with full content and metadata",
    inputSchema: z.object({
      postId: z.string(),
    }),
    outputSchema: z.object({
      post: z.object({
        id: z.string(),
        originalSlug: z.string(),
        content: z.string(),
        originalLanguage: z.string(),
        title: z.string().nullable(),
        excerpt: z.string().nullable(),
        authorName: z.string().nullable(),
        publishedDate: z.string().nullable(),
        interactionCount: z.number(),
        createdAt: z.string().nullable(),
      }).nullable(),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);

      // Get the specific post with its original language metadata
      const posts = await db.select({
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
      .where(eq(postsTable.id, context.postId))
      .limit(1);

      if (posts.length === 0) {
        return { post: null };
      }

      return { post: posts[0] };
    },
  });

export const createEditBlogPostTool = (env: Env) =>
  createTool({
    id: "EDIT_BLOG_POST",
    description: "Update blog post title and excerpt",
    inputSchema: z.object({
      postId: z.string(),
      languageCode: z.string(),
      title: z.string(),
      excerpt: z.string(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      updatedPost: z.object({
        id: z.string(),
        title: z.string(),
        excerpt: z.string(),
        languageCode: z.string(),
      }),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);

      try {
        // Update the post metadata
        await db.update(postMetadataTable)
          .set({ 
            title: context.title,
            excerpt: context.excerpt,
          })
          .where(eq(postMetadataTable.postId, context.postId));

        return {
          success: true,
          updatedPost: {
            id: context.postId,
            title: context.title,
            excerpt: context.excerpt,
            languageCode: context.languageCode,
          },
        };
      } catch (error) {
        console.error("Failed to edit blog post:", error);
        throw new Error(`Failed to edit blog post: ${error}`);
      }
    },
  });

export const createDeleteBlogPostTool = (env: Env) =>
  createTool({
    id: "DELETE_BLOG_POST",
    description: "Delete a blog post and all its metadata/translations",
    inputSchema: z.object({
      postId: z.string(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      deletedPostId: z.string(),
      deletedItems: z.object({
        post: z.boolean(),
        metadata: z.boolean(),
        translations: z.boolean(),
      }),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);

      try {
        // Delete in order: translations, metadata, then main post
        await db.delete(postTranslationsTable).where(eq(postTranslationsTable.postId, context.postId));
        await db.delete(postMetadataTable).where(eq(postMetadataTable.postId, context.postId));
        await db.delete(postsTable).where(eq(postsTable.id, context.postId));

        return {
          success: true,
          deletedPostId: context.postId,
          deletedItems: {
            post: true,
            metadata: true,
            translations: true,
          },
        };
      } catch (error) {
        console.error("Failed to delete blog post:", error);
        throw new Error(`Failed to delete blog post: ${error}`);
      }
    },
  });

// ========== TRANSLATION RUNTIME TOOLS ==========

const TRANSLATION_SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Translated title"
    },
    excerpt: {
      type: "string", 
      description: "Translated excerpt"
    },
    content: {
      type: "string",
      description: "Translated content"
    }
  },
  required: ["title", "excerpt", "content"]
};

export const createCheckTranslationTool = (env: Env) =>
  createTool({
    id: "CHECK_TRANSLATION",
    description: "Check if a blog post has translation for a specific language",
    inputSchema: z.object({
      postId: z.string(),
      languageCode: z.string(),
    }),
    outputSchema: z.object({
      hasTranslation: z.boolean(),
      translation: z.object({
        id: z.string(),
        title: z.string(),
        excerpt: z.string(),
        translatedContent: z.string().nullable(),
        isStale: z.boolean(),
      }).nullable(),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);

      const translation = await db.select()
        .from(postTranslationsTable)
        .where(eq(postTranslationsTable.postId, context.postId))
        .limit(1);

      if (translation.length === 0) {
        return { hasTranslation: false, translation: null };
      }

      return {
        hasTranslation: true,
        translation: {
          id: translation[0].id,
          title: translation[0].title,
          excerpt: translation[0].excerpt,
          translatedContent: translation[0].translatedContent,
          isStale: translation[0].isStale === 1,
        },
      };
    },
  });

export const createTranslateBlogPostTool = (env: Env) =>
  createTool({
    id: "TRANSLATE_BLOG_POST",
    description: "Translate blog post content, title and excerpt to target language",
    inputSchema: z.object({
      postId: z.string(),
      originalContent: z.string(),
      originalTitle: z.string(),
      originalExcerpt: z.string(),
      originalLanguage: z.string(),
      targetLanguage: z.string(),
    }),
    outputSchema: z.object({
      translatedTitle: z.string(),
      translatedExcerpt: z.string(),
      translatedContent: z.string(),
    }),
    execute: async ({ context }) => {
      const languageNames = {
        pt: "português",
        en: "English", 
        es: "español",
        fr: "français",
        de: "Deutsch",
        it: "italiano",
        ja: "日本語",
        ko: "한국어",
        zh: "中文"
      };

      const sourceLang = languageNames[context.originalLanguage as keyof typeof languageNames] || context.originalLanguage;
      const targetLang = languageNames[context.targetLanguage as keyof typeof languageNames] || context.targetLanguage;

      const prompt = `You are a professional translator. Translate the following blog post content from ${sourceLang} to ${targetLang}. 

Maintain the tone, style, and meaning of the original text. Keep technical terms and proper nouns appropriate for the target language audience.

ORIGINAL TITLE: ${context.originalTitle}
ORIGINAL EXCERPT: ${context.originalExcerpt}  
ORIGINAL CONTENT: ${context.originalContent}

Provide accurate, natural translations that read well in ${targetLang}.`;

      const result = await env.DECO_CHAT_WORKSPACE_API.AI_GENERATE_OBJECT({
        model: "openai:gpt-oss-120b",
        messages: [
          {
            role: "system",
            content: "You are a professional translator specializing in blog content. Provide accurate, natural translations that maintain the original tone and meaning."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        schema: TRANSLATION_SCHEMA,
      });

      if (!result.object?.title || !result.object?.excerpt || !result.object?.content) {
        throw new Error("Failed to translate blog post content");
      }

      return {
        translatedTitle: result.object.title,
        translatedExcerpt: result.object.excerpt,
        translatedContent: result.object.content,
      };
    },
  });

export const createSaveTranslationTool = (env: Env) =>
  createTool({
    id: "SAVE_TRANSLATION",
    description: "Save translated blog post to database",
    inputSchema: z.object({
      postId: z.string(),
      languageCode: z.string(),
      translatedTitle: z.string(),
      translatedExcerpt: z.string(),
      translatedContent: z.string(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      translationId: z.string(),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);

      try {
        const translationId = `${context.postId}_${context.languageCode}_${Date.now()}`;
        
        await db.insert(postTranslationsTable).values({
          id: translationId,
          postId: context.postId,
          languageCode: context.languageCode,
          title: context.translatedTitle,
          excerpt: context.translatedExcerpt,
          translatedContent: context.translatedContent,
          isStale: 0, // Fresh translation
        });

        return {
          success: true,
          translationId: translationId,
        };
      } catch (error) {
        console.error("Failed to save translation:", error);
        throw new Error(`Failed to save translation: ${error}`);
      }
    },
  });

export const createGetBlogPostWithTranslationTool = (env: Env) =>
  createTool({
    id: "GET_BLOG_POST_WITH_TRANSLATION",
    description: "Get blog post with content in requested language (original or translated)",
    inputSchema: z.object({
      postId: z.string(),
      languageCode: z.string(),
    }),
    outputSchema: z.object({
      post: z.object({
        id: z.string(),
        originalSlug: z.string(),
        title: z.string(),
        excerpt: z.string(),
        content: z.string(),
        language: z.string(),
        isTranslated: z.boolean(),
        authorName: z.string().nullable(),
        publishedDate: z.string().nullable(),
        interactionCount: z.number(),
      }).nullable(),
      needsTranslation: z.boolean(),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);

      // First, get the original post
      const originalPost = await db.select()
        .from(postsTable)
        .where(eq(postsTable.id, context.postId))
        .limit(1);

      if (originalPost.length === 0) {
        return { post: null, needsTranslation: false };
      }

      const post = originalPost[0];

      // If requesting original language, get from post_metadata
      if (context.languageCode === post.originalLanguage) {
        const metadata = await db.select()
          .from(postMetadataTable)
          .where(eq(postMetadataTable.postId, context.postId))
          .limit(1);

        if (metadata.length > 0) {
          return {
            post: {
              id: post.id,
              originalSlug: post.originalSlug,
              title: metadata[0].title,
              excerpt: metadata[0].excerpt,
              content: post.content,
              language: post.originalLanguage,
              isTranslated: false,
              authorName: post.authorName,
              publishedDate: post.publishedDate,
              interactionCount: post.interactionCount,
            },
            needsTranslation: false,
          };
        }
      }

      // Check if translation exists
      const translation = await db.select()
        .from(postTranslationsTable)
        .where(eq(postTranslationsTable.postId, context.postId))
        .limit(1);

      if (translation.length > 0) {
        return {
          post: {
            id: post.id,
            originalSlug: post.originalSlug,
            title: translation[0].title,
            excerpt: translation[0].excerpt,
            content: translation[0].translatedContent || post.content,
            language: context.languageCode,
            isTranslated: true,
            authorName: post.authorName,
            publishedDate: post.publishedDate,
            interactionCount: post.interactionCount,
          },
          needsTranslation: false,
        };
      }

      // No translation exists
      return {
        post: null,
        needsTranslation: true,
      };
    },
  });

// ========== NATIVE HOSTING TOOLS ==========

export const createWorkflowStatusTool = (env: Env) =>
  createTool({
    id: "WORKFLOW_STATUS",
    description: "Get the status of a workflow instance",
    inputSchema: z.object({
      instanceId: z.string(),
      workflowName: z.string(),
    }),
    outputSchema: z.any(),
    execute: async ({ context }) => {
      return await env.DECO_CHAT_WORKSPACE_API.HOSTING_APP_WORKFLOWS_STATUS({
        instanceId: context.instanceId,
        workflowName: context.workflowName,
      });
    },
  });

export const createListWorkflowRunsTool = (env: Env) =>
  createTool({
    id: "LIST_WORKFLOW_RUNS",
    description: "List workflow runs for debugging",
    inputSchema: z.object({
      workflowName: z.string().optional(),
      page: z.number().optional(),
      per_page: z.number().optional(),
    }),
    outputSchema: z.any(),
    execute: async ({ context }) => {
      return await env.DECO_CHAT_WORKSPACE_API.HOSTING_APP_WORKFLOWS_LIST_RUNS({
        workflowName: context.workflowName,
        page: context.page || 1,
        per_page: context.per_page || 20,
      });
    },
  });


export const tools = [
  createGetUserTool,
  createListTodosTool,
  createGenerateTodoWithAITool,
  createToggleTodoTool,
  createDeleteTodoTool,
  // Blog system tools
  createDetectLanguageTool,
  createGenerateTitleExcerptTool,
  createInsertBlogPostTool,
  createListBlogPostsTool,
  createListBlogPostIdsOnlyTool,
  createGetSingleBlogPostTool,
  createEditBlogPostTool,
  createDeleteBlogPostTool,
  // Translation runtime tools
  createCheckTranslationTool,
  createTranslateBlogPostTool,
  createSaveTranslationTool,
  createGetBlogPostWithTranslationTool,
  // Native hosting tools (wrapped)
  createWorkflowStatusTool,
  createListWorkflowRunsTool,
];
