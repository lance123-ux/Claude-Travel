# CLAUDE.md — AI Assistant Guide for Claude-Travel

This file provides instructions and conventions for AI assistants (Claude Code and similar tools) contributing to the **Claude-Travel** repository. Keep this file up to date as the project evolves.

---

## Project Overview

- **Repository:** `lance123-ux/Claude-Travel`
- **Remote:** `http://local_proxy@127.0.0.1:43106/git/lance123-ux/Claude-Travel`
- **Current State:** New, empty repository. No source code has been added yet.
- **Purpose:** A travel-related application (details to be defined as development begins).

> Update this section once a tech stack and project scope are finalized.

---

## Repository Structure

The repository is currently empty. Expected layout once code is added:

```
Claude-Travel/
├── CLAUDE.md              ← This file (AI assistant guide)
├── README.md              ← Project overview for humans
├── .gitignore
├── src/                   ← Primary source code
│   ├── components/        ← UI components
│   ├── pages/ or app/     ← Routes / pages
│   ├── lib/ or utils/     ← Shared utilities
│   ├── hooks/             ← Custom hooks (if React-based)
│   ├── types/             ← Type definitions
│   └── styles/            ← CSS / styling
├── public/                ← Static assets
├── tests/                 ← Test files
└── ...                    ← Config files (package.json, tsconfig.json, etc.)
```

Update this section to reflect the actual directory structure once files are added.

---

## Branch Naming Conventions

| Branch Type | Pattern | Example |
|-------------|---------|---------|
| Claude AI branches | `claude/<short-description>-<session-id>` | `claude/claude-md-mlstgdyapeb1ogzj-DcsIS` |
| Feature branches | `feature/<description>` | `feature/add-hotel-search` |
| Bug fixes | `fix/<description>` | `fix/map-rendering-error` |

**Rules:**
- Never commit directly to `main` or `master`.
- All Claude-generated branches **must** start with `claude/` and end with the matching session ID — pushes to incorrectly named branches will fail with HTTP 403.
- Create the branch locally before pushing if it doesn't exist yet.

---

## Development Workflow

### For AI Assistants (Claude Code)

1. **Check out the correct branch** before making any changes:
   ```bash
   git checkout claude/<description>-<session-id>
   # or create it if it doesn't exist:
   git checkout -b claude/<description>-<session-id>
   ```

2. **Read files before editing** — never modify a file without reading it first.

3. **Make the minimal change** necessary to fulfill the task. Do not refactor surrounding code, add extra features, or "clean up" unrelated areas.

4. **Commit with a clear message** (see commit conventions below).

5. **Push to the designated branch:**
   ```bash
   git push -u origin <branch-name>
   ```

6. If push fails due to a **network error**, retry up to 4 times with exponential backoff (2s → 4s → 8s → 16s). If push fails with HTTP 403, check that the branch name matches the required pattern.

### For Human Developers

- Open a pull request from your feature branch into `main`.
- Ensure tests pass and lint is clean before requesting review.
- Squash or rebase commits before merging when possible.

---

## Git Commit Conventions

- Use **imperative mood** for commit messages: `Add hotel search`, not `Added hotel search`.
- Keep the summary line under **72 characters**.
- Add a blank line between the summary and any extended description.
- AI-generated commits should include the Claude session URL at the end of the message body.

**Example:**
```
Add CLAUDE.md with project conventions and AI assistant guide

Establishes baseline branch conventions, workflow rules, and coding
standards for both human developers and AI assistants contributing
to this repository.

https://claude.ai/code/session_<session-id>
```

**Do not:**
- Use `git add -A` or `git add .` unless absolutely necessary — stage specific files by name to avoid accidentally including secrets or binaries.
- Commit `.env` files, credentials, or large binary assets.
- Amend published commits — create a new commit instead.
- Use `--no-verify` to bypass pre-commit hooks unless explicitly instructed.

---

## Coding Conventions (To Be Defined)

> Update this section once a tech stack is chosen. Below are general defaults.

### General
- Prefer clarity over cleverness.
- Avoid premature abstraction — three similar lines is better than a helper that's only used once.
- Use descriptive variable and function names.
- Delete code that is no longer used instead of commenting it out.

### Functions / Modules
- Keep functions small and focused on a single responsibility.
- Co-locate related code — put utilities near where they're used, not in a shared folder, until genuinely shared.

### Error Handling
- Only handle errors at system boundaries (user input, external APIs, file I/O).
- Trust internal framework guarantees — don't add redundant null checks on values guaranteed by the framework.
- Avoid silent failures: if an error is caught, either handle it meaningfully or re-throw it.

### Testing
- Write tests for business logic and edge cases, not for implementation details.
- Prefer integration tests over unit tests where practical.
- Test files should live alongside the code they test or in a top-level `tests/` directory (choose one and be consistent).

### Security
- Never hardcode secrets, API keys, or credentials — use environment variables.
- Validate and sanitize all user input at entry points.
- Avoid common vulnerabilities: SQL injection, XSS, command injection, SSRF.
- Do not expose internal error messages to end users.

---

## Environment Variables

Sensitive configuration values must never be committed. Use a `.env` file (excluded by `.gitignore`) and document all required variables in a `.env.example` file that **is** committed.

Example `.env.example` format:
```
# API keys
SOME_API_KEY=your_key_here

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## AI Assistant Rules (Important)

These rules apply to all AI assistants (Claude Code, Copilot, etc.) working on this codebase:

1. **Read before you edit.** Always use the Read tool (or equivalent) on a file before modifying it.
2. **Minimal changes only.** Only make changes directly requested or clearly necessary. Do not refactor, rename, or "improve" surrounding code.
3. **No unnecessary files.** Do not create new files unless explicitly required for the task. Prefer editing existing files.
4. **No speculative features.** Do not add error handling, fallbacks, logging, or configuration for scenarios that haven't been asked for.
5. **No unsolicited comments or docs.** Only add comments where the logic is genuinely non-obvious. Do not add docstrings or type annotations to code you did not change.
6. **No over-abstraction.** Do not create helpers, utilities, or base classes for code that exists in only one place.
7. **Verify destructive actions.** Before deleting files, dropping tables, force-pushing, or any other irreversible operation, confirm with the user.
8. **Track work with todo lists.** Use the TodoWrite tool for multi-step tasks to show progress and ensure nothing is missed.
9. **Use dedicated tools over shell.** Prefer Read/Edit/Write/Glob/Grep over running `cat`, `grep`, `find`, or `sed` in a shell.
10. **Ask when blocked.** If you cannot determine the right approach, ask the user rather than guessing or retrying the same failed action.

---

## Running the Project

> This section will be populated once the tech stack and setup steps are defined.

Placeholder:
```bash
# Install dependencies
# (to be filled in)

# Start development server
# (to be filled in)

# Run tests
# (to be filled in)

# Build for production
# (to be filled in)
```

---

## Keeping This File Up to Date

As the project grows, update `CLAUDE.md` to reflect:
- The finalized tech stack and actual directory structure
- Project-specific coding conventions
- API patterns and data models
- Authentication / authorization approach
- CI/CD pipeline details
- Any domain-specific rules for a travel application (e.g., timezone handling, currency formatting, map integrations)

This file is the primary reference for any AI assistant working in this repository. Keeping it accurate reduces errors and ensures consistent contributions.
