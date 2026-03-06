# AutoCart Agent Instructions (Claude + Codex)

This repo uses "skills": small, scoped playbooks stored in `SKILL.md` files.

## How To Use Skills

- **Discovery**: Skills are listed below with `name`, `description`, and the `SKILL.md` path.
- **Trigger rules**: If the user names a skill (e.g. `/gitpush`, `$gitpush`, or `gitpush`) OR the task clearly matches a skill's description, open that skill's `SKILL.md` and follow it for this turn.
- **Multiple matches**: Use the minimal set of skills that covers the request. If multiple skills apply, state the order and use them in that order.
- **Scope**: Skills under `cart/.claude/skills` are AutoCart-specific playbooks. Skills under `.claude/skills` are general playbooks for this repo.
- **Note**: Some `.claude` skills describe "sub-agents" that exist in Claude workflows. Codex should still follow the instruction playbook, but cannot invoke Claude-only tooling.

## Repo Skills (from `.claude/skills`)

- `bug-fix` — Use when a user reports a specific bug/error/test failure. (file: `/Users/ash/Desktop/AutoCart/.claude/skills/bug-fix/SKILL.md`)
- `code-architect` — DEPRECATED (merged into `code-implementation`). (file: `/Users/ash/Desktop/AutoCart/.claude/skills/code-architect/SKILL.md`)
- `code-implementation` — Implement features, refactors, known-root-cause fixes (includes plan + review). (file: `/Users/ash/Desktop/AutoCart/.claude/skills/code-implementation/SKILL.md`)
- `code-reviewer` — Review/validate an implementation against plan + standards. (file: `/Users/ash/Desktop/AutoCart/.claude/skills/code-reviewer/SKILL.md`)
- `coding-workflow` — End-to-end workflow: plan → implement → review → docs. (file: `/Users/ash/Desktop/AutoCart/.claude/skills/coding-workflow/SKILL.md`)
- `debate` — See skill file for usage. (file: `/Users/ash/Desktop/AutoCart/.claude/skills/debate/SKILL.md`)
- `deploy` — See skill file for usage. (file: `/Users/ash/Desktop/AutoCart/.claude/skills/deploy/SKILL.md`)
- `document-changes` — See skill file for usage. (file: `/Users/ash/Desktop/AutoCart/.claude/skills/document-changes/SKILL.md`)
- `explain` — See skill file for usage. (file: `/Users/ash/Desktop/AutoCart/.claude/skills/explain/SKILL.md`)
- `frontend-design` — High-quality UI/UX implementation playbook. (file: `/Users/ash/Desktop/AutoCart/.claude/skills/frontend-design/SKILL.md`)
- `gitpush` — Safely push to GitHub while avoiding sensitive files. (file: `/Users/ash/Desktop/AutoCart/.claude/skills/gitpush/SKILL.md`)
- `integration-test-validator` — Comprehensive testing validation before shipping. (file: `/Users/ash/Desktop/AutoCart/.claude/skills/integration-test-validator/SKILL.md`)
- `investigator` — Investigate unclear root-cause issues before fixing. (file: `/Users/ash/Desktop/AutoCart/.claude/skills/investigator/SKILL.md`)
- `landing-page` — Conversion-oriented landing page playbook. (file: `/Users/ash/Desktop/AutoCart/.claude/skills/landing-page/SKILL.md`)
- `linkedin-post` — Write a LinkedIn announcement/update. (file: `/Users/ash/Desktop/AutoCart/.claude/skills/linkedin-post/SKILL.md`)
- `receiving-code-review` — Handle review feedback with technical rigor. (file: `/Users/ash/Desktop/AutoCart/.claude/skills/receiving-code-review/SKILL.md`)
- `screen-recording` — Automated polished screen recording workflow. (file: `/Users/ash/Desktop/AutoCart/.claude/skills/screen-recording/SKILL.md`)
- `skill-creator` — Create/update a skill playbook. (file: `/Users/ash/Desktop/AutoCart/.claude/skills/skill-creator/SKILL.md`)
- `summarize` — Summarize this session/conversation and changes. (file: `/Users/ash/Desktop/AutoCart/.claude/skills/summarize/SKILL.md`)
- `superdesign` — See skill file for usage. (file: `/Users/ash/Desktop/AutoCart/.claude/skills/superdesign/SKILL.md`)
- `system-arch` — Architecture design/tradeoff playbook. (file: `/Users/ash/Desktop/AutoCart/.claude/skills/system-arch/SKILL.md`)
- `tutor` — See skill file for usage. (file: `/Users/ash/Desktop/AutoCart/.claude/skills/tutor/SKILL.md`)
- `validation` — Brutally honest architecture/design validation. (file: `/Users/ash/Desktop/AutoCart/.claude/skills/validation/SKILL.md`)

## AutoCart Skills (from `cart/.claude/skills`)

- `agent-marketplace-patterns` — AutoCart marketplace patterns: escrow, lifecycle, hashing, matching. (file: `/Users/ash/Desktop/AutoCart/cart/.claude/skills/agent-marketplace-patterns/SKILL.md`)
- `hardhat-workflow` — Hardhat compile/node/deploy/tests workflow. (file: `/Users/ash/Desktop/AutoCart/cart/.claude/skills/hardhat-workflow/SKILL.md`)
- `web3py-integration` — web3.py integration patterns: txns, events, signing. (file: `/Users/ash/Desktop/AutoCart/cart/.claude/skills/web3py-integration/SKILL.md`)

## Codex-Installed Skills (global)

- `find-skills` — Discover/install skills when user asks "is there a skill for...". (file: `/Users/ash/.agents/skills/find-skills/SKILL.md`)
- `simplify` — Simplify code while preserving behavior. (file: `/Users/ash/.codex/skills/simplify/SKILL.md`)
- `symptoms` — Structured debugging from symptoms to fix. (file: `/Users/ash/.codex/skills/symptoms/SKILL.md`)
- `test-engineer` — Design/execute structured test cases and report blockers. (file: `/Users/ash/.codex/skills/test-engineer/SKILL.md`)
- `skill-creator` — Create/update Codex skills. (file: `/Users/ash/.codex/skills/.system/skill-creator/SKILL.md`)
- `skill-installer` — Install Codex skills into `$CODEX_HOME/skills`. (file: `/Users/ash/.codex/skills/.system/skill-installer/SKILL.md`)

