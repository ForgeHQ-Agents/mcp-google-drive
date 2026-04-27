#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as client from "./client.js";
import * as formatters from "./formatters.js";
import {
  SearchDriveFilesSchema, type SearchDriveFilesInput,
  ListDriveFolderSchema, type ListDriveFolderInput,
  GetDriveFileSchema, type GetDriveFileInput,
  ReadDriveFileSchema, type ReadDriveFileInput,
  CopyDriveFileSchema, type CopyDriveFileInput,
  MoveDriveFileSchema, type MoveDriveFileInput,
  ListCommentsSchema, type ListCommentsInput,
  CreateCommentSchema, type CreateCommentInput,
  ReplyToCommentSchema, type ReplyToCommentInput,
  ResolveCommentSchema, type ResolveCommentInput,
  ReadGoogleDocSchema, type ReadGoogleDocInput,
  DocsAppendTextSchema, type DocsAppendTextInput,
  DocsReplaceTextSchema, type DocsReplaceTextInput,
  DocsInsertTextSchema, type DocsInsertTextInput,
  GetSpreadsheetSchema, type GetSpreadsheetInput,
  ReadSheetRangeSchema, type ReadSheetRangeInput,
  SearchSheetSchema, type SearchSheetInput,
  GetSheetDataSchema, type GetSheetDataInput,
  WriteSheetRangeSchema, type WriteSheetRangeInput,
  AppendSheetRowsSchema, type AppendSheetRowsInput,
  ClearSheetRangeSchema, type ClearSheetRangeInput,
} from "./schemas.js";

