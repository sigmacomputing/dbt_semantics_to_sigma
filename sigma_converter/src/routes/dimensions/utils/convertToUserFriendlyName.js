/**
 * converts a name to user-friendly format by replacing underscores with spaces
 * @param {string} name - the name to convert
 * @returns {string} user-friendly name with underscores replaced by spaces
 */
function convertToUserFriendlyName(name) {
  if (!name || typeof name !== 'string') {
    return name;
  }
  return name.replace(/_/g, ' ');
}

module.exports = {
  convertToUserFriendlyName
};

