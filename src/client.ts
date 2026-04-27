import { google, drive_v3, docs_v1, sheets_v4 } from "googleapis";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { getAuthenticatedClient } from "./auth.js";
import type { DriveFileInfo, DriveComment, DriveReply, SpreadsheetInfo } from "./types.js";

let driveClient: drive_v3.Drive | null = null;
let docsClient: docs_v1.Docs | null = null;
let sheetsClient: sheets_v4.Sheets | null = null;

// ============================================================
// CLIENT INITIALIZATION
// ============================================================

export async function getDriveClient(): Promise<drive_v3.Drive> {
  if (driveClient) return driveClient;
  const auth = await getAuthenticatedClient();
  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
}

export async function getDocsClient(): Promise<docs_v1.Docs> {
  if (docsClient) return docsClient;
  const auth = await getAuthenticatedClient();
  docsClient = google.docs({ version: "v1", auth });
  return docsClient;
}

export async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  if (sheetsClient) return sheetsClient;
  const auth = await getAuthenticatedClient();
  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

// ============================================================
// ERROR HANDLING
// ============================================================

export function handleApiError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("401") || message.includes("unauthorized")) {
      return "Error: Authentication failed. Check your service account key and ensure the APIs are enabled.";
    }
    if (message.includes("403") || message.includes("forbidden")) {
      return "Error: Permission denied. The file may not be shared with this service account.";
    }
    if (message.includes("404") || message.includes("not found")) {
      return "Error: Resource not found. Check the file/document ID and ensure it's shared with the service account.";
    }
    if (message.includes("429") || message.includes("rate limit")) {
      return "Error: Rate limit exceeded. Please wait before making more requests.";
    }
    if (message.includes("quota")) {
      return "Error: API quota exceeded. Check your Google Cloud project quotas.";
    }

    return `Error: ${error.message}`;
  }
  return `Error: ${String(error)}`;
}

// ============================================================
// GOOGLE DRIVE FUNCTIONS
// ============================================================

const DRIVE_FILE_FIELDS =
  "id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink, webContentLink, iconLink, owners(displayName, emailAddress), shared, starred, trashed, permissions(type, role, emailAddress, displayName, domain)";

/**
 * Search for files in Google Drive.
 * Accepts either a simple keyword or a Drive API query string.
 */
