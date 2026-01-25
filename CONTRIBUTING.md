# Contributing to TacLog

**Thank you for considering contributing to TacLog!**

This document provides guidelines for contributing code, documentation, and features to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
- [Documentation Standards](#documentation-standards)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)

---

## Code of Conduct

- Be respectful and constructive
- Welcome newcomers and help them get started
- Focus on what is best for the community
- Show empathy towards other community members

---

## How to Contribute

### Reporting Bugs

1. Check existing issues to avoid duplicates
2. Use the bug report template
3. Include:
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser/OS information
   - Console errors or screenshots
   - Langfuse trace ID if applicable

### Suggesting Features

1. Open a feature request issue
2. Describe the problem it solves
3. Propose a solution
4. Consider impact on existing features

### Contributing Code

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Write/update tests if applicable
5. Update documentation
6. Submit a pull request

---

## Documentation Standards

**TacLog follows strict documentation standards to maintain clarity and ease of maintenance.**

📋 **See [Documentation Standards](docs/DOCUMENTATION_STANDARDS.md) for complete rules.**

### Quick Reference

**4 Documentation Types:**
1. **User Guides** (`docs/guides/`) - HOW TO use features
2. **API Docs** (`docs/api/`) - Technical reference
3. **Features** (`docs/features/`) - WHAT the feature is
4. **Troubleshooting** (`docs/troubleshooting/`) - FIX problems

**Post-Feature Checklist:**
1. ✅ Update `CHANGELOG.md`
2. ✅ Update or create relevant guide
3. ✅ Create feature doc (if major)
4. ✅ Update API docs (if endpoints changed)
5. ✅ Update `README.md` (if user-facing)
6. ✅ Update `docs/README.md` index

**What NOT to do:**
- ❌ Create `FEATURE_COMPLETE.md` files
- ❌ Keep session summaries in docs/
- ❌ Duplicate information
- ❌ Leave outdated docs in place

**Complete rules and examples:** [Documentation Standards](docs/DOCUMENTATION_STANDARDS.md)

---

## Development Workflow

### Setting Up Development Environment

```bash
# Clone the repository
git clone https://github.com/yourusername/taclog.git
cd taclog

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys

# Initialize database
npx prisma migrate dev

# Run development server
npm run dev
```

### Project Structure

```
warhammer_app/
├── app/                    # Next.js app directory
│   ├── api/               # API endpoints
│   └── [pages]/           # Page components
├── components/            # React components
├── lib/                   # Core libraries
│   ├── aiTools.ts         # AI tool definitions
│   ├── toolHandlers.ts    # Tool execution
│   ├── audioCapture.ts    # VAD & audio
│   └── types.ts           # TypeScript types
├── docs/                  # Documentation
│   ├── guides/           # User guides
│   ├── api/              # API reference
│   ├── features/         # Feature docs
│   └── troubleshooting/  # Problem solving
└── prisma/               # Database schema
```

### Code Style

- **TypeScript strict mode** - Required
- **ESLint** - Follow project configuration
- **Prettier** - Use for formatting
- **Comments** - For complex logic only
- **Naming**:
  - Components: PascalCase (`AudioIndicator`)
  - Functions: camelCase (`validateAudio`)
  - Constants: SCREAMING_SNAKE_CASE (`SILENCE_THRESHOLD`)
  - Files: Use component/function name

### Testing

```bash
# Run linter
npm run lint

# Type check
npx tsc --noEmit

# Manual testing checklist
- Test audio capture and VAD
- Test AI tool calling
- Test validation system
- Test session management
- Check console for errors
- Check Langfuse traces
```

---

## Pull Request Process

### Before Submitting

1. ✅ **Code compiles** without errors
2. ✅ **Linter passes** (`npm run lint`)
3. ✅ **Tests pass** (if applicable)
4. ✅ **Documentation updated** (following rules above)
5. ✅ **CHANGELOG.md updated** (if user-facing change)
6. ✅ **No breaking changes** (or clearly documented)

### PR Description Template

```markdown
## Description
[Brief description of changes]

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Refactor

## Related Issues
Closes #[issue number]

## Testing
[How you tested the changes]

## Documentation
- [ ] Updated relevant guides
- [ ] Updated API docs (if applicable)
- [ ] Updated CHANGELOG.md
- [ ] Updated README.md (if needed)

## Screenshots (if applicable)
[Add screenshots]

## Checklist
- [ ] Code follows project style
- [ ] Linter passes
- [ ] Documentation complete
- [ ] No console errors
- [ ] Tested in browser
```

### Review Process

1. Submit PR with clear description
2. Address reviewer feedback
3. Make requested changes
4. Re-request review
5. Once approved, maintainer will merge

---

## Areas for Contribution

### High Priority

- **Testing** - Add automated tests
- **Mobile optimization** - Improve tablet/phone UX
- **Documentation** - Fill gaps, improve clarity
- **Bug fixes** - Fix known issues
- **Performance** - Optimize API calls, rendering

### Medium Priority

- **Features from roadmap** (see README.md)
- **UI improvements** - Better error messages, loading states
- **Accessibility** - WCAG AA/AAA compliance
- **Internationalization** - Multi-language support

### Low Priority

- **Alternative game systems** - Support other tabletop games
- **Advanced analytics** - Game statistics, insights
- **Social features** - Share sessions, multiplayer

---

## Getting Help

- **Documentation**: Check [docs/README.md](docs/README.md)
- **Issues**: Browse existing issues or create new one
- **Discussions**: Use GitHub Discussions for questions
- **Langfuse**: Review traces to debug AI issues

---

## Recognition

Contributors will be recognized in:
- CHANGELOG.md (for features/fixes)
- README.md credits section
- GitHub contributors page

---

## License

By contributing to TacLog, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to TacLog!** 

Every contribution, no matter how small, helps make the project better. ⚙️
