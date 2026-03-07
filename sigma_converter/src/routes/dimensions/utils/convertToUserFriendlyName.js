/**
 * converts a name to user-friendly format by replacing underscores with spaces
 * and capitalizing the first letter of each word (e.g. cust_key -> Cust Key)
 * @param {string} name - the name to convert
 * @returns {string} user-friendly name with underscores replaced by spaces
 */
function convertToUserFriendlyName(name) {
  if (!name || typeof name !== 'string') {
    return name;
  }
  return name
    .replace(/_/g, ' ')
    .split(' ')
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

module.exports = {
  convertToUserFriendlyName
};