export async function searchDriveFiles(
  query: string,
  pageSize: number = 25,
  pageToken?: string,
  orderBy: string = "modifiedTime desc"
): Promise<{ files: DriveFileInfo[]; nextPageToken?: string }> {
  const drive = await getDriveClient();

  const driveQueryOperators = ["name", "fullText", "mimeType", "modifiedTime", "createdTime", "in parents", "owners", "trashed", "starred", "sharedWithMe"];
  const isRawQuery = !driveQueryOperators.some((op) => query.includes(op));

  const escapeForDriveQuery = (str: string) => str.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

  const q = isRawQuery
    ? `name contains '${escapeForDriveQuery(query)}' or fullText contains '${escapeForDriveQuery(query)}'`
    : query;

  const response = await drive.files.list({
    q: `${q} and trashed = false`,
    pageSize,
    pageToken,
    orderBy,
    fields: `nextPageToken, files(${DRIVE_FILE_FIELDS})`,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return {
    files: (response.data.files || []) as DriveFileInfo[],
    nextPageToken: response.data.nextPageToken || undefined,
  };
}

/**
 * List contents of a Drive folder.
 */
export async function listDriveFolder(
  folderId: string = "root",
  pageSize: number = 50,
  pageToken?: string,
  orderBy: string = "folder,name"
): Promise<{ files: DriveFileInfo[]; nextPageToken?: string }> {
  const drive = await getDriveClient();

  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    pageSize,
    pageToken,
    orderBy,
    fields: `nextPageToken, files(${DRIVE_FILE_FIELDS})`,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return {
    files: (response.data.files || []) as DriveFileInfo[],
    nextPageToken: response.data.nextPageToken || undefined,
  };
}

/**
 * Get file metadata by ID.
 */
export async function getDriveFile(fileId: string): Promise<DriveFileInfo> {
  const drive = await getDriveClient();
  const response = await drive.files.get({
    fileId,
    fields: DRIVE_FILE_FIELDS,
    supportsAllDrives: true,
  });
  return response.data as DriveFileInfo;
}

/**
 * Read/export file content from Drive.
 */
export async function readDriveFile(
  fileId: string,
  exportFormat: string = "text"
): Promise<{ content: string; mimeType: string; fileName: string }> {
  const drive = await getDriveClient();

  const file = await drive.files.get({
    fileId,
    fields: "id, name, mimeType, size",
    supportsAllDrives: true,
  });

  const fileName = file.data.name || "unknown";
  const fileMimeType = file.data.mimeType || "";

  // Size guard: 10MB max
  const MAX_READ_SIZE = 10 * 1024 * 1024;
  if (file.data.size && Number(file.data.size) > MAX_READ_SIZE) {
    const sizeMB = (Number(file.data.size) / 1024 / 1024).toFixed(1);
    return {
      content: `(File too large: ${sizeMB}MB. Maximum readable size is 10MB. Use webViewLink to open in browser.)`,
      mimeType: fileMimeType,
      fileName,
    };
  }

  // Google Workspace export types
  const exportMimeTypes: Record<string, Record<string, string>> = {
    "application/vnd.google-apps.document": {
      text: "text/plain",
      html: "text/html",
      pdf: "application/pdf",
    },
    "application/vnd.google-apps.spreadsheet": {
      csv: "text/csv",
      text: "text/csv",
      html: "text/html",
      pdf: "application/pdf",
    },
    "application/vnd.google-apps.presentation": {
      text: "text/plain",
      html: "text/html",
      pdf: "application/pdf",
    },
    "application/vnd.google-apps.drawing": {
      pdf: "application/pdf",
    },
  };

  if (exportMimeTypes[fileMimeType]) {
    const formatMap = exportMimeTypes[fileMimeType];
    const targetMimeType = formatMap[exportFormat] || formatMap["text"] || Object.values(formatMap)[0];

    if (targetMimeType === "application/pdf") {
      return {
        content: "(PDF export — binary content cannot be displayed as text. Use 'text' or 'html' format instead.)",
        mimeType: targetMimeType,
        fileName,
      };
    }

    const response = await drive.files.export(
      { fileId, mimeType: targetMimeType },
      { responseType: "text" }
    );

    return { content: String(response.data), mimeType: targetMimeType, fileName };
  }

  // Regular files — text-based only
  const textMimeTypes = [
    "text/",
    "application/json",
    "application/xml",
    "application/javascript",
    "application/typescript",
    "application/x-yaml",
    "application/yaml",
  ];
  const isTextFile = textMimeTypes.some((t) => fileMimeType.startsWith(t) || fileMimeType.includes(t));

  const CANONICAL_EXTENSIONS: Record<string, string> = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  };

  if (!isTextFile) {
    const workingDir = process.env.AGENT_WORKING_DIR;
    if (workingDir && fileMimeType in CANONICAL_EXTENSIONS) {
      // Download binary to workspace/ so the agent can extract text from it
      const response = await drive.files.get(
        { fileId, alt: "media", supportsAllDrives: true },
        { responseType: "arraybuffer" }
      );
      const workspaceDir = join(workingDir, "workspace");
      mkdirSync(workspaceDir, { recursive: true });
      // Ensure canonical extension so extract-text detects type correctly
      const ext = CANONICAL_EXTENSIONS[fileMimeType];
      const baseName = fileName.endsWith(ext) ? fileName : `${fileName}${ext}`;
      const safeName = `${fileId}_${baseName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const outputPath = join(workspaceDir, safeName);
      writeFileSync(outputPath, Buffer.from(response.data as ArrayBuffer));
      return {
        content: `Downloaded to workspace/${safeName} — use extract-text to read its content`,
        mimeType: fileMimeType,
        fileName,
      };
    }

    const sizeKB = file.data.size ? Math.round(Number(file.data.size) / 1024) : 0;
    return {
      content: `(Binary file: ${fileMimeType}, ${sizeKB}KB — cannot be displayed as text. Use webViewLink to open in browser.)`,
      mimeType: fileMimeType,
      fileName,
    };
  }

  const response = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "text" }
  );

  return { content: String(response.data), mimeType: fileMimeType, fileName };
}

/**
 * Copy a file in Drive.
 */
export async function copyDriveFile(
  fileId: string,
  newName?: string,
  destinationFolderId?: string
): Promise<DriveFileInfo> {
  const drive = await getDriveClient();

  const requestBody: drive_v3.Schema$File = {};
  if (newName) requestBody.name = newName;
  if (destinationFolderId) requestBody.parents = [destinationFolderId];

  const response = await drive.files.copy({
    fileId,
    requestBody,
    fields: DRIVE_FILE_FIELDS,
    supportsAllDrives: true,
  });

  return response.data as DriveFileInfo;
}

/**
 * Move a file to a different folder.
 */
export async function moveDriveFile(
  fileId: string,
  destinationFolderId: string
): Promise<DriveFileInfo> {
  const drive = await getDriveClient();

  const file = await drive.files.get({ fileId, fields: "parents", supportsAllDrives: true });
  const previousParents = (file.data.parents || []).join(",");

  const response = await drive.files.update({
    fileId,
    addParents: destinationFolderId,
    removeParents: previousParents,
    fields: DRIVE_FILE_FIELDS,
    supportsAllDrives: true,
  });

  return response.data as DriveFileInfo;
}

// ============================================================
// DRIVE COMMENTS
// ============================================================

/**
 * List comments on a file.
 */
export async function listComments(
  fileId: string,
  pageSize: number = 20,
  pageToken?: string,
  includeDeleted: boolean = false
): Promise<{ comments: DriveComment[]; nextPageToken?: string }> {
  const drive = await getDriveClient();

  const response = await drive.comments.list({
    fileId,
    pageSize,
    pageToken,
    includeDeleted,
    fields: "nextPageToken, comments(id, content, author(displayName, emailAddress), createdTime, modifiedTime, resolved, quotedFileContent, replies(id, content, author(displayName, emailAddress), createdTime, modifiedTime), anchor)",
  });

  return {
    comments: (response.data.comments || []) as DriveComment[],
    nextPageToken: response.data.nextPageToken || undefined,
  };
}

/**
 * Create a comment on a file.
 */
export async function createComment(
  fileId: string,
  content: string,
  quotedContent?: string,
  anchor?: string
): Promise<DriveComment> {
  const drive = await getDriveClient();

  const requestBody: drive_v3.Schema$Comment = { content };
  if (quotedContent) {
    requestBody.quotedFileContent = { mimeType: "text/plain", value: quotedContent };
  }
  if (anchor) {
    requestBody.anchor = anchor;
  }

  const response = await drive.comments.create({
    fileId,
    requestBody,
    fields: "id, content, author(displayName, emailAddress), createdTime, resolved, quotedFileContent, anchor",
  });

  return response.data as DriveComment;
}

/**
 * Reply to a comment.
 */
export async function replyToComment(
  fileId: string,
  commentId: string,
  content: string
): Promise<DriveReply> {
  const drive = await getDriveClient();

  const response = await drive.replies.create({
    fileId,
    commentId,
    requestBody: { content },
    fields: "id, content, author(displayName, emailAddress), createdTime",
  });

  return response.data as DriveReply;
}

/**
 * Resolve a comment.
 */
export async function resolveComment(
  fileId: string,
  commentId: string
): Promise<DriveComment> {
  const drive = await getDriveClient();

  const response = await drive.comments.update({
    fileId,
    commentId,
    requestBody: { resolved: true },
    fields: "id, content, author(displayName, emailAddress), createdTime, resolved",
  });

  return response.data as DriveComment;
}

// ============================================================
// GOOGLE DOCS FUNCTIONS
// ============================================================

/**
 * Read a Google Doc and convert to markdown.
 */
export async function readGoogleDoc(
  documentId: string
): Promise<{ title: string; content: string; documentId: string }> {
  const docs = await getDocsClient();

  const response = await docs.documents.get({ documentId });
  const doc = response.data;
  const title = doc.title || "Untitled Document";
  const content = convertDocToMarkdown(doc);

  return { title, content, documentId };
}

/**
 * Convert Google Docs API document to markdown format.
 */
function convertDocToMarkdown(doc: docs_v1.Schema$Document): string {
  const content = doc.body?.content || [];
  const lines: string[] = [];
  const listCounters = new Map<string, number>();

  for (const element of content) {
    if (element.paragraph) {
      const para = element.paragraph;
      const style = para.paragraphStyle?.namedStyleType || "NORMAL_TEXT";
      const bullet = para.bullet;

      let text = "";
      for (const elem of para.elements || []) {
        if (elem.textRun) {
          let run = elem.textRun.content || "";
          const textStyle = elem.textRun.textStyle;

          if (textStyle?.bold && run.trim()) run = `**${run.trim()}** `;
          if (textStyle?.italic && run.trim()) run = `*${run.trim()}* `;
          if (textStyle?.strikethrough && run.trim()) run = `~~${run.trim()}~~ `;
          if (textStyle?.link?.url && run.trim()) run = `[${run.trim()}](${textStyle.link.url}) `;

          text += run;
        }
      }

      text = text.replace(/\n$/, "");
      if (!text.trim()) {
        lines.push("");
        continue;
      }

      if (bullet) {
        const nestingLevel = bullet.nestingLevel || 0;
        const indent = "  ".repeat(nestingLevel);
        const listId = bullet.listId || "";

        const listDef = doc.lists?.[listId];
        const nestingProps = listDef?.listProperties?.nestingLevels?.[nestingLevel];
        const glyphType = nestingProps?.glyphType;

        if (glyphType && glyphType !== "GLYPH_TYPE_UNSPECIFIED") {
          const key = `${listId}-${nestingLevel}`;
          const counter = (listCounters.get(key) || 0) + 1;
          listCounters.set(key, counter);
          lines.push(`${indent}${counter}. ${text.trim()}`);
        } else {
          lines.push(`${indent}- ${text.trim()}`);
        }
        continue;
      }

      listCounters.clear();

      switch (style) {
        case "TITLE":
        case "HEADING_1":
          lines.push(`# ${text.trim()}`);
          break;
        case "SUBTITLE":
          lines.push(`*${text.trim()}*`);
          break;
        case "HEADING_2":
          lines.push(`## ${text.trim()}`);
          break;
        case "HEADING_3":
          lines.push(`### ${text.trim()}`);
          break;
        case "HEADING_4":
          lines.push(`#### ${text.trim()}`);
          break;
        case "HEADING_5":
          lines.push(`##### ${text.trim()}`);
          break;
        case "HEADING_6":
          lines.push(`###### ${text.trim()}`);
          break;
        default:
          lines.push(text.trimEnd());
          break;
      }
    } else if (element.table) {
      const table = element.table;
      if (table.tableRows) {
        for (let rowIdx = 0; rowIdx < table.tableRows.length; rowIdx++) {
          const row = table.tableRows[rowIdx];
          const cells: string[] = [];

          for (const cell of row.tableCells || []) {
            let cellText = "";
            for (const cellContent of cell.content || []) {
              if (cellContent.paragraph) {
                for (const elem of cellContent.paragraph.elements || []) {
                  if (elem.textRun) {
                    cellText += (elem.textRun.content || "").replace(/\n/g, " ");
                  }
                }
              }
            }
            cells.push(cellText.trim());
          }

          lines.push("| " + cells.join(" | ") + " |");
          if (rowIdx === 0) {
            lines.push("| " + cells.map(() => "---").join(" | ") + " |");
          }
        }
        lines.push("");
      }
    } else if (element.sectionBreak) {
      lines.push("---");
    }
  }

  return lines.join("\n");
}

