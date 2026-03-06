# Learnings

Project-specific concepts, technical gotchas, and bug fixes worth remembering.

### 2026-03-04 — Skill Development / Claude Code

- **Pattern**: Skills in `~/.claude/skills/` are picked up live immediately after the directory is created — no restart or reload needed
- **Command**: Initialize a new global skill: `python3 ~/.claude/skills/skill-creator/scripts/init_skill.py <skill-name> --path ~/.claude/skills/`
- **Gotcha**: `package_skill.py` requires `pyyaml` (`import yaml`) — packaging fails without it, but the skill works fine as a plain directory; `.skill` file is only needed for distribution
- **Pattern**: SKILL.md `description` field is the primary trigger mechanism — Claude reads it to decide when to invoke the skill, so include explicit trigger phrases and use cases
- **Gotcha**: The `Write` tool refuses to overwrite a file not yet read in the current session — always `Read` first before `Write`, even when replacing the entire contents
- **Gotcha**: The `Edit` tool requires `old_string` to match exactly (including whitespace) — when a match fails, use `Write` on the full file after reading it

### 2026-03-05 — Git / First Push to New Repo

- **Gotcha**: `.gitignore` pattern `.env` does NOT match `.env.local` or `.env.*` — must explicitly add `.env.*` and `.env.local` to cover all dotenv variants
- **Command**: First push to a new empty remote: `git remote add origin <url>` then `git push -u origin main` (the `-u` sets upstream tracking)
- **Gotcha**: `git status` exits with code 1 when there are unstaged changes — causes `&&` chains to abort early; use `;` separator or put `git status` last in a chain
- **Gotcha**: `git config user.name` exits with code 1 when not set — check with `; echo $?` or handle separately from other commands in a chain
- **Pattern**: Project-specific `cart/.claude/skills/` SKILL.md files are safe to include in a public push — they're documentation, not credentials; the root `.claude/` (with settings.json, mcp/servers.json) should always remain untracked
- **Config**: `cart/frontend/.env.local` only contains local dev config (contract address `0x5FbDB...`, WS URL `ws://localhost:8545`, chain ID 31337) — not secrets, but env-specific so should be in `.gitignore`
