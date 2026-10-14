# Agent Instructions

## Plan before code (non-negotiable)

Before writing feature code, run the EAI `plan-before-code` skill (source:
`enterpriseaigroup/eai-stack` `.claude/skills/plan-before-code/`; available in the
EAI Repos workspace for Claude Code, Codex, and Copilot `/plan-feature`). It is
required for new features, screens, or routes; cross-cutting contract changes;
tenant, auth, role, or region logic; and work spanning two or more repos.

The plan lives at `.specify-pro/specs/<feature>/plan.md`, or
`.specify/specs/<feature>/plan.md` in repos that use Gofer, and needs dated
Product and CEO approval of the 80:20 MVP scope before implementation. PR bodies carry
`Plan: <path or URL>` or `Plan: exempt — <reason>`; the `plan-gate` workflow
checks this. Policy: tech-docs `docs/how-to/how-we-work/plan-before-code.md`.
