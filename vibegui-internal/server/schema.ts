/**
 * This file is used to define the schema for the database.
 * 
 * After making changes to this file, run `npm run db:generate` to generate the migration file.
 * Then, by just using the app, the migration is lazily ensured at runtime.
 */
import { integer, sqliteTable, text } from "@deco/workers-runtime/drizzle";

export const todosTable = sqliteTable("todos", {
  id: integer("id").primaryKey(),
  title: text("title"),
  completed: integer("completed").default(0),
});

// Blog posts schema for self-translating blog system
export const postsTable = sqliteTable("posts", {
  id: text("id").primaryKey(),
  originalSlug: text("original_slug").notNull().unique(),
  content: text("content").notNull(),
  originalLanguage: text("original_language").notNull(), // detected language (pt, en, etc.)
  authorName: text("author_name"),
  authorEmail: text("author_email"),
  publishedDate: text("published_date"),
  interactionCount: integer("interaction_count").default(0),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
});

// Post metadata in original language (titles, excerpts)
export const postMetadataTable = sqliteTable("post_metadata", {
  id: text("id").primaryKey(),
  postId: text("post_id").notNull(),
  languageCode: text("language_code").notNull(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull(),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

// Translations table for auto-generated translations
export const postTranslationsTable = sqliteTable("post_translations", {
  id: text("id").primaryKey(),
  postId: text("post_id").notNull(),
  languageCode: text("language_code").notNull(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull(),
  translatedContent: text("translated_content"),
  translatedAt: text("translated_at").default("CURRENT_TIMESTAMP"),
  isStale: integer("is_stale").default(0), // 0 = false, 1 = true
});
