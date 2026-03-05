# Learnings

Project-specific concepts, technical gotchas, and bug fixes worth remembering.

### 2026-03-04 — Skill Development / Claude Code

- **Pattern**: Skills in `~/.claude/skills/` are picked up live immediately after the directory is created — no restart or reload needed
- **Command**: Initialize a new global skill: `python3 ~/.claude/skills/skill-creator/scripts/init_skill.py <skill-name> --path ~/.claude/skills/`
- **Gotcha**: `package_skill.py` requires `pyyaml` (`import yaml`) — packaging fails without it, but the skill works fine as a plain directory; `.skill` file is only needed for distribution
- **Pattern**: SKILL.md `description` field is the primary trigger mechanism — Claude reads it to decide when to invoke the skill, so include explicit trigger phrases and use cases
- **Gotcha**: The `Write` tool refuses to overwrite a file not yet read in the current session — always `Read` first before `Write`, even when replacing the entire contents
- **Gotcha**: The `Edit` tool requires `old_string` to match exactly (including whitespace) — when a match fails, use `Write` on the full file after reading it
