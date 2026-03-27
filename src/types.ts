// Response format enum
export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}

// Google Drive file info
export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  parents?: string[];
  webViewLink?: string;
  webContentLink?: string;
  iconLink?: string;
  owners?: Array<{ displayName?: string; emailAddress?: string }>;
  shared?: boolean;
  starred?: boolean;
  trashed?: boolean;
  permissions?: DrivePermission[];
}

// Google Drive permission info
export interface DrivePermission {
  type?: string; // "anyone", "user", "group", "domain"
  role?: string; // "reader", "writer", "commenter", "owner"
  emailAddress?: string;
  displayName?: string;
  domain?: string;
}

// Google Drive comment
export interface DriveComment {
  id: string;
  content: string;
  author?: { displayName?: string; emailAddress?: string };
  createdTime?: string;
  modifiedTime?: string;
  resolved?: boolean;
  quotedFileContent?: { mimeType?: string; value?: string };
  replies?: DriveReply[];
  anchor?: string;
}

// Google Drive comment reply
export interface DriveReply {
  id: string;
  content: string;
  author?: { displayName?: string; emailAddress?: string };
  createdTime?: string;
  modifiedTime?: string;
}

// Spreadsheet info
export interface SpreadsheetInfo {
  spreadsheetId: string;
  title: string;
  sheets: Array<{ sheetId: number; title: string }>;
  spreadsheetUrl: string;
}
