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
  createListBlogPostsTool,
  createListBlogPostIdsOnlyTool,
  createGetSingleBlogPostTool,
  createEditBlogPostTool,
  createDeleteBlogPostTool,
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
          model: "openai:gpt-oss-120b",
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
      const aiData = getStepResult(processWithAI);
      
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

// ========== CONSISTENCY CHECK WORKFLOW ==========

/**
 * Individual Post Consistency Check: Process a single post
 * - Analyze if title and excerpt match the content
 * - Generate new title/excerpt if they are inconsistent  
 * - Update the post with corrected metadata
 */
const createSinglePostConsistencyWorkflow = (env: Env) => {
  // AI analyzes content consistency for a single post
  const createAnalyzeConsistencyTool = (env: Env) =>
    createTool({
      id: "ANALYZE_POST_CONSISTENCY",
      description: "AI analyzes if title and excerpt are consistent with content for a single post",
      inputSchema: z.object({
        post: z.object({
          id: z.string(),
          title: z.string().nullable(),
          excerpt: z.string().nullable(),
          content: z.string(),
          originalLanguage: z.string(),
        })
      }),
      outputSchema: z.object({
        postId: z.string(),
        isConsistent: z.boolean(),
        needsLanguageCorrection: z.boolean(),
        correctedLanguage: z.string().optional(),
        newTitle: z.string().optional(),
        newExcerpt: z.string().optional(),
        reasoning: z.string(),
      }),
      execute: async ({ context }) => {
        const post = context.post;
        
        if (!post.title || !post.excerpt) {
          return {
            postId: post.id,
            isConsistent: false,
            needsLanguageCorrection: false,
            reasoning: "Title or excerpt is missing",
            newTitle: "Title needs to be generated",
            newExcerpt: "Excerpt needs to be generated",
          };
        }

        const prompt = `Analyze this blog post and determine if the title and excerpt are consistent with the content and written in the correct language.

CONTENT:
${post.content}

CURRENT TITLE: "${post.title}"
CURRENT EXCERPT: "${post.excerpt}"
DETECTED LANGUAGE: ${post.originalLanguage}

Please analyze:
1. Are the title and excerpt accurate representations of the content?
2. Are they written in the same language as the content?
3. Do they capture the main ideas and tone?
4. Are they well-written and engaging?

If inconsistent, provide corrected versions in the same language as the content.

Respond in JSON format:
{
  "isConsistent": true/false,
  "needsLanguageCorrection": true/false,
  "correctedLanguage": "language code if different",
  "newTitle": "corrected title if needed",
  "newExcerpt": "corrected excerpt if needed", 
  "reasoning": "explanation of what was wrong"
}`;

        const result = await env.DECO_CHAT_WORKSPACE_API.AI_GENERATE_OBJECT({
          model: "openai:gpt-oss-120b",
          messages: [{ 
            role: "user", 
            content: prompt 
          }],
          temperature: 0.3,
          schema: {
            type: "object",
            properties: {
              isConsistent: { type: "boolean" },
              needsLanguageCorrection: { type: "boolean" },
              correctedLanguage: { type: "string" },
              newTitle: { type: "string" },
              newExcerpt: { type: "string" },
              reasoning: { type: "string" }
            },
            required: ["isConsistent", "needsLanguageCorrection", "reasoning"]
          }
        });

        return {
          postId: post.id,
          isConsistent: result.object.isConsistent,
          needsLanguageCorrection: result.object.needsLanguageCorrection || false,
          correctedLanguage: result.object.correctedLanguage,
          newTitle: result.object.newTitle,
          newExcerpt: result.object.newExcerpt,
          reasoning: result.object.reasoning,
        };
      },
    });

  const analyzeConsistencyStep = createStepFromTool(createAnalyzeConsistencyTool(env), {
    name: "analyze-single-post",
    displayName: "🔍 AI: Analyze Post Consistency"
  });

  // Update posts that need fixing
  const editBlogPostStep = createStepFromTool(createEditBlogPostTool(env), {
    name: "update-single-post",
    displayName: "✏️ Update Post Metadata"
  });

  const getSinglePostStep = createStepFromTool(createGetSingleBlogPostTool(env), {
    name: "fetch-single-post",
    displayName: "📥 Fetch Single Post Data"
  });

  // Create the prepare post step properly so it can be referenced
  const preparePostStep = {
    map: ({ inputData, getStepResult }) => {
      const postResult = getStepResult(getSinglePostStep);
      
      if (!postResult.post) {
        throw new Error(`Post not found: ${inputData.postId}`);
      }
      
      const post = postResult.post;
      
      // Thread through all the data we need for later steps
      return {
        post: {
          id: post.id,
          title: post.title,
          excerpt: post.excerpt,
          content: post.content,
          originalLanguage: post.originalLanguage,
        },
        // Thread through original workflow input data
        originalWorkflowInput: {
          postIndex: inputData.postIndex,
          dryRun: inputData.dryRun,
          postId: inputData.postId
        },
      };
    },
    config: {
      name: "prepare-post-for-analysis",
      displayName: "🎯 Prepare Post for Analysis"
    }
  };


  // Create step reference for the first step
  const prepareFetchStep = {
    name: "prepare-fetch-input",
    displayName: "🔧 Prepare Fetch Parameters"
  };

  return createWorkflow({
    id: "SINGLE_POST_CONSISTENCY_CHECK",
    inputSchema: z.object({
      postId: z.string(), // Now only requires post ID
      postIndex: z.number(),
      dryRun: z.boolean().optional().default(false),
    }),
    outputSchema: z.object({
      postId: z.string(),
      postIndex: z.number(),
      wasInconsistent: z.boolean(),
      wasUpdated: z.boolean(),
      reasoning: z.string(),
      suggestedTitle: z.string().optional(),
      suggestedExcerpt: z.string().optional(),
    }),
  })
    // Step 1: Fetch the specific post by ID
    .map(({ inputData }) => ({
      postId: inputData.postId,
      postIndex: inputData.postIndex, // Preserve for later use
      dryRun: inputData.dryRun, // Preserve for later use
    }), prepareFetchStep)
    .then(getSinglePostStep)
    
    // Step 2: Prepare the post for analysis and thread metadata through
    .map(preparePostStep.map, preparePostStep.config)
    
    // Step 3: Analyze this specific post
    .then(analyzeConsistencyStep)
    
    // Step 3b: Combine analysis result with original post data
    .map(({ inputData, getStepResult }) => {
      const analysisResult = inputData; // This is the analysis result from the previous step
      
      // Get the original workflow input data from the first step
      const firstStepResult = getStepResult(prepareFetchStep);
      
      // Get the post data from the getSinglePostStep
      const postResult = getStepResult(getSinglePostStep);
      
      if (!postResult || !postResult.post) {
        throw new Error("Could not retrieve post data from getSinglePostStep");
      }
      
      return {
        analysisResult: analysisResult,
        post: postResult.post,
        postIndex: firstStepResult ? firstStepResult.postIndex : 1,
        dryRun: firstStepResult ? firstStepResult.dryRun : false,
      };
    }, {
      name: "combine-analysis-and-post-data",
      displayName: "🔄 Combine Analysis and Post Data"
    })
    
    // Step 4: Update if inconsistent and not dry run
    .map(({ inputData, getStepResult }) => {
      const analysisResult = inputData.analysisResult;
      const isInconsistent = !analysisResult.isConsistent;
      
      if (isInconsistent && analysisResult.newTitle && analysisResult.newExcerpt) {
        return {
          postId: inputData.post.id,
          languageCode: analysisResult.correctedLanguage || inputData.post.originalLanguage,
          title: analysisResult.newTitle,
          excerpt: analysisResult.newExcerpt,
          dryRun: inputData.dryRun,
          analysisResult: analysisResult,
          postIndex: inputData.postIndex,
        };
      }
      
      // Skip update - return analysis result directly
      return {
        skipUpdate: true,
        analysisResult: analysisResult,
        postIndex: inputData.postIndex,
        dryRun: inputData.dryRun,
      };
    }, {
      name: "prepare-update-data",
      displayName: "🎯 Prepare Update Data"
    })
    
    // Step 5: Conditionally update the post
    .map(async ({ inputData, getStepResult }) => {
      // Safety check for analysisResult
      if (!inputData.analysisResult) {
        console.error("Missing analysisResult in inputData:", JSON.stringify(inputData));
        throw new Error("Missing analysisResult in workflow step");
      }
      
      if (inputData.skipUpdate) {
        // No update needed
        return {
          postId: inputData.analysisResult.postId,
          postIndex: inputData.postIndex,
          wasInconsistent: !inputData.analysisResult.isConsistent,
          wasUpdated: false,
          reasoning: inputData.analysisResult.reasoning,
          suggestedTitle: inputData.analysisResult.newTitle,
          suggestedExcerpt: inputData.analysisResult.newExcerpt,
        };
      }
      
      let wasUpdated = false;
      
      if (!inputData.dryRun) {
        try {
          const editTool = createEditBlogPostTool(env);
          await editTool.execute({
            context: {
              postId: inputData.postId,
              languageCode: inputData.languageCode,
              title: inputData.title,
              excerpt: inputData.excerpt,
            }
          });
          wasUpdated = true;
        } catch (error) {
          console.error(`Failed to update post ${inputData.postId}:`, error);
        }
      }
      
      return {
        postId: inputData.postId,
        postIndex: inputData.postIndex,
        wasInconsistent: true,
        wasUpdated: wasUpdated,
        reasoning: inputData.analysisResult.reasoning,
        suggestedTitle: inputData.analysisResult.newTitle,
        suggestedExcerpt: inputData.analysisResult.newExcerpt,
      };
    }, {
      name: "update-and-finalize",
      displayName: "✅ Update Post and Finalize"
    })
    .commit();
};

