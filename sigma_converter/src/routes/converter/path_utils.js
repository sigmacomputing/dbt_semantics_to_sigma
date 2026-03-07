const path = require('path');

/**
 * Resolve and validate a file path within a base directory to prevent path traversal attacks.
 * Supports paths with subdirectories (e.g., 'gtm/d_customer.yml').
 * @param {string} filePath - path relative to baseDir (e.g., 'gtm/d_customer.yml' or 'd_customer.yml')
 * @param {string} baseDir - base directory to resolve against
 * @returns {string} resolved absolute path
 * @throws {Error} if path traversal is detected
 */
function sanitizePath(filePath, baseDir) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('FilePath must be a non-empty string');
  }

  // Reject path traversal - never allow ..
  if (filePath.includes('..')) {
    throw new Error('Path traversal detected: .. not allowed');
  }

  // Remove invalid filename characters but ALLOW path separators
  const sanitized = filePath
    .replace(/[<>:"|?*\x00-\x1f]/g, '')
    .trim();

  if (!sanitized || sanitized.length === 0) {
    throw new Error('FilePath is invalid after sanitization');
  }

  const resolvedPath = path.resolve(baseDir, sanitized);
  const resolvedBaseDir = path.resolve(baseDir);

  if (!resolvedPath.startsWith(resolvedBaseDir + path.sep) &&
      resolvedPath !== resolvedBaseDir) {
    throw new Error(`Path traversal detected: ${filePath} would escape base directory`);
  }

  return resolvedPath;
}

module.exports = {
  sanitizePath
};
