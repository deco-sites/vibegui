/**
 * This is where you define your workflows.
 *
 * Workflows are a way to encode complex flows of steps
 * reusing your tools and with built-in observability
 * on the Deco project dashboard. They can also do much more!
 *
 * When exported, they will be available on the MCP server
 * via built-in tools for starting, resuming and cancelling
 * them.
 *
 * @see https://docs.deco.page/en/guides/building-workflows/
 */
import {
  createStepFromTool,
  createTool,
  createWorkflow,
} from "@deco/workers-runtime/mastra";
import { z } from "zod";
import { Env } from "./main";
import {
  createDetectLanguageTool,
  createGenerateTitleExcerptTool,
  createInsertBlogPostTool,
  createGetBlogPostWithTranslationTool,
  createTranslateBlogPostTool,
  createSaveTranslationTool,
} from "./tools";

// ========== BLOG SETUP WORKFLOWS ==========

/**
 * Setup Workflow: Process a single blog post from JSON format
 * - Detect language of content
 * - Generate title and excerpt if missing (in correct language)
 * - Insert into database
 */
const createProcessBlogPostWorkflow = (env: Env) => {
  // Step 1: Create the AI processing tool
  const createProcessWithAITool = (env: Env) =>
    createTool({
      id: "PROCESS_BLOG_POST_AI",
      description: "AI processes blog post: detects language, generates title and excerpt if needed",
      inputSchema: z.object({
        content: z.string(),
        existingTitle: z.string(),
        existingExcerpt: z.string(),
        originalData: z.any().optional(), // Keep original data
      }),
      outputSchema: z.object({
        detectedLanguage: z.string(),
        finalTitle: z.string(),
        finalExcerpt: z.string(),
        wasGenerated: z.boolean(),
        originalData: z.any(), // Pass through original data
      }),
      execute: async ({ context }) => {
        const prompt = `Analise este conteúdo de blog e faça o seguinte:

1. Detecte o idioma do conteúdo (pt ou en)
2. Se o título existente estiver vazio ou for ruim, gere um título atrativo no mesmo idioma
3. Se o resumo existente estiver vazio ou for ruim, gere um resumo informativo no mesmo idioma

CONTEÚDO:
${context.content}

TÍTULO EXISTENTE: "${context.existingTitle}"
RESUMO EXISTENTE: "${context.existingExcerpt}"

Responda APENAS em JSON no formato:
{
  "detectedLanguage": "pt" ou "en",
  "finalTitle": "título final (existente ou gerado)",
  "finalExcerpt": "resumo final (existente ou gerado)",
  "wasGenerated": true se gerou novo conteúdo, false se usou existente
}`;

        const result = await env.DECO_CHAT_WORKSPACE_API.AI_GENERATE_OBJECT({
          model: "openai:gpt-4o-mini",
          messages: [{ 
            role: "user", 
            content: prompt 
          }],
          temperature: 0.3,
          schema: {
            type: "object",
            properties: {
              detectedLanguage: { type: "string" },
              finalTitle: { type: "string" },
              finalExcerpt: { type: "string" },
              wasGenerated: { type: "boolean" }
            },
            required: ["detectedLanguage", "finalTitle", "finalExcerpt", "wasGenerated"]
          }
        });

        return {
          ...result.object,
          originalData: context.originalData, // Pass through original data
        };
      },
    });

  const processWithAI = createStepFromTool(createProcessWithAITool(env), {
    name: "ai-process-content",
    displayName: "🤖 AI: Detect Language + Generate Title & Excerpt"
  });

  // Step 2: Save to database
  const insertBlogPostStep = createStepFromTool(createInsertBlogPostTool(env), {
    name: "save-to-database",
    displayName: "💾 Save Post to Database"
  });

  return createWorkflow({
    id: "PROCESS_BLOG_POST",
    inputSchema: z.object({
      id: z.string(),
      slug: z.string(),
      content: z.string(),
      title: z.string().optional(),
      excerpt: z.string().optional(),
      authorName: z.string().optional(),
      authorEmail: z.string().optional(),
      publishedDate: z.string().optional(),
      interactionCount: z.number().optional(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      postId: z.string(),
      detectedLanguage: z.string(),
      generatedTitle: z.string(),
      generatedExcerpt: z.string(),
      wasGenerated: z.boolean(),
    }),
  })
    // Step 1: AI processes everything at once
    .map(({ inputData }) => ({
      content: inputData.content,
      existingTitle: inputData.title || "",
      existingExcerpt: inputData.excerpt || "",
      // Keep original data for database
      originalData: inputData,
    }), {
      name: "prepare-ai-input",
      displayName: "📝 Prepare Content for AI"
    })
    .then(processWithAI)
    
    // Step 2: Prepare for database and save
    .map(({ inputData, getStepResult }) => {
      // Now inputData should contain the AI result with originalData preserved
      const original = inputData.originalData;
      
      if (!original || !original.id) {
        throw new Error(`Cannot find original data. inputData = ${JSON.stringify(inputData)}`);
      }
      
      return {
        id: original.id,
        originalSlug: original.slug,
        content: original.content,
        originalLanguage: inputData.detectedLanguage,
        title: inputData.finalTitle,
        excerpt: inputData.finalExcerpt,
        authorName: original.authorName || "",
        authorEmail: original.authorEmail || "",
        publishedDate: original.publishedDate || "",
        interactionCount: original.interactionCount || 0,
      };
    }, {
      name: "prepare-database-data",
      displayName: "🗄️ Prepare Database Data"
    })
    .then(insertBlogPostStep)
    
    // Step 3: Final output
    .map(({ inputData, getStepResult }) => {
      // inputData now contains the INSERT_BLOG_POST result
      const insertResult = inputData;
      
      // Get AI result from the workflow history since we need it
      const aiData = getStepResult("PROCESS_BLOG_POST_AI");
      
      // Add safety checks
      if (!insertResult) {
        throw new Error(`Insert result is null. inputData = ${JSON.stringify(inputData)}`);
      }
      
      return {
        success: insertResult.success || false,
        postId: insertResult.postId || insertResult.metadataId || "unknown",
        detectedLanguage: aiData?.detectedLanguage || "unknown",
        generatedTitle: aiData?.finalTitle || "Unknown Title",
        generatedExcerpt: aiData?.finalExcerpt || "Unknown Excerpt", 
        wasGenerated: aiData?.wasGenerated || false,
      };
    }, {
      name: "final-output",
      displayName: "✅ Prepare Final Results"
    })
    .commit();
};

/**
 * Setup Workflow: Simple validation of blog posts data
 * This validates the input data format for migration
 */
const createMigrateAllBlogPostsWorkflow = (env: Env) => {
  return createWorkflow({
    id: "MIGRATE_ALL_BLOG_POSTS",
    inputSchema: z.object({
      blogPostsData: z.array(z.object({
        id: z.string(),
        slug: z.string(),
        content: z.string(),
        title: z.string(),
        excerpt: z.string(),
        authorName: z.string().optional(),
        authorEmail: z.string().optional(),
        publishedDate: z.string().optional(),
        interactionCount: z.number().optional(),
      }))
    }),
    outputSchema: z.object({
      totalPosts: z.number(),
      postsNeedingGeneration: z.number(),
      postsWithMetadata: z.number(),
      ready: z.boolean(),
    }),
  })
    // Analyze the blog posts data
    .map(({ inputData }) => {
      const postsNeedingGeneration = inputData.blogPostsData.filter(post => 
        !post.title || !post.excerpt || post.title.trim() === "" || post.excerpt.trim() === ""
      ).length;
      
      const postsWithMetadata = inputData.blogPostsData.length - postsNeedingGeneration;
      
      return {
        totalPosts: inputData.blogPostsData.length,
        postsNeedingGeneration,
        postsWithMetadata,
        ready: true,
      };
    })
    .commit();
};

// ========== RUNTIME TRANSLATION WORKFLOW ==========

/**
 * Simplified Runtime Workflow: Get blog post with translation
 * This is a simpler approach that just checks for existing translations
 * For now, we'll focus on getting the core system working
 */
const createAutoTranslateBlogPostWorkflow = (env: Env) => {
  const getBlogPostStep = createStepFromTool(createGetBlogPostWithTranslationTool(env));

  return createWorkflow({
    id: "AUTO_TRANSLATE_BLOG_POST",
    inputSchema: z.object({
      postId: z.string(),
      targetLanguage: z.string(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      post: z.object({
        id: z.string(),
        title: z.string(),
        excerpt: z.string(),
        content: z.string(),
        language: z.string(),
        isTranslated: z.boolean(),
      }).nullable(),
      needsTranslation: z.boolean(),
    }),
  })
    // Step 1: Check if post exists and get content in requested language
    .then(getBlogPostStep)
    
    // Step 2: Prepare response
    .map(({ inputData, getStepResult }) => {
      const postResult = getStepResult(getBlogPostStep);
      
      if (postResult.post) {
        return {
          success: true,
          post: {
            id: postResult.post.id,
            title: postResult.post.title,
            excerpt: postResult.post.excerpt,
            content: postResult.post.content,
            language: postResult.post.language,
            isTranslated: postResult.post.isTranslated,
          },
          needsTranslation: false,
        };
      } else {
        return {
          success: false,
          post: null,
          needsTranslation: postResult.needsTranslation,
        };
      }
    })
    .commit();
};

// ========== TEST WORKFLOW ==========

/**
 * Test Workflow: Simple test with intentional error for development workflow testing
 */
const createTestWorkflow = (env: Env) => {
  return createWorkflow({
    id: "TEST_WORKFLOW", 
    inputSchema: z.object({
      message: z.string(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      result: z.string(),
      processedMessage: z.string(),
    }),
  })
    // Step 1: Process message (error fixed!)
    .map(({ inputData }) => {
      console.log("Starting test workflow with:", inputData.message);
      
      // ERROR FIXED: Now accepts any message including "test"
      return {
        processedMessage: `Processed: ${inputData.message}`,
        timestamp: new Date().toISOString(),
      };
    }, {
      name: "process-message",
      displayName: "🔄 Process Test Message"
    })
    
    // Step 2: Add delay to simulate work
    .map(async ({ inputData }) => {
      console.log("Adding 1 second delay...");
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        success: true,
        result: `Successfully processed at ${inputData.timestamp}`,
        processedMessage: inputData.processedMessage,
      };
    }, {
      name: "add-delay",
      displayName: "⏳ Simulate Processing Time"
    })
    .commit();
};

export const workflows = [
  createProcessBlogPostWorkflow,
  createMigrateAllBlogPostsWorkflow,
  createAutoTranslateBlogPostWorkflow,
  createTestWorkflow,
];
