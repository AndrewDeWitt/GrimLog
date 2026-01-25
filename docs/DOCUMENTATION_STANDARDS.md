# Grimlog Documentation Standards

**Last Updated:** October 6, 2025  
**Status:** Complete - Mandatory for all contributors

## Purpose

These standards ensure Grimlog documentation remains clear, organized, and maintainable. All contributors (human and AI) must follow these rules.

---

## Rule 1: Documentation Types

**There are exactly 4 types of documentation:**

### 1. User Guides (`docs/guides/`)
**Purpose:** HOW TO use features

**Must include:**
- Step-by-step instructions
- Configuration options
- Examples and use cases
- Troubleshooting tips

**Examples:**
- `docs/guides/AUDIO_VAD_GUIDE.md`
- `docs/guides/CONTEXT_SYSTEM_GUIDE.md`

### 2. API Documentation (`docs/api/`)
**Purpose:** Technical reference for endpoints

**Must include:**
- Request/response formats
- Parameters and types
- Example requests
- Error codes

**Examples:**
- `docs/api/TRANSCRIBE_ENDPOINT.md`
- `docs/api/ANALYZE_ENDPOINT.md`

### 3. Feature Documentation (`docs/features/`)
**Purpose:** WHAT the feature is

**Must include:**
- Overview and purpose
- Architecture
- Key components
- Links to related guides

**Examples:**
- `docs/features/AI_TOOL_CALLING.md`
- `docs/features/LANGFUSE_OBSERVABILITY.md`

### 4. Troubleshooting (`docs/troubleshooting/`)
**Purpose:** FIX problems

**Must include:**
- Problem descriptions
- Solutions
- Common mistakes
- Debug procedures

**Examples:**
- `docs/troubleshooting/AUDIO_ISSUES.md`
- `docs/troubleshooting/DATABASE_ISSUES.md`

---

## Rule 2: When to Create Documentation

### ✅ DO create documentation for:

| Scenario | Type | Location |
|----------|------|----------|
| New feature | Feature doc | `docs/features/FEATURE_NAME.md` |
| New API endpoint | API doc | `docs/api/ENDPOINT_NAME.md` |
| Complex system | User guide | `docs/guides/SYSTEM_NAME_GUIDE.md` |
| Common problem | Troubleshooting | `docs/troubleshooting/PROBLEM_NAME.md` |

### ❌ DON'T create documentation for:

| What | Why Not | Do This Instead |
|------|---------|-----------------|
| Temporary session notes | Clutters docs | Use Git commit messages |
| Work-in-progress features | Incomplete information | Wait until feature is complete |
| Implementation details | Too granular | Use inline code comments |
| Personal notes | Not for repo | Keep in separate scratch file |

---

## Rule 3: Standard Document Structure

**Every documentation file MUST have this exact structure:**

```markdown
# [Clear Descriptive Title]

**Last Updated:** [Date in YYYY-MM-DD format]
**Status:** [Draft/Complete/Deprecated]

## Overview
[1-2 paragraph description of what this document covers]

## Table of Contents
- [Link to Section 1](#section-1)
- [Link to Section 2](#section-2)
...

## [Content Sections]
[Your documentation content organized in logical sections]

## Related Documentation
- [Link to related doc 1](../path/to/doc.md)
- [Link to related doc 2](../path/to/doc.md)
```

**Required elements:**
1. ✅ Clear title with markdown H1 (`#`)
2. ✅ Last updated date (YYYY-MM-DD format)
3. ✅ Status badge (Draft/Complete/Deprecated)
4. ✅ Overview section
5. ✅ Table of contents (for docs > 100 lines)
6. ✅ Logical content sections
7. ✅ Related documentation links at end

---

## Rule 4: File Naming Conventions

### Format: `CATEGORY_NAME_TYPE.md`

**Rules:**
- ✅ Use `SCREAMING_SNAKE_CASE`
- ✅ Be descriptive and specific
- ✅ Include type suffix when appropriate (`_GUIDE`, `_ENDPOINT`)
- ❌ No dates in filenames
- ❌ No "COMPLETE" or "SUMMARY" suffixes
- ❌ No abbreviations unless universally known (API, VAD, etc.)