/**
 * Master Consistency Check Workflow: Orchestrate individual post workflows
 * - List blog post IDs only (optimized for workflow status)
 * - Launch individual workflows for each post ID
 * - Fire and forget pattern for parallel processing
 */
const createConsistencyCheckWorkflow = (env: Env) => {
  // Step 1: List blog post IDs only (clean for workflow status)
  const listBlogPostIdsStep = createStepFromTool(createListBlogPostIdsOnlyTool(env), {
    name: "list-post-ids",
    displayName: "📋 List Blog Post IDs Only"
  });

  // Master workflow only orchestrates individual workflows - no direct processing

  return createWorkflow({
    id: "CONSISTENCY_CHECK_BLOG_POSTS",
    inputSchema: z.object({
      dryRun: z.boolean().optional().default(false),
      limit: z.number().optional().default(10),
      offset: z.number().optional().default(0),
    }),
    outputSchema: z.object({
      totalPosts: z.number(),
      workflowsSpawned: z.number(),
      successfulSpawns: z.number(),
      failedSpawns: z.number(),
      processedRange: z.string(),
      spawnedWorkflowIds: z.array(z.string()),
      note: z.string(),
    }),
  })
    // Step 1: Get blog post IDs with pagination (clean for workflow status)
    .map(({ inputData }) => ({
      limit: inputData.limit,
      offset: inputData.offset,
    }), {
      name: "prepare-list-input",
      displayName: "📝 Prepare List Parameters with Pagination"
    })
    .then(listBlogPostIdsStep)
    
    // Step 2: Prepare post IDs for individual workflow processing (IDs only)
    .map(({ inputData, getStepResult }) => {
      const idsResult = getStepResult(listBlogPostIdsStep);
      
      const postIds = idsResult.postIds || [];
      
      // Filter to only posts with content, keep only IDs
      const validPostIds = postIds.filter(postId => postId.hasContent);
      
      return {
        postIds: validPostIds,
        dryRun: inputData.dryRun,
        offset: inputData.offset || 0,
        limit: inputData.limit || 10,
      };
    }, {
      name: "prepare-post-ids-for-workflows",
      displayName: "🎯 Prepare Post IDs for Individual Workflows"
    })
    
    // Step 3: Spawn individual workflows for each post ID (fire and forget)
    .map(async ({ inputData, getStepResult }) => {
      const spawnedWorkflows = [];
      
      for (let i = 0; i < inputData.postIds.length; i++) {
        const postId = inputData.postIds[i];
        const postIndex = (inputData.offset || 0) + i + 1;
        
        console.log(`🚀 Spawning workflow for Post ${postIndex}: ${postId.id.substring(0, 12)}...`);
        
        try {
          // Individual workflows will fetch their own full post data using the post ID
          const workflowInput = {
            postId: postId.id, // Only pass the post ID
            postIndex: postIndex,
            dryRun: inputData.dryRun,
          };
          
          // Start the individual workflow using the SELF API
          const workflowResult = await env.SELF.DECO_CHAT_WORKFLOWS_START_SINGLE_POST_CONSISTENCY_CHECK(workflowInput);
          
          const workflowData = {
            runId: workflowResult.id || workflowResult.instanceId || `single-post-${postId.id}-${Date.now()}`,
            postId: postId.id,
            postIndex: postIndex,
            status: "started",
            startTime: Date.now(),
            workflowResult: workflowResult
          };
          
          spawnedWorkflows.push(workflowData);
          console.log(`✅ Successfully spawned workflow ${workflowData.runId} for post ${postId.id}`);
          
        } catch (error) {
          console.error(`❌ Failed to spawn workflow for post ${postId.id}:`, error);
          spawnedWorkflows.push({
            runId: `failed-${postId.id}`,
            postId: postId.id,
            postIndex: postIndex,
            status: "failed",
            error: error.message
          });
        }
      }

      return {
        spawnedWorkflows: spawnedWorkflows,
        totalWorkflowsSpawned: spawnedWorkflows.length,
        originalData: inputData
      };
    }, {
      name: "spawn-individual-workflows",
      displayName: "🚀 Spawn Individual Post Workflows (Fire and Forget)"
    })
    
    // Step 4: Fire and forget - return summary of spawned workflows
    .map(({ inputData, getStepResult }) => {
      const spawnedCount = inputData.spawnedWorkflows.length;
      const successfulSpawns = inputData.spawnedWorkflows.filter(w => w.status === "started").length;
      const failedSpawns = inputData.spawnedWorkflows.filter(w => w.status === "failed").length;
      
      console.log(`🎯 Master workflow completed. Spawned ${successfulSpawns} individual workflows successfully, ${failedSpawns} failed to spawn.`);
      
      return {
        totalPosts: inputData.originalData.postIds.length,
        workflowsSpawned: spawnedCount,
        successfulSpawns: successfulSpawns,
        failedSpawns: failedSpawns,
        processedRange: `Posts ${(inputData.originalData.offset || 0) + 1}-${(inputData.originalData.offset || 0) + inputData.originalData.postIds.length}`,
        spawnedWorkflowIds: inputData.spawnedWorkflows
          .filter(w => w.status === "started")
          .map(w => w.runId),
        note: "Individual workflows are now running independently. Use WORKFLOW_STATUS or LIST_WORKFLOW_RUNS to monitor their progress."
      };
    }, {
      name: "finalize-master-workflow",
      displayName: "🎯 Finalize Master Workflow (Fire and Forget)"
    })
    .commit();
};

