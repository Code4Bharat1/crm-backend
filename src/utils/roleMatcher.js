/**
 * Normalizes a role string: removes extra spaces, lowercases, strips special characters.
 */
export const normalizeRoleString = (str) => {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

/**
 * Gets the root stem of a role name (stripping plural 's' or 'es').
 */
export const getRoleStem = (str) => {
  const normalized = normalizeRoleString(str);
  return normalized.replace(/(?:es|s)$/, '');
};

/**
 * Checks if two role names match closely:
 * - Exact match (case & whitespace insensitive)
 * - Singular / Plural variations: e.g. "Sale" and "Sales", "Manager" and "Managers"
 */
export const isRoleMatch = (roleA, roleB) => {
  if (!roleA || !roleB) return false;
  const normA = normalizeRoleString(roleA);
  const normB = normalizeRoleString(roleB);

  // Exact normalized match
  if (normA === normB) return true;

  // Singular / Plural match: "sale" vs "sales"
  const stemA = getRoleStem(roleA);
  const stemB = getRoleStem(roleB);
  if (stemA.length >= 3 && stemA === stemB) {
    return true;
  }

  // Direct plural offset (e.g. sale + s = sales)
  if (normA === `${normB}s` || normB === `${normA}s`) {
    return true;
  }

  return false;
};

/**
 * Finds a matching role from an array of role objects or strings.
 * @param {string} targetRoleName - The role name entered (e.g. "Sale")
 * @param {Array<Object|string>} roleList - Array of role objects ({ name: 'Sales' }) or strings
 * @returns {Object|string|null} - The matched existing role, or null
 */
export const findMatchingRoleInList = (targetRoleName, roleList) => {
  if (!targetRoleName || !Array.isArray(roleList)) return null;

  for (const item of roleList) {
    const candidateName = typeof item === 'string' ? item : item?.name;
    if (candidateName && isRoleMatch(targetRoleName, candidateName)) {
      return item;
    }
  }

  return null;
};
