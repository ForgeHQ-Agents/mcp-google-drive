import type { DriveFileInfo, DriveComment } from "./types.js";

const CHARACTER_LIMIT = 25000;

function formatTimestamp(timestamp?: string): string {
  if (!timestamp) return "Unknown";
  return new Date(timestamp).toLocaleString();
}

function getFileTypeDisplay(mimeType: string): string {
  const typeMap: Record<string, string> = {
    "application/vnd.google-apps.document": "Google Doc",
    "application/vnd.google-apps.spreadsheet": "Google Sheet",
    "application/vnd.google-apps.presentation": "Google Slides",
    "application/vnd.google-apps.folder": "Folder",
    "application/vnd.google-apps.drawing": "Google Drawing",
    "application/vnd.google-apps.form": "Google Form",
    "application/pdf": "PDF",
    "image/png": "PNG Image",
    "image/jpeg": "JPEG Image",
    "text/plain": "Text File",
    "text/csv": "CSV File",
    "application/json": "JSON File",
    "application/zip": "ZIP Archive",
  };
  return typeMap[mimeType] || mimeType;
}

function truncateIfNeeded(content: string, itemCount: number, itemType: string): string {
  if (content.length <= CHARACTER_LIMIT) return content;

  const truncated = content.slice(0, CHARACTER_LIMIT - 200);
  const lastNewline = truncated.lastIndexOf("\n\n");
  const cleanTruncated = lastNewline > 0 ? truncated.slice(0, lastNewline) : truncated;

  return (
    cleanTruncated +
    `\n\n---\n*Response truncated. Showing partial results from ${itemCount} ${itemType}. ` +
    `Use pagination (page_token) or filters to see more.*`
  );
}

/**
 * Format a list of Drive files as markdown.
 */
export function formatDriveFilesMarkdown(files: DriveFileInfo[], title?: string): string {
  if (files.length === 0) return "No files found.";

  const lines: string[] = [title || "# Drive Files", ""];

  for (const file of files) {
    const typeDisplay = getFileTypeDisplay(file.mimeType);
    const isFolder = file.mimeType === "application/vnd.google-apps.folder";

    lines.push(`${isFolder ? "📁" : "📄"} **${file.name}**`);
    lines.push(`- **ID**: \`${file.id}\``);
    lines.push(`- **Type**: ${typeDisplay}`);

    if (file.size) {
      const sizeKB = Math.round(Number(file.size) / 1024);
      lines.push(`- **Size**: ${sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)}MB` : `${sizeKB}KB`}`);
    }
    if (file.modifiedTime) lines.push(`- **Modified**: ${formatTimestamp(file.modifiedTime)}`);
    if (file.owners?.length) {
      lines.push(`- **Owner**: ${file.owners.map((o) => o.displayName || o.emailAddress || "Unknown").join(", ")}`);
    }
    if (file.webViewLink) lines.push(`- **Link**: ${file.webViewLink}`);
    if (file.shared) lines.push(`- **Shared**: Yes`);
    lines.push("");
  }

  return truncateIfNeeded(lines.join("\n"), files.length, "files");
}

/**
 * Format a single Drive file's metadata as markdown.
 */
export function formatDriveFileMarkdown(file: DriveFileInfo): string {
  const typeDisplay = getFileTypeDisplay(file.mimeType);
  const isFolder = file.mimeType === "application/vnd.google-apps.folder";

  const lines: string[] = [
    `# ${isFolder ? "📁" : "📄"} ${file.name}`,
    "",
    `- **File ID**: \`${file.id}\``,
    `- **Type**: ${typeDisplay}`,
    `- **MIME Type**: ${file.mimeType}`,
  ];

  if (file.size) {
    const sizeKB = Math.round(Number(file.size) / 1024);
    lines.push(`- **Size**: ${sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)}MB` : `${sizeKB}KB`}`);
  }
  if (file.createdTime) lines.push(`- **Created**: ${formatTimestamp(file.createdTime)}`);
  if (file.modifiedTime) lines.push(`- **Modified**: ${formatTimestamp(file.modifiedTime)}`);
  if (file.owners?.length) {
    lines.push(`- **Owner**: ${file.owners.map((o) => `${o.displayName || "Unknown"} (${o.emailAddress || ""})`).join(", ")}`);
  }
  if (file.webViewLink) lines.push(`- **View Link**: ${file.webViewLink}`);
  if (file.webContentLink) lines.push(`- **Download Link**: ${file.webContentLink}`);
  if (file.shared) lines.push(`- **Shared**: Yes`);

  return lines.join("\n");
}

/**
 * Format comments as markdown.
 */
export function formatCommentsMarkdown(comments: DriveComment[]): string {
  if (comments.length === 0) return "No comments found.";

  const lines: string[] = ["# Comments", ""];

  for (const comment of comments) {
    const author = comment.author?.displayName || comment.author?.emailAddress || "Unknown";
    const status = comment.resolved ? " [RESOLVED]" : "";

    lines.push(`### ${author} — ${formatTimestamp(comment.createdTime)}${status}`);

    if (comment.quotedFileContent?.value) {
      lines.push(`> ${comment.quotedFileContent.value}`);
      lines.push("");
    }

    lines.push(comment.content);

    if (comment.replies?.length) {
      lines.push("");
      for (const reply of comment.replies) {
        const replyAuthor = reply.author?.displayName || reply.author?.emailAddress || "Unknown";
        lines.push(`  **${replyAuthor}** (${formatTimestamp(reply.createdTime)}): ${reply.content}`);
      }
    }

    lines.push(`*Comment ID: \`${comment.id}\`*`);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return truncateIfNeeded(lines.join("\n"), comments.length, "comments");
}
