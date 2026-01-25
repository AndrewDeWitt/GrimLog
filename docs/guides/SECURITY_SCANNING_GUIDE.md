# Security Scanning Guide

**Last Updated:** 2026-01-18
**Status:** Complete

## Overview

Grimlog includes a comprehensive security scanning workflow for development. This guide covers the tools, commands, and CI pipeline for maintaining secure code.

## Table of Contents

- [Quick Start](#quick-start)
- [Available Commands](#available-commands)
- [Tools Overview](#tools-overview)
- [Pre-commit Hooks](#pre-commit-hooks)
- [CI Pipeline](#ci-pipeline)
- [Local Tool Installation](#local-tool-installation)
- [Configuration Files](#configuration-files)
- [Supabase Security](#supabase-security)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

```bash
# Run all security checks
npm run security:all

# Run individual checks
npm run security:audit      # Dependency vulnerabilities
npm run security:secrets    # Hardcoded secrets (requires gitleaks CLI)
npm run security:semgrep    # Static analysis (requires semgrep CLI)
```

---

## Available Commands

| Command | Description | Requires CLI |
|---------|-------------|--------------|
| `npm run security:audit` | Check dependencies for known vulnerabilities | No |
| `npm run security:audit:fix` | Auto-fix vulnerable dependencies | No |
| `npm run security:secrets` | Scan for hardcoded secrets | Yes (gitleaks) |
| `npm run security:semgrep` | Static code analysis | Yes (semgrep) |
| `npm run security:all` | Run all checks sequentially | Yes (both) |
| `npm run lint` | ESLint with security rules | No |

---

## Tools Overview

### 1. npm audit (Dependency Scanning)

Checks `package-lock.json` for known vulnerabilities in dependencies.

```bash
# Check for vulnerabilities (moderate+ severity)
npm run security:audit

# Auto-fix where possible
npm run security:audit:fix

# Force fix (may include breaking changes)
npm audit fix --force
```

**When to run:** Before deployments, after adding new dependencies.

### 2. Gitleaks (Secret Detection)

Scans code for hardcoded secrets (API keys, passwords, tokens).

```bash
# Scan entire repo
npm run security:secrets

# Scan only staged files (pre-commit)
gitleaks protect --staged --verbose
```

**What it detects:**
- API keys (OpenAI, Google, Supabase)
- Database connection strings
- JWT secrets
- High-entropy strings

### 3. Semgrep (Static Analysis)

Pattern-based code analysis for security vulnerabilities.

```bash
# Run with Next.js and TypeScript rules
npm run security:semgrep
```

**What it detects:**
- SQL injection
- XSS vulnerabilities
- Insecure configurations
- Next.js-specific issues

### 4. ESLint Security Plugin

Integrated into the standard lint command.

```bash
npm run lint
```

**Rules enabled:**
- `security/detect-object-injection` - Dynamic property access
- `security/detect-unsafe-regex` - ReDoS vulnerabilities
- `security/detect-eval-with-expression` - Eval usage
- `security/detect-child-process` - Command injection risks
- `security/detect-non-literal-fs-filename` - Path traversal
- And 9 more rules

---

## Pre-commit Hooks

Husky runs security checks automatically before each commit.

### What runs on commit:

1. **Gitleaks** - Blocks commits containing secrets
2. **lint-staged** - ESLint on staged `.ts`/`.tsx` files

### Hook location:

`.husky/pre-commit`

### Bypassing hooks (use sparingly):

```bash
git commit --no-verify -m "message"
```

---

## CI Pipeline

GitHub Actions runs comprehensive security scans on every push/PR.

### Workflow: `.github/workflows/security.yml`

**Triggers:**
- Push to `master`/`main`
- Pull requests to `master`/`main`
- Weekly scheduled scan (Sunday midnight)
- Manual dispatch

**Jobs:**

| Job | Description | Fails build on |
|-----|-------------|----------------|
| `dependency-audit` | npm audit | Critical/High vulnerabilities |
| `secret-scanning` | Gitleaks | Any detected secrets |
| `semgrep` | Static analysis | Errors (results uploaded as artifact) |
| `eslint-security` | ESLint | Lint errors |

---

## Local Tool Installation

### Gitleaks (Recommended)

```bash
# Windows (scoop)
scoop install gitleaks

# macOS (brew)
brew install gitleaks

# Or download from: https://github.com/gitleaks/gitleaks/releases
```

### Semgrep (Optional - CI handles this)

```bash
# pip
pip install semgrep

# Or use Docker for one-off scans
docker run --rm -v "${PWD}:/src" semgrep/semgrep semgrep scan --config auto
```

---

## Configuration Files

### `.gitleaks.toml`

Gitleaks configuration with:
- Default rules extended
- Ignored paths (node_modules, .next, etc.)
- Custom Supabase secret patterns

### `eslint.config.mjs`

Flat config ESLint with:
- `next/core-web-vitals` base
- `eslint-plugin-security` rules
- Custom rule severity levels

### `.github/workflows/security.yml`

CI pipeline configuration.

---

## Supabase Security

Grimlog uses Prisma for database access (server-side only). The Supabase configuration reflects this:

### Current Configuration

| Setting | Value | Reason |
|---------|-------|--------|
| RLS | Disabled on all tables | Prisma bypasses RLS anyway |
| RLS Policies | None | Removed for consistency |
| anon/authenticated access | Revoked | Blocks direct PostgREST access |

### Why this is secure:

1. **No client-side DB access** - All queries go through API routes
2. **Prisma uses service role** - Connects directly to Postgres
3. **anon key exposure is safe** - Can't access tables even with key
4. **API routes handle auth** - Supabase Auth + custom middleware

### Checking Supabase advisors:

Use the Supabase MCP or dashboard to run security advisors:

```
Project → Settings → Database → Advisors → Security
```

Current expected warnings:
- "Leaked Password Protection Disabled" - Enable in Auth settings if desired

---

## Troubleshooting

### "gitleaks: command not found"

Install gitleaks locally or skip with `git commit --no-verify`.

### "semgrep: command not found"

Semgrep is optional locally. CI will run it on push.

### npm audit shows vulnerabilities

```bash
# Try auto-fix first
npm audit fix

# Check what would change with force
npm audit fix --dry-run --force

# If low severity in transitive deps, may be safe to ignore
```

### ESLint security warnings

Most `security/detect-object-injection` warnings are false positives for array access. Review each case:

```typescript
// False positive (safe)
const item = items[index];  // index is a number

// Actual risk (review)
const value = obj[userInput];  // userInput from request
```

### Pre-commit hook blocks commit

1. Check the error message for which secret was detected
2. If false positive, add to `.gitleaks.toml` allowlist
3. If real secret, remove it and use environment variables

---

## Related Documentation

- [Configuration Guide](CONFIGURATION_GUIDE.md) - Environment variables setup
- [CHANGELOG](../../CHANGELOG.md) - Version 4.89.0 security additions
