# Claude Development Workflow for VibeGUI Blog System

## Local MCP Server Setup

### Starting the Server

To start the local MCP server with a consistent port:

```bash
cd vibegui-internal/server
npm start
# or
bun run dev
```

The server should always run on port **3000** for consistency. If needed, modify `main.ts` to hardcode the port.

### MCP Connection

The MCP server exposes tools for:
- Blog post management (list, create, translate)
- Workflow management (start, cancel, resume, status)
- Database operations
- AI-powered content generation

## Perfect Vibecoding Workflow Cycle

### 1. Write/Modify Workflows
Edit workflow files in `vibegui-internal/server/workflows.ts`

### 2. Refresh MCP Connection
Use Claude Code's `/mcp refresh` command to reload the MCP tools with latest changes

### 3. Test Workflows
Use the MCP tools to:
- Start workflows: `mcp__vibegui-blog__DECO_CHAT_WORKFLOWS_START_*`
- Check status: `mcp__vibegui-blog__WORKFLOW_STATUS`
- List runs: `mcp__vibegui-blog__LIST_WORKFLOW_RUNS`

### 4. Debug and Iterate
- Check workflow logs
- Modify workflow code
- Refresh MCP
- Test again

## Available MCP Tools

### Blog Management
- `LIST_BLOG_POSTS` - Get all blog posts
- `INSERT_BLOG_POST` - Add new blog post
- `TRANSLATE_BLOG_POST` - Translate content
- `GET_BLOG_POST_WITH_TRANSLATION` - Get post in specific language

### Workflow Tools
- `DECO_CHAT_WORKFLOWS_START_PROCESS_BLOG_POST` - Process single blog post
- `DECO_CHAT_WORKFLOWS_START_MIGRATE_ALL_BLOG_POSTS` - Migrate all posts
- `DECO_CHAT_WORKFLOWS_START_AUTO_TRANSLATE_BLOG_POST` - Auto-translate post
- `WORKFLOW_STATUS` - Check workflow status
- `LIST_WORKFLOW_RUNS` - Debug workflow runs

### AI Tools  
- `DETECT_LANGUAGE` - Detect content language
- `GENERATE_TITLE_EXCERPT` - Generate title and excerpt
- `CHECK_TRANSLATION` - Check if translation exists

## Development Tips

1. **Always use consistent port (3000)** for MCP server
2. **Test the complete cycle** before pushing changes
3. **Use workflow status tools** to debug issues
4. **Refresh MCP** after any workflow changes
5. **Check logs** in workflow runs for debugging

## Wishlist / Future Improvements

- [ ] Use `asTool()` to expose internal tools like get workflow
- [ ] Simplify MCP wrapper code using asTool()
- [ ] Add more debugging tools for workflow development
- [ ] Create workflow templates for common patterns

## Complete Development Workflow

### Step 1: Start MCP Server
```bash
cd vibegui-internal/server
npm run dev
```
Server will run on port 3000 with hot reload enabled.

### Step 2: Connect MCP in Claude Code
Use the `/mcp` slash command to connect to the MCP server:
```
/mcp
```
You should see "Reconnected to vibegui-blog."

### Step 3: Perfect Test Cycle
1. **Write/modify workflow** in `workflows.ts`
2. **Wait for hot reload** (automatic)
3. **Reconnect MCP** with `/mcp` command
4. **Start workflow** using MCP tools
5. **Get instance ID** from workflow start response
6. **Check status** with `WORKFLOW_STATUS` tool
7. **Debug errors** if needed, fix, and repeat

### Example Test Workflow
```typescript
// Add to workflows.ts
export const testWorkflow = workflow("TEST_WORKFLOW", async function* (input: { message: string }) {
  console.log("Starting test workflow with:", input.message);
  
  // Intentional error for testing
  if (input.message === "test") {
    throw new Error("Test error - this is expected!");
  }
  
  yield* sleep(1000);
  return { success: true, result: `Processed: ${input.message}` };
});
```

## Quick Commands

```bash
# Start server with hot reload
cd vibegui-internal/server && npm run dev

# In Claude Code - connect MCP
/mcp

# Test workflow development cycle
# 1. Edit workflows.ts
# 2. Hot reload happens automatically  
# 3. /mcp to reconnect
# 4. Use MCP tools to test
# 5. Check status with WORKFLOW_STATUS
# 6. Fix errors and repeat
```