// ============================================================
// GOOGLE SHEETS FUNCTIONS
// ============================================================

/**
 * Get spreadsheet metadata.
 */
export async function getSpreadsheet(spreadsheetId: string): Promise<SpreadsheetInfo> {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.get({ spreadsheetId });
  const data = response.data;

  return {
    spreadsheetId: data.spreadsheetId || spreadsheetId,
    title: data.properties?.title || "Untitled",
    sheets: (data.sheets || []).map((s) => ({
      sheetId: s.properties?.sheetId || 0,
      title: s.properties?.title || "Sheet",
    })),
    spreadsheetUrl: data.spreadsheetUrl || "",
  };
}

/**
 * Read values from a range.
 */
export async function readSheetRange(
  spreadsheetId: string,
  range: string
): Promise<string[][]> {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return (response.data.values || []) as string[][];
}

/**
 * Search for a value in a sheet.
 */
export async function searchSheet(
  spreadsheetId: string,
  sheetName: string,
  searchValue: string
): Promise<{ rowNumber: number; values: string[] }[]> {
  const sheets = await getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetName,
  });

  const values = response.data.values || [];
  const results: { rowNumber: number; values: string[] }[] = [];
  const searchLower = searchValue.toLowerCase();

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (row.some((cell) => String(cell).toLowerCase().includes(searchLower))) {
      results.push({ rowNumber: i + 1, values: row.map((v) => String(v)) });
    }
  }

  return results;
}

