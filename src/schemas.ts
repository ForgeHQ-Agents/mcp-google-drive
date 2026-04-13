import { z } from "zod";
import { ResponseFormat } from "./types.js";

const responseFormatSchema = z
  .nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable");

const pageTokenSchema = z.string().optional().describe("Token for fetching the next page of results");

// ============================================================
// GOOGLE DRIVE SCHEMAS
// ============================================================

export const SearchDriveFilesSchema = z.object({
  query: z.string().min(1).describe(
    "Search query. Can be a simple keyword (searches names and content) or Drive query syntax " +
    "(e.g., \"name contains 'report'\", \"mimeType = 'application/vnd.google-apps.document'\"). " +
    "Combine with 'and'/'or'."
  ),
  page_size: z.number().int().min(1).max(100).default(25).describe("Max results (1-100, default: 25)"),
  page_token: pageTokenSchema,
  order_by: z.string().default("modifiedTime desc").describe("Sort order (default: 'modifiedTime desc')"),
  response_format: responseFormatSchema,
}).strict();
export type SearchDriveFilesInput = z.infer<typeof SearchDriveFilesSchema>;

export const ListDriveFolderSchema = z.object({
  folder_id: z.string().default("root").describe("Folder ID to list (default: 'root')"),
  page_size: z.number().int().min(1).max(100).default(50).describe("Max results (1-100, default: 50)"),
  page_token: pageTokenSchema,
  order_by: z.string().default("folder,name").describe("Sort order (default: 'folder,name')"),
  response_format: responseFormatSchema,
}).strict();
export type ListDriveFolderInput = z.infer<typeof ListDriveFolderSchema>;

export const GetDriveFileSchema = z.object({
  file_id: z.string().min(1).describe("The file ID to get metadata for"),
  response_format: responseFormatSchema,
}).strict();
export type GetDriveFileInput = z.infer<typeof GetDriveFileSchema>;

export const ReadDriveFileSchema = z.object({
  file_id: z.string().min(1).describe("The file ID to read"),
  export_format: z.enum(["text", "html", "csv", "pdf"]).default("text")
    .describe("Export format for Google Workspace files. 'text' default, 'csv' for Sheets."),
  response_format: responseFormatSchema,
}).strict();
export type ReadDriveFileInput = z.infer<typeof ReadDriveFileSchema>;

export const CopyDriveFileSchema = z.object({
  file_id: z.string().min(1).describe("The file ID to copy"),
  new_name: z.string().optional().describe("Name for the copy"),
  destination_folder_id: z.string().optional().describe("Folder ID to place the copy in"),
  response_format: responseFormatSchema,
}).strict();
export type CopyDriveFileInput = z.infer<typeof CopyDriveFileSchema>;

export const MoveDriveFileSchema = z.object({
  file_id: z.string().min(1).describe("The file ID to move"),
  destination_folder_id: z.string().min(1).describe("Destination folder ID"),
  response_format: responseFormatSchema,
}).strict();
export type MoveDriveFileInput = z.infer<typeof MoveDriveFileSchema>;

// ============================================================
// COMMENTS SCHEMAS
// ============================================================

export const ListCommentsSchema = z.object({
  file_id: z.string().min(1).describe("The file ID to list comments from"),
  page_size: z.number().int().min(1).max(100).default(20).describe("Max comments (default: 20)"),
  page_token: pageTokenSchema,
  include_deleted: z.boolean().default(false).describe("Include deleted comments"),
  response_format: responseFormatSchema,
}).strict();
export type ListCommentsInput = z.infer<typeof ListCommentsSchema>;

export const CreateCommentSchema = z.object({
  file_id: z.string().min(1).describe("The file ID to comment on"),
  content: z.string().min(1).describe("The comment text"),
  quoted_content: z.string().optional().describe("Text from the document to quote/highlight with this comment"),
  response_format: responseFormatSchema,
}).strict();
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;

export const ReplyToCommentSchema = z.object({
  file_id: z.string().min(1).describe("The file ID containing the comment"),
  comment_id: z.string().min(1).describe("The comment ID to reply to"),
  content: z.string().min(1).describe("The reply text"),
  response_format: responseFormatSchema,
}).strict();
export type ReplyToCommentInput = z.infer<typeof ReplyToCommentSchema>;

export const ResolveCommentSchema = z.object({
  file_id: z.string().min(1).describe("The file ID containing the comment"),
  comment_id: z.string().min(1).describe("The comment ID to resolve"),
  response_format: responseFormatSchema,
}).strict();
export type ResolveCommentInput = z.infer<typeof ResolveCommentSchema>;

// ============================================================
// GOOGLE DOCS SCHEMAS
// ============================================================