**Examples:**

| Good ✅ | Bad ❌ | Why |
|---------|--------|-----|
| `AUDIO_VAD_GUIDE.md` | `AUDIO.md` | Too vague |
| `TRANSCRIBE_ENDPOINT.md` | `TRANSCRIBE_API_DOCS.md` | Redundant (in api/ folder) |
| `CONTEXT_SYSTEM_GUIDE.md` | `CONTEXT_2024.md` | No dates |
| `VALIDATION_GUIDE.md` | `VALIDATION_COMPLETE.md` | No "COMPLETE" |
| `AI_TOOL_CALLING.md` | `AI_TOOLS_SETUP.md` | Simpler is better |

---

## Rule 5: Post-Feature Documentation Process

**After completing ANY feature, follow this checklist:**

### Step-by-Step Process

1. **Update `CHANGELOG.md`** (Required)
   ```markdown
   ## [X.Y.Z] - YYYY-MM-DD
   
   ### Added
   - Feature description
   
   ### Changed
   - What changed
   
   ### Fixed
   - What was fixed
   ```

2. **Update or Create User Guide** (If user-facing)
   - Update existing guide in `docs/guides/`
   - Or create new guide if complex system
   - Include configuration, examples, troubleshooting

3. **Create Feature Documentation** (If major feature)
   - Create `docs/features/FEATURE_NAME.md`
   - Include overview, architecture, components
   - Link to relevant guides

4. **Update API Documentation** (If endpoints added/changed)
   - Update existing endpoint docs in `docs/api/`
   - Or create new endpoint doc
   - Include request/response formats, examples

5. **Update `README.md`** (If user-facing changes)
   - Update feature list
   - Update quick start if needed
   - Keep under 300 lines

6. **Update Troubleshooting** (If new common issues)
   - Add to existing troubleshooting doc
   - Or create new doc in `docs/troubleshooting/`

7. **Update `docs/README.md`** (Always)
   - Add links to new documentation
   - Update documentation index
   - Verify navigation works

### ❌ DO NOT DO:

| Don't Do This | Why | Do This Instead |
|---------------|-----|-----------------|
| Create `FEATURE_COMPLETE.md` | Temporary clutter | Update CHANGELOG.md |
| Keep session summaries in docs/ | Not permanent docs | Move to archive/ or delete |
| Duplicate information | Hard to maintain | Cross-reference with links |
| Leave outdated docs | Causes confusion | Update or archive with deprecation notice |

---

## Rule 6: Cross-Referencing

**Always link related documentation:**

### Link Format

```markdown
## Related Documentation

- [Main Guide](../guides/GUIDE_NAME.md) - Brief description
- [API Reference](../api/ENDPOINT_NAME.md) - Brief description
- [Feature Docs](../features/FEATURE_NAME.md) - Brief description
- [Main README](../README.md#section) - Brief description
```

### When to Cross-Reference

- ✅ At end of every document (Related Documentation section)
- ✅ In context when mentioning another system
- ✅ In troubleshooting when referencing solutions
- ✅ In `docs/README.md` index when adding new docs

---

## Rule 7: Archiving Old Documentation

**Never delete documentation - archive it instead:**

### When to Archive

- Document is outdated/replaced
- Feature was removed
- Information no longer relevant
- Temporary session notes

### How to Archive

1. Move to `archive/deprecated/` or `archive/session_notes/`
2. Add deprecation notice at top of old doc:
   ```markdown
   > **⚠️ DEPRECATED**
   > This document is outdated. See [NEW_DOC.md](../path/to/new_doc.md)
   ```
3. Update links pointing to old doc
4. Document in CHANGELOG

---

## Rule 8: Documentation Maintenance

### Regular Reviews

- **Weekly:** Check for broken links (automated if possible)
- **Monthly:** Review recently added docs for accuracy
- **Quarterly:** Full documentation audit
- **Per Release:** Update all version numbers and outdated info

### Update Triggers

Update documentation immediately when:
- ✅ Feature is added/changed
- ✅ API endpoint is modified
- ✅ Bug is fixed that affects user behavior
- ✅ Configuration options change
- ✅ New troubleshooting pattern emerges