/**
 * Get a sheet's data with headers.
 */
export async function getSheetData(
  spreadsheetId: string,
  sheetName: string,
  hasHeaders: boolean = true
): Promise<{ headers: string[]; rows: Record<string, string>[] } | string[][]> {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: sheetName });
  const values = response.data.values || [];

  if (!hasHeaders || values.length === 0) return values as string[][];

  const headers = values[0].map((h) => String(h));
  const rows = values.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      obj[header] = row[idx] !== undefined ? String(row[idx]) : "";
    });
    return obj;
  });

  return { headers, rows };
}

/**
 * Write values to a specific range in a spreadsheet.
 */
export async function writeSheetRange(
  spreadsheetId: string,
  range: string,
  values: (string | number | boolean | null)[][],
  valueInputOption: "RAW" | "USER_ENTERED" = "USER_ENTERED"
): Promise<{ updatedRange: string; updatedRows: number; updatedColumns: number; updatedCells: number }> {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption,
    requestBody: { values },
  });
  return {
    updatedRange: response.data.updatedRange || range,
    updatedRows: response.data.updatedRows || 0,
    updatedColumns: response.data.updatedColumns || 0,
    updatedCells: response.data.updatedCells || 0,
  };
}

/**
 * Append rows after the last row with data in the given range.
 */
