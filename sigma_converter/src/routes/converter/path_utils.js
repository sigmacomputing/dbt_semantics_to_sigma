const path = require('path');

/**
 * sanitize filename to prevent path traversal attacks
 * @param {string} filename - filename to sanitize
 * @param {string} baseDir - base directory to validate against
 * @param {string} extension - file extension to append (e.g., '.yml')
 * @returns {string} sanitized absolute path
 * @throws {Error} if path traversal is detected
 */
function sanitizePath(filename, baseDir, extension = '') {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Filename must be a non-empty string');
  }

  // Remove any path traversal sequences and path separators
  // This prevents ../, ..\\, and other directory navigation attempts
  const sanitized = filename
    .replace(/\.\./g, '') // Remove .. sequences
    .replace(/[\/\\]/g, '') // Remove path separators
    .replace(/[<>:"|?*\x00-\x1f]/g, '') // Remove invalid filename characters
    .trim();

  if (!sanitized || sanitized.length === 0) {
    throw new Error('Filename is invalid after sanitization');
  }

  // Construct the path
  const fullFilename = extension ? `${sanitized}${extension}` : sanitized;
  const resolvedPath = path.resolve(baseDir, fullFilename);
  const resolvedBaseDir = path.resolve(baseDir);

  // Verify the resolved path is within the base directory
  if (!resolvedPath.startsWith(resolvedBaseDir + path.sep) && 
      resolvedPath !== resolvedBaseDir) {
    throw new Error(`Path traversal detected: ${filename} would escape base directory`);
  }

  return resolvedPath;
}

module.exports = {
  sanitizePath
};

