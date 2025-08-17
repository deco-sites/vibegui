# Self-Translating Blog System

## Overview

This system transforms your existing blog posts into a dynamic, multilingual blog with automatic AI-powered translation capabilities. It consists of setup workflows (run once) and runtime workflows (triggered by user requests).

## 🎯 Key Features

- **Automatic language detection** for existing content
- **AI-powered title/excerpt generation** for posts missing metadata
- **On-demand translation** to any supported language
- **Database-backed** with D1 for scalability
- **Stale detection** for translations when original content changes
- **MCP-powered** workflows visible in deco.chat interface

## 📊 Current Analysis

From your existing 51 blog posts:
- **13 posts (25.5%)** need title/excerpt generation
- **38 posts (74.5%)** have complete metadata
- **Language distribution**: 76.5% Portuguese, 19.6% English
- **13 posts** have language mismatches between title and content

## 🗄️ Database Schema

### `posts` - Main blog content
- `id` (primary key)
- `originalSlug` - Original slug from JSON files
- `content` - Clean text content (HTML stripped)
- `originalLanguage` - Detected language (pt, en, etc.)
- `authorName`, `authorEmail`, `publishedDate`, `interactionCount`
- Timestamps: `createdAt`, `updatedAt`

### `post_metadata` - Original language titles/excerpts
- `id` (primary key)
- `postId` - Links to posts table
- `languageCode` - Language of title/excerpt
- `title`, `excerpt` - Generated or existing metadata

### `post_translations` - Auto-generated translations
- `id` (primary key)
- `postId` - Links to posts table  
- `languageCode` - Target language
- `title`, `excerpt`, `translatedContent` - Translated content
- `isStale` - Whether translation needs updating
- `translatedAt` - When translation was created

## 🔧 Tools Available

### Setup Tools
- **`DETECT_LANGUAGE`** - Detect content language with confidence scoring
- **`GENERATE_TITLE_EXCERPT`** - Generate title/excerpt in content's language
- **`INSERT_BLOG_POST`** - Insert post with metadata to database
- **`LIST_BLOG_POSTS`** - List all posts with metadata

### Runtime Tools  
- **`CHECK_TRANSLATION`** - Check if translation exists for language
- **`TRANSLATE_BLOG_POST`** - AI-translate content to target language
- **`SAVE_TRANSLATION`** - Save translation to database
- **`GET_BLOG_POST_WITH_TRANSLATION`** - Get post in requested language

## ⚙️ Workflows

### Setup Workflows (Run Once)

#### `PROCESS_BLOG_POST`
Processes a single blog post:
1. Detect content language
2. Generate title/excerpt if missing (in correct language)
3. Insert post and metadata to database

**Input:**
```json
{
  "id": "7242328454828830721",
  "slug": "7242328454828830721", 
  "content": "Todo dia eu durmo feliz...",
  "title": "",
  "excerpt": "",
  "authorName": "Guilherme Rodrigues",
  "publishedDate": "2024-09-19",
  "interactionCount": 172
}
```

#### `MIGRATE_ALL_BLOG_POSTS`
Bulk migration of all blog posts from JSON to database.

### Runtime Workflows (Triggered by Users)

#### `AUTO_TRANSLATE_BLOG_POST`
Automatically translates a post when requested in a new language:
1. Check if translation already exists
2. If not, translate content, title, and excerpt
3. Save translation to database
4. Return translated content

**Input:**
```json
{
  "postId": "7242328454828830721",
  "targetLanguage": "en"
}
```

## 🚀 Getting Started

### 1. Start Development Server
```bash
cd vibegui-internal
npm run dev
```

Your MCP server will be available at the URL shown in the terminal output.

### 2. Generate Types (if needed)
```bash
npm run gen:self
```

### 3. Prepare Migration Data
```bash
node scripts/prepare_blog_migration.js
```

This creates `scripts/blog_posts_for_migration.json` with all 51 posts ready for migration.

### 4. Run Workflows via deco.chat

1. Go to your deco.chat workspace interface
2. Find your MCP app in the available tools
3. Use the workflows:

**For testing individual posts:**
- Use `PROCESS_BLOG_POST` with sample data from the preparation script

**For bulk migration:**
- Use `MIGRATE_ALL_BLOG_POSTS` with the full JSON array

**For runtime translation:**
- Use `AUTO_TRANSLATE_BLOG_POST` with any post ID and target language

## 📝 Sample Usage

### Testing Individual Post Processing
```json
{
  "id": "test_7242328454828830721",
  "slug": "7242328454828830721",
  "content": "Todo dia eu durmo feliz por saber que a minha empresa não vende vício, jogo e aposta pra pagar as contas. Boa noite!",
  "title": "",
  "excerpt": "",
  "authorName": "Guilherme Rodrigues",
  "publishedDate": "2024-09-19",
  "interactionCount": 172
}
```

### Testing Translation
```json
{
  "postId": "test_7242328454828830721",
  "targetLanguage": "en"
}
```

Expected behavior:
1. Detects Portuguese content
2. Generates Portuguese title like "Dormindo com a consciência tranquila"
3. Generates Portuguese excerpt
4. Translates everything to English when requested

## 🔮 Next Steps

The main remaining task is integrating this D1 database system with your deco.cx blog runtime. This will likely involve:

1. **API endpoints** in your deco.cx site to query the MCP server
2. **Frontend integration** with language switching UI
3. **Caching strategy** for translated content
4. **Content serving logic** that checks for translations and triggers workflows as needed

The current system is ready for immediate use through the deco.chat interface, and all the core functionality is implemented and tested.

## 🎉 What You've Built

- ✅ **Complete database schema** for multilingual blog
- ✅ **AI-powered content processing** with language detection
- ✅ **Automatic title/excerpt generation** for incomplete posts
- ✅ **Professional translation system** with caching
- ✅ **Setup workflows** for one-time migration
- ✅ **Runtime workflows** for on-demand translation
- ✅ **51 blog posts** ready for migration
- ✅ **Full MCP integration** with observable workflows

Your generative self-translating blog system is ready! 🚀