// ========== CLEANUP WORKFLOW ==========

/**
 * Cleanup Workflow: Delete test and setup posts
 */
const createCleanupTestPostsWorkflow = (env: Env) => {
  // Step 1: List all posts
  const listBlogPostsStep = createStepFromTool(createListBlogPostsTool(env), {
    name: "list-all-posts-cleanup",
    displayName: "📋 List All Posts for Cleanup"
  });

  // Step 2: Delete test posts
  const deleteBlogPostStep = createStepFromTool(createDeleteBlogPostTool(env), {
    name: "delete-post",
    displayName: "🗑️ Delete Test Post"
  });

  return createWorkflow({
    id: "CLEANUP_TEST_POSTS",
    inputSchema: z.object({
      dryRun: z.boolean().optional().default(true),
    }),
    outputSchema: z.object({
      totalPosts: z.number(),
      testPostsFound: z.number(),
      deletedPosts: z.number(),
      deletedPostIds: z.array(z.string()),
    }),
  })
    // Step 1: Get all posts
    .then(listBlogPostsStep)
    
    // Step 2: Identify and delete test posts
    .map(async ({ inputData, getStepResult }) => {
      const listResult = getStepResult(listBlogPostsStep);
      const posts = listResult.posts || [];
      
      // Identify test posts by ID patterns and content
      const testPostPatterns = [
        /test-post/i,
        /individual-tools-test/i,
        /debug-workflow-test/i,
        /workflow-test/i,
        /setup/i,
        /exemplo/i,
      ];
      
      const testPosts = posts.filter(post => {
        // Check ID patterns
        const hasTestId = testPostPatterns.some(pattern => pattern.test(post.id));
        
        // Check content patterns 
        const hasTestContent = post.content && (
          post.content.includes('teste completo dos tools') ||
          post.content.includes('teste de debug') ||
          post.content.includes('sistema deve detectar') ||
          post.authorName === 'Test Author' ||
          post.authorName === 'Individual Tools Test' ||
          post.authorName === 'Debug Test' ||
          post.authorName === 'Workflow Test'
        );
        
        return hasTestId || hasTestContent;
      });

      const deletedPostIds = [];
      let deletedCount = 0;

      if (!inputData.dryRun) {
        for (const testPost of testPosts) {
          try {
            const deleteTool = createDeleteBlogPostTool(env);
            const deleteResult = await deleteTool.execute({ context: { postId: testPost.id } });
            if (deleteResult.success) {
              deletedPostIds.push(testPost.id);
              deletedCount++;
            }
          } catch (error) {
            console.error(`Failed to delete test post ${testPost.id}:`, error);
          }
        }
      } else {
        // Dry run - just collect IDs
        deletedPostIds.push(...testPosts.map(p => p.id));
      }

      return {
        totalPosts: posts.length,
        testPostsFound: testPosts.length,
        deletedPosts: deletedCount,
        deletedPostIds: deletedPostIds,
      };
    }, {
      name: "cleanup-test-posts",
      displayName: "🧹 Clean Up Test Posts"
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
  createSinglePostConsistencyWorkflow,
  createConsistencyCheckWorkflow,
  createCleanupTestPostsWorkflow,
  createTestWorkflow,
];
