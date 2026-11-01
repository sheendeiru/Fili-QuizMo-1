import {
  FILTER_DEFINITIONS,
  ROLE_CONFIG,
  getEntityConfig,
} from "./config";
import { SearchError } from "./errors";
import type {
  SearchEntity,
  SearchFilterKey,
  SearchRole,
  SearchScope,
} from "./types";

export function isEntityAllowed(
  role: SearchRole,
  entity: SearchEntity,
): boolean {
  return ROLE_CONFIG[role].entities.includes(entity);
}

export function assertEntityAllowed(
  role: SearchRole,
  entity: SearchEntity,
): void {
  if (!isEntityAllowed(role, entity)) {
    throw new SearchError(
      403,
      "FORBIDDEN_ENTITY",
      `The ${entity} search is not available for this role.`,
      { entity, role },
    );
  }
}

export function assertFilterAllowed(
  role: SearchRole,
  entity: SearchEntity,
  key: SearchFilterKey,
): void {
  const definition = FILTER_DEFINITIONS[key];

  if (!getEntityConfig(entity).filters.includes(key)) {
    throw new SearchError(
      400,
      "INVALID_FILTER",
      `The "${definition.label}" filter is not available for this view.`,
      { filter: key, entity },
    );
  }

  if (definition.roles && !definition.roles.includes(role)) {
    throw new SearchError(
      403,
      "FORBIDDEN_FILTER",
      `The "${definition.label}" filter is not available for this role.`,
      { filter: key, role },
    );
  }

  if (definition.entities && !definition.entities.includes(entity)) {
    throw new SearchError(
      400,
      "INVALID_FILTER",
      `The "${definition.label}" filter is not available for this view.`,
      { filter: key, entity },
    );
  }
}

export function createSearchScope(input: {
  role: SearchRole;
  userId: string;
  teacherId?: string | null;
  displayName?: string | null;
}): SearchScope {
  const teacherLabel = input.displayName?.trim() || null;

  if (input.role === "teacher") {
    return {
      role: "teacher",
      userId: input.userId,
      teacherId: input.teacherId ?? input.userId,
      teacherLabel,
    };
  }

  return {
    role: "admin",
    userId: input.userId,
    teacherId: null,
    teacherLabel,
  };
}
