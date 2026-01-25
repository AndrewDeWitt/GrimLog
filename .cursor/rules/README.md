# Cursor Rules for TacLog

This directory contains project-specific rules for Cursor AI in `.mdc` format.

## Rule Files

### `documentation-standards.mdc` (Always)
**Type:** Always included in context  
**Applied to:** All markdown files and docs/

Mandatory documentation standards including:
- 4 documentation types
- Post-feature checklist
- File naming conventions
- Document structure

### `code-standards.mdc` (Auto)
**Type:** Auto-attached when editing code  
**Applied to:** TypeScript, React, API routes

Code standards including:
- TypeScript best practices
- React/Next.js patterns
- API route patterns
- Common code patterns

### `project-context.mdc` (Agent)
**Type:** Agent-requested  
**Applied to:** When AI needs project context

Project architecture and context:
- System design
- Key files
- Architectural decisions
- AI-specific features

## Rule Types

- **Always**: Always included in model context
- **Auto**: Included when files matching glob patterns are referenced
- **Agent**: AI decides whether to include based on description
- **Manual**: Only when explicitly mentioned

## How to Use

Cursor AI automatically loads these rules based on their type:

1. **Documentation standards** are always active
2. **Code standards** activate when editing `.ts`/`.tsx` files
3. **Project context** is requested by AI when needed

## Adding New Rules

1. Create a new `.mdc` file in this directory
2. Add frontmatter with `description`, `tags`, and `type`
3. Add `globs` array for auto-attached rules
4. Write rule content in markdown

## Documentation

See [docs/DOCUMENTATION_STANDARDS.md](../../docs/DOCUMENTATION_STANDARDS.md) for complete documentation standards.

---

**Last Updated:** 2025-10-06