export const ReadGoogleDocSchema = z.object({
  document_id: z.string().min(1).describe("The Google Doc ID (from URL: docs.google.com/document/d/{ID}/...)"),
  response_format: responseFormatSchema,
}).strict();
export type ReadGoogleDocInput = z.infer<typeof ReadGoogleDocSchema>;

// ============================================================
// GOOGLE SHEETS SCHEMAS
// ============================================================

export const GetSpreadsheetSchema = z.object({
  spreadsheet_id: z.string().min(1).describe("The spreadsheet ID"),
  response_format: responseFormatSchema,
}).strict();
export type GetSpreadsheetInput = z.infer<typeof GetSpreadsheetSchema>;

export const ReadSheetRangeSchema = z.object({
  spreadsheet_id: z.string().min(1).describe("The spreadsheet ID"),
  range: z.string().min(1).describe("A1 notation range (e.g., 'Sheet1!A1:D10')"),
  response_format: responseFormatSchema,
}).strict();
export type ReadSheetRangeInput = z.infer<typeof ReadSheetRangeSchema>;

export const SearchSheetSchema = z.object({
  spreadsheet_id: z.string().min(1).describe("The spreadsheet ID"),
  sheet_name: z.string().min(1).describe("Sheet/tab name to search"),
  search_value: z.string().min(1).describe("Value to search for (case-insensitive)"),
  response_format: responseFormatSchema,
}).strict();
export type SearchSheetInput = z.infer<typeof SearchSheetSchema>;

export const GetSheetDataSchema = z.object({
  spreadsheet_id: z.string().min(1).describe("The spreadsheet ID"),
  sheet_name: z.string().min(1).describe("Sheet/tab name to read"),
  has_headers: z.boolean().default(true).describe("First row is headers (default: true)"),
  response_format: responseFormatSchema,
}).strict();
export type GetSheetDataInput = z.infer<typeof GetSheetDataSchema>;

export const WriteSheetRangeSchema = z.object({
  spreadsheet_id: z.string().min(1).describe("The spreadsheet ID"),
  range: z.string().min(1).describe("A1 notation range to write to (e.g., 'Sheet1!A1:C3')"),
  values: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).min(1)
    .describe("2D array of values to write. Rows × columns."),
  value_input_option: z.enum(["RAW", "USER_ENTERED"]).default("USER_ENTERED")
    .describe("RAW stores as-is; USER_ENTERED parses formulas and dates (default)"),
  response_format: responseFormatSchema,
}).strict();
export type WriteSheetRangeInput = z.infer<typeof WriteSheetRangeSchema>;

export const AppendSheetRowsSchema = z.object({
  spreadsheet_id: z.string().min(1).describe("The spreadsheet ID"),
  range: z.string().min(1).describe("A1 notation of the table to append to (e.g., 'Sheet1!A1'). Rows are appended after the last row with data."),
  values: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).min(1)
    .describe("2D array of rows to append"),
  value_input_option: z.enum(["RAW", "USER_ENTERED"]).default("USER_ENTERED")
    .describe("RAW stores as-is; USER_ENTERED parses formulas and dates (default)"),
  response_format: responseFormatSchema,
}).strict();
export type AppendSheetRowsInput = z.infer<typeof AppendSheetRowsSchema>;

export const ClearSheetRangeSchema = z.object({
  spreadsheet_id: z.string().min(1).describe("The spreadsheet ID"),
  range: z.string().min(1).describe("A1 notation range to clear (e.g., 'Sheet1!A2:D100')"),
  response_format: responseFormatSchema,
}).strict();
export type ClearSheetRangeInput = z.infer<typeof ClearSheetRangeSchema>;

// ============================================================
// GOOGLE DOCS WRITE SCHEMAS
// ============================================================

export const DocsAppendTextSchema = z.object({
  document_id: z.string().min(1).describe("The Google Doc ID"),
  text: z.string().min(1).describe("Text to append at the end of the document"),
  response_format: responseFormatSchema,
}).strict();
export type DocsAppendTextInput = z.infer<typeof DocsAppendTextSchema>;

export const DocsReplaceTextSchema = z.object({
  document_id: z.string().min(1).describe("The Google Doc ID"),
  find: z.string().min(1).describe("Text to find (plain text, not regex)"),
  replace_with: z.string().describe("Text to replace it with"),
  match_case: z.boolean().default(true).describe("Case-sensitive match (default: true)"),
  response_format: responseFormatSchema,
}).strict();
export type DocsReplaceTextInput = z.infer<typeof DocsReplaceTextSchema>;

export const DocsInsertTextSchema = z.object({
  document_id: z.string().min(1).describe("The Google Doc ID"),
  text: z.string().min(1).describe("Text to insert"),
  index: z.number().int().min(1).describe("Character index at which to insert (1-based). Use google_docs_read with response_format=json to find indices."),
  response_format: responseFormatSchema,
}).strict();
export type DocsInsertTextInput = z.infer<typeof DocsInsertTextSchema>;