---

## Rule 9: Writing Style

### Guidelines

- **Clarity over cleverness** - Simple language
- **Active voice** - "Click START" not "START should be clicked"
- **Imperative mood for instructions** - "Do this" not "You should do this"
- **Present tense** - "The system validates" not "The system will validate"
- **Code blocks for code** - Always use syntax highlighting
- **Examples for everything** - Show, don't just tell

### Markdown Standards

```markdown
# H1 for document title (only one per doc)
## H2 for major sections
### H3 for subsections
#### H4 for details (rarely needed)

**Bold** for emphasis and UI elements
*Italic* for technical terms on first use
`code` for inline code, filenames, parameters
```

### Code Block Guidelines

Always specify language:
````markdown
```typescript
const example = 'use language identifier';
```

```bash
npm install  # use bash for shell commands
```
````

---

## Rule 10: Enforcement

### For Human Contributors

1. Read `CONTRIBUTING.md` before contributing
2. Follow documentation checklist after every feature
3. PR reviewers must verify documentation completeness
4. No merge without proper documentation

### For AI Contributors

1. AI must follow these rules automatically (via `.cursorrules`)
2. AI must ask if unsure about documentation type
3. AI must update docs after code changes
4. AI must suggest documentation improvements

---

## Examples

### Example 1: Adding New Feature

**Scenario:** Added new "dice roll logging" feature

**Documentation checklist:**
1. ✅ Updated `CHANGELOG.md` with v2.4.0 entry
2. ✅ Created `docs/features/DICE_ROLL_LOGGING.md`
3. ✅ Updated `docs/guides/GAME_STATE_GUIDE.md` with usage
4. ✅ Created `docs/api/DICE_ROLL_ENDPOINT.md`
5. ✅ Updated `README.md` feature list
6. ✅ Updated `docs/README.md` index

### Example 2: Fixing Bug

**Scenario:** Fixed audio validation bug

**Documentation checklist:**
1. ✅ Updated `CHANGELOG.md` under "Fixed"
2. ✅ Updated `docs/guides/AUDIO_VAD_GUIDE.md` troubleshooting section
3. ✅ No new docs needed (bug fix)

### Example 3: Adding API Endpoint

**Scenario:** Added `/api/dice-roll` endpoint

**Documentation checklist:**
1. ✅ Updated `CHANGELOG.md`
2. ✅ Created `docs/api/DICE_ROLL_ENDPOINT.md`
3. ✅ Updated `docs/features/DICE_ROLL_LOGGING.md` to reference API
4. ✅ Updated `docs/README.md` API section

---

## Quick Reference

| Task | Type | Location | Template |
|------|------|----------|----------|
| New user-facing feature | Feature + Guide | `docs/features/` + `docs/guides/` | See Rule 3 |
| New API endpoint | API Doc | `docs/api/ENDPOINT_NAME.md` | See Rule 3 |
| New complex system | Guide | `docs/guides/SYSTEM_GUIDE.md` | See Rule 3 |
| Found common problem | Troubleshooting | `docs/troubleshooting/PROBLEM.md` | See Rule 3 |
| Bug fix | CHANGELOG | `CHANGELOG.md` | Add under "Fixed" |

---

## Violations

**Common violations and how to fix:**

| Violation | Fix |
|-----------|-----|
| Created `FEATURE_COMPLETE.md` | Move to `archive/session_notes/`, update CHANGELOG instead |
| No table of contents | Add TOC after Overview section |
| Missing "Last Updated" | Add to header with current date |
| Duplicate content | Consolidate into one doc, cross-reference |
| Vague filename `DOCS.md` | Rename to descriptive name like `FEATURE_NAME_GUIDE.md` |
| No related documentation links | Add Related Documentation section at end |

---

## Questions?

See:
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Full contribution guidelines
- [docs/README.md](README.md) - Documentation index
- [DOCUMENTATION_CONSOLIDATION_PLAN.md](../DOCUMENTATION_CONSOLIDATION_PLAN.md) - Why these standards exist

---

**These standards are mandatory. No exceptions.** 📋✅