export async function appendSheetRows(
  spreadsheetId: string,
  range: string,
  values: (string | number | boolean | null)[][],
  valueInputOption: "RAW" | "USER_ENTERED" = "USER_ENTERED"
): Promise<{ updatedRange: string; updatedRows: number; updatedCells: number }> {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption,
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });
  const updates = response.data.updates;
  return {
    updatedRange: updates?.updatedRange || range,
    updatedRows: updates?.updatedRows || 0,
    updatedCells: updates?.updatedCells || 0,
  };
}

/**
 * Clear all values in a range (keeps formatting).
 */
export async function clearSheetRange(
  spreadsheetId: string,
  range: string
): Promise<{ clearedRange: string }> {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range,
  });
  return { clearedRange: response.data.clearedRange || range };
}

// ============================================================
// GOOGLE DOCS WRITE FUNCTIONS
// ============================================================

/**
 * Append text at the end of a Google Doc.
 */
export async function docsAppendText(
  documentId: string,
  text: string
): Promise<{ documentId: string; revisionsId: string }> {
  const docs = await getDocsClient();

  // Get the end index of the document body
  const doc = await docs.documents.get({ documentId });
  const content = doc.data.body?.content || [];
  const lastElement = content[content.length - 1];
  // End index is exclusive; subtract 1 to insert before the final newline
  const endIndex = (lastElement?.endIndex || 2) - 1;

  const response = await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: endIndex },
            text,
          },
        },
      ],
    },
  });

  return {
    documentId,
    revisionsId: response.data.documentId || documentId,
  };
}

/**
 * Find and replace text throughout a Google Doc.
 */
export async function docsReplaceText(
  documentId: string,
  find: string,
  replaceWith: string,
  matchCase: boolean = true
): Promise<{ documentId: string; occurrencesChanged: number }> {
  const docs = await getDocsClient();

  const response = await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [
        {
          replaceAllText: {
            containsText: { text: find, matchCase },
            replaceText: replaceWith,
          },
        },
      ],
    },
  });

  const occurrences = response.data.replies?.[0]?.replaceAllText?.occurrencesChanged || 0;
  return { documentId, occurrencesChanged: occurrences };
}

/**
 * Insert text at a specific index in a Google Doc.
 */
export async function docsInsertText(
  documentId: string,
  text: string,
  index: number
): Promise<{ documentId: string }> {
  const docs = await getDocsClient();

  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index },
            text,
          },
        },
      ],
    },
  });

  return { documentId };
}