async function main() {
  // CLI args
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`Google Drive MCP Server

Usage: google-drive-mcp [options]

Options:
  --help, -h    Show this help

Environment:
  GOOGLE_SERVICE_ACCOUNT_PATH  Path to service account JSON key
  GOOGLE_IMPERSONATE_USER      Email to impersonate (domain-wide delegation)
`);
    process.exit(0);
  }

  const server = new McpServer({
    name: "google-drive-mcp",
    version: "1.2.0",
  });

  // ============================================================
  // GOOGLE DRIVE TOOLS
  // ============================================================

  server.registerTool(
    "google_drive_search",
    {
      title: "Search Google Drive",
      description: `Search for files and folders in Google Drive by keyword or query syntax.`,
      inputSchema: SearchDriveFilesSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: SearchDriveFilesInput) => {
      try {
        const result = await client.searchDriveFiles(params.query, params.page_size, params.page_token, params.order_by);

        if (params.response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }

        let text = formatters.formatDriveFilesMarkdown(result.files, `# Search Results for "${params.query}"`);
        if (result.nextPageToken) text += `\n\n*More results available. Use page_token: "${result.nextPageToken}"*`;
        return { content: [{ type: "text", text }] };
      } catch (error) {
        return { content: [{ type: "text", text: client.handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "google_drive_list_folder",
    {
      title: "List Drive Folder Contents",
      description: `List files and subfolders in a Google Drive folder.`,
      inputSchema: ListDriveFolderSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: ListDriveFolderInput) => {
      try {
        const result = await client.listDriveFolder(params.folder_id, params.page_size, params.page_token, params.order_by);

        if (params.response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }

        let text = formatters.formatDriveFilesMarkdown(result.files, `# Folder Contents (${params.folder_id === "root" ? "My Drive" : params.folder_id})`);
        if (result.nextPageToken) text += `\n\n*More results available. Use page_token: "${result.nextPageToken}"*`;
        return { content: [{ type: "text", text }] };
      } catch (error) {
        return { content: [{ type: "text", text: client.handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "google_drive_get_file",
    {
      title: "Get Drive File Metadata",
      description: `Get detailed metadata about a file or folder in Google Drive.`,
      inputSchema: GetDriveFileSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: GetDriveFileInput) => {
      try {
        const file = await client.getDriveFile(params.file_id);
        const text = params.response_format === "json"
          ? JSON.stringify(file, null, 2)
          : formatters.formatDriveFileMarkdown(file);
        return { content: [{ type: "text", text }] };
      } catch (error) {
        return { content: [{ type: "text", text: client.handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "google_drive_read_file",
    {
      title: "Read Drive File Content",
      description: `Read or export the content of a file. Exports Google Workspace files (Docs, Sheets, Slides) to text/html/csv. Downloads text files directly. Downloads PDF and DOCX to workspace/ for text extraction.`,
      inputSchema: ReadDriveFileSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: ReadDriveFileInput) => {
      try {
        const result = await client.readDriveFile(params.file_id, params.export_format);

        if (params.response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }

        return { content: [{ type: "text", text: `# ${result.fileName}\n\n**MIME Type**: ${result.mimeType}\n\n---\n\n${result.content}` }] };
      } catch (error) {
        return { content: [{ type: "text", text: client.handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "google_drive_copy_file",
    {
      title: "Copy Drive File",
      description: `Create a copy of a file in Google Drive.`,
      inputSchema: CopyDriveFileSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params: CopyDriveFileInput) => {
      try {
        const file = await client.copyDriveFile(params.file_id, params.new_name, params.destination_folder_id);

        if (params.response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify(file, null, 2) }] };
        }
        return { content: [{ type: "text", text: `File copied successfully!\n\n${formatters.formatDriveFileMarkdown(file)}` }] };
      } catch (error) {
        return { content: [{ type: "text", text: client.handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "google_drive_move_file",
    {
      title: "Move Drive File",
      description: `Move a file to a different folder in Google Drive.`,
      inputSchema: MoveDriveFileSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: MoveDriveFileInput) => {
      try {
        const file = await client.moveDriveFile(params.file_id, params.destination_folder_id);

        if (params.response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify(file, null, 2) }] };
        }
        return { content: [{ type: "text", text: `File moved successfully!\n\n${formatters.formatDriveFileMarkdown(file)}` }] };
      } catch (error) {
        return { content: [{ type: "text", text: client.handleApiError(error) }], isError: true };
      }
    }
  );

  // ============================================================
  // COMMENTS TOOLS
  // ============================================================

  server.registerTool(
    "google_drive_list_comments",
    {
      title: "List Comments on File",
      description: `List comments on a Google Drive file (Docs, Sheets, Slides, etc).`,
      inputSchema: ListCommentsSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: ListCommentsInput) => {
      try {
        const result = await client.listComments(params.file_id, params.page_size, params.page_token, params.include_deleted);

        if (params.response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }

        let text = formatters.formatCommentsMarkdown(result.comments);
        if (result.nextPageToken) text += `\n\n*More comments available. Use page_token: "${result.nextPageToken}"*`;
        return { content: [{ type: "text", text }] };
      } catch (error) {
        return { content: [{ type: "text", text: client.handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "google_drive_create_comment",
    {
      title: "Comment on File",
      description: `Add a comment to a Google Drive file. Optionally quote text from the document.`,
      inputSchema: CreateCommentSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params: CreateCommentInput) => {
      try {
        const comment = await client.createComment(params.file_id, params.content, params.quoted_content);

        if (params.response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify(comment, null, 2) }] };
        }

        return {
          content: [{
            type: "text",
            text: `Comment added successfully!\n\n**Comment ID**: \`${comment.id}\`\n**Content**: ${comment.content}` +
              (comment.quotedFileContent?.value ? `\n**Quoted**: > ${comment.quotedFileContent.value}` : ""),
          }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: client.handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "google_drive_reply_to_comment",
    {
      title: "Reply to Comment",
      description: `Reply to an existing comment on a Google Drive file.`,
      inputSchema: ReplyToCommentSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params: ReplyToCommentInput) => {
      try {
        const reply = await client.replyToComment(params.file_id, params.comment_id, params.content);

        if (params.response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify(reply, null, 2) }] };
        }

        return {
          content: [{
            type: "text",
            text: `Reply added!\n\n**Reply ID**: \`${reply.id}\`\n**Content**: ${reply.content}`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: client.handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "google_drive_resolve_comment",
    {
      title: "Resolve Comment",
      description: `Mark a comment as resolved on a Google Drive file.`,
      inputSchema: ResolveCommentSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: ResolveCommentInput) => {
      try {
        const comment = await client.resolveComment(params.file_id, params.comment_id);

        if (params.response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify(comment, null, 2) }] };
        }

        return {
          content: [{ type: "text", text: `Comment \`${comment.id}\` resolved.` }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: client.handleApiError(error) }], isError: true };
      }
    }
  );

  // ============================================================
  // GOOGLE DOCS TOOLS
  // ============================================================

  server.registerTool(
    "google_docs_read",
    {
      title: "Read Google Doc",
      description: `Read a Google Doc as structured markdown. Preserves headings, lists, tables, and inline formatting.`,
      inputSchema: ReadGoogleDocSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: ReadGoogleDocInput) => {
      try {
        const result = await client.readGoogleDoc(params.document_id);

        if (params.response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }

        return { content: [{ type: "text", text: `# ${result.title}\n\n**Document ID**: \`${result.documentId}\`\n\n---\n\n${result.content}` }] };
      } catch (error) {
        return { content: [{ type: "text", text: client.handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "google_docs_append_text",
    {
      title: "Append Text to Google Doc",
      description: `Append text at the end of a Google Doc.`,
      inputSchema: DocsAppendTextSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params: DocsAppendTextInput) => {
      try {
        const result = await client.docsAppendText(params.document_id, params.text);
        const text = `Text appended to document \`${result.documentId}\`.`;
        if (params.response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        return { content: [{ type: "text", text }] };
      } catch (error) {
        return { content: [{ type: "text", text: client.handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "google_docs_replace_text",
    {
      title: "Find & Replace Text in Google Doc",
      description: `Find all occurrences of a string in a Google Doc and replace them.`,
      inputSchema: DocsReplaceTextSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params: DocsReplaceTextInput) => {
      try {
        const result = await client.docsReplaceText(params.document_id, params.find, params.replace_with, params.match_case);
        if (params.response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        return { content: [{ type: "text", text: `Replaced ${result.occurrencesChanged} occurrence(s) of "${params.find}" in document \`${result.documentId}\`.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: client.handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "google_docs_insert_text",
    {
      title: "Insert Text at Index in Google Doc",
      description: `Insert text at a specific character index in a Google Doc. Use google_docs_read with response_format=json to find the target index.`,
      inputSchema: DocsInsertTextSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params: DocsInsertTextInput) => {
      try {
        const result = await client.docsInsertText(params.document_id, params.text, params.index);
        if (params.response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        return { content: [{ type: "text", text: `Text inserted at index ${params.index} in document \`${result.documentId}\`.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: client.handleApiError(error) }], isError: true };
      }
    }
  );

  // ============================================================
  // GOOGLE SHEETS TOOLS
  // ============================================================

  server.registerTool(
    "google_sheets_get_spreadsheet",
    {
      title: "Get Spreadsheet Info",
      description: `Get metadata about a Google Sheets spreadsheet (title, sheet names, URL).`,
      inputSchema: GetSpreadsheetSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: GetSpreadsheetInput) => {
      try {
        const info = await client.getSpreadsheet(params.spreadsheet_id);

        if (params.response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }] };
        }

        const sheetsText = info.sheets.map((s) => `- ${s.title} (ID: ${s.sheetId})`).join("\n");
        return {
          content: [{
            type: "text",
            text: `# ${info.title}\n\n**Spreadsheet ID**: \`${info.spreadsheetId}\`\n**URL**: ${info.spreadsheetUrl}\n\n## Sheets\n${sheetsText}`,
          }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: client.handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "google_sheets_read_range",
    {
      title: "Read Sheet Range",
      description: `Read values from a range in a spreadsheet using A1 notation.`,
      inputSchema: ReadSheetRangeSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: ReadSheetRangeInput) => {
      try {
        const values = await client.readSheetRange(params.spreadsheet_id, params.range);

        if (params.response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify({ range: params.range, values }, null, 2) }] };
        }

        if (values.length === 0) return { content: [{ type: "text", text: "No data found in the specified range." }] };

        // Format as markdown table
        const lines = values.map((row) => "| " + row.join(" | ") + " |");
        if (lines.length > 1) {
          lines.splice(1, 0, "| " + values[0].map(() => "---").join(" | ") + " |");
        }

        return { content: [{ type: "text", text: `# ${params.range}\n\n${lines.join("\n")}` }] };
      } catch (error) {
        return { content: [{ type: "text", text: client.handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "google_sheets_search",
    {
      title: "Search Sheet",
      description: `Search for a value across all cells in a sheet. Returns matching rows.`,
      inputSchema: SearchSheetSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: SearchSheetInput) => {
      try {
        const results = await client.searchSheet(params.spreadsheet_id, params.sheet_name, params.search_value);

        if (params.response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
        }

        if (results.length === 0) {
          return { content: [{ type: "text", text: `No matches for "${params.search_value}" in ${params.sheet_name}.` }] };
        }

        const lines = [`# Search Results for "${params.search_value}"`, `*${results.length} matching row(s) in ${params.sheet_name}*`, ""];
        for (const row of results) {
          lines.push(`**Row ${row.rowNumber}**: ${row.values.join(" | ")}`);
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text", text: client.handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "google_sheets_get_data",
    {
      title: "Get Sheet Data",
      description: `Get all data from a sheet, optionally using the first row as column headers.`,
      inputSchema: GetSheetDataSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: GetSheetDataInput) => {
      try {
        const data = await client.getSheetData(params.spreadsheet_id, params.sheet_name, params.has_headers);

        if (params.response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
        }

        if (Array.isArray(data)) {
          if (data.length === 0) return { content: [{ type: "text", text: "Sheet is empty." }] };
          const lines = data.map((row) => "| " + row.join(" | ") + " |");
          return { content: [{ type: "text", text: `# ${params.sheet_name}\n\n${lines.join("\n")}` }] };
        }

        if (data.rows.length === 0) return { content: [{ type: "text", text: "Sheet is empty (headers only)." }] };

        const headerLine = "| " + data.headers.join(" | ") + " |";
        const sepLine = "| " + data.headers.map(() => "---").join(" | ") + " |";
        const dataLines = data.rows.map((row) => "| " + data.headers.map((h) => row[h] || "").join(" | ") + " |");

        return {
          content: [{ type: "text", text: `# ${params.sheet_name}\n\n${headerLine}\n${sepLine}\n${dataLines.join("\n")}` }],
        };
      } catch (error) {
        return { content: [{ type: "text", text: client.handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "google_sheets_write_range",
    {
      title: "Write to Sheet Range",
      description: `Write values to a range in a Google Sheets spreadsheet. Overwrites existing content in the range.`,
      inputSchema: WriteSheetRangeSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params: WriteSheetRangeInput) => {
      try {
        const result = await client.writeSheetRange(params.spreadsheet_id, params.range, params.values, params.value_input_option);
        if (params.response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        return { content: [{ type: "text", text: `Written to \`${result.updatedRange}\`: ${result.updatedRows} row(s), ${result.updatedColumns} column(s), ${result.updatedCells} cell(s) updated.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: client.handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "google_sheets_append_rows",
    {
      title: "Append Rows to Sheet",
      description: `Append one or more rows after the last row with data in a Google Sheets spreadsheet.`,
      inputSchema: AppendSheetRowsSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params: AppendSheetRowsInput) => {
      try {
        const result = await client.appendSheetRows(params.spreadsheet_id, params.range, params.values, params.value_input_option);
        if (params.response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        return { content: [{ type: "text", text: `Appended ${result.updatedRows} row(s) (${result.updatedCells} cells) to \`${result.updatedRange}\`.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: client.handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "google_sheets_clear_range",
    {
      title: "Clear Sheet Range",
      description: `Clear all values in a range of a Google Sheets spreadsheet. Preserves cell formatting.`,
      inputSchema: ClearSheetRangeSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async (params: ClearSheetRangeInput) => {
      try {
        const result = await client.clearSheetRange(params.spreadsheet_id, params.range);
        if (params.response_format === "json") {
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }
        return { content: [{ type: "text", text: `Cleared range \`${result.clearedRange}\`.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: client.handleApiError(error) }], isError: true };
      }
    }
  );

  // Start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Google Drive MCP Server running via stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
