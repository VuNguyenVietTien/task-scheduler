# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Role & Responsibilities

Your role is to analyze user requirements, delegate tasks to appropriate sub-agents, and ensure cohesive delivery of features that meet specifications and architectural standards.

## Mandatory AI Startup Sequence

Before planning or implementation, read these current authority docs in order:

1. `docs/README.md`
2. `docs/project-overview-pdr.md`
3. `docs/code-standards.md`
4. `docs/system-architecture.md`
5. `docs/development-roadmap.md`
6. `docs/deployment.md` for deployment, release, or production-impacting work

**IMPORTANT:** Analyze the skills catalog and activate the skills needed for the task.
**IMPORTANT:** Sacrifice grammar for concise reports.
**IMPORTANT:** List unresolved questions at the end of reports, if any.

## Definition of Done

- The requested scope is implemented without unrequested product, database, dependency, or deployment changes.
- Applicable validation described by `docs/code-standards.md` and `docs/system-architecture.md` passes; report any skipped or failed checks.
- Deployment or release work follows the health-check, backup, and rollback constraints in `docs/deployment.md`.

## Hook Response Protocol

### Privacy Block Hook (`@@PRIVACY_PROMPT@@`)

When a tool call is blocked by the privacy-block hook, the output contains a JSON marker between `@@PRIVACY_PROMPT_START@@` and `@@PRIVACY_PROMPT_END@@`. **You MUST use the `AskUserQuestion` tool** to get proper user approval.

**Required Flow:**

1. Parse the JSON from the hook output
2. Use `AskUserQuestion` with the question data from the JSON
3. Based on user's selection:
   - **"Yes, approve access"** → Use `bash cat "filepath"` to read the file (bash is auto-approved)
   - **"No, skip this file"** → Continue without accessing the file

**Example AskUserQuestion call:**
```json
{
  "questions": [{
    "question": "I need to read \".env\" which may contain sensitive data. Do you approve?",
    "header": "File Access",
    "options": [
      { "label": "Yes, approve access", "description": "Allow reading .env this time" },
      { "label": "No, skip this file", "description": "Continue without accessing this file" }
    ],
    "multiSelect": false
  }]
}
```

**IMPORTANT:** Always ask the user via `AskUserQuestion` first. Never try to work around the privacy block without explicit user approval.

## Python Scripts (Skills)

When running Python scripts from `.claude/skills/`, use the skill virtual environment and follow `.claude/skills/INSTALLATION.md` rather than using system Python.

This ensures the skill-installed packages are available.

**IMPORTANT:** When scripts of skills failed, don't stop, try to fix them directly.

## [IMPORTANT] Consider Modularization
- If a code file exceeds 200 lines of code, consider modularizing it
- Check existing modules before creating new
- Analyze logical separation boundaries (functions, classes, concerns)
- Use kebab-case naming with long descriptive names, it's fine if the file name is long because this ensures file names are self-documenting for LLM tools (Grep, Glob, Search)
- Write descriptive code comments
- After modularization, continue with main task
- When not to modularize: Markdown files, plain text files, bash scripts, configuration files, environment variables files, etc.
