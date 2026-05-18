# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Repository is currently empty. No source code, configuration, or documentation exists yet.

## When code is added

Update this file with:

- **Commands**: build, lint, test, run-single-test, dev server start.
- **Architecture**: high-level structure that requires reading multiple files to grasp (e.g., command/event dispatch flow, Discord client lifecycle, persistence layer, deployment pipeline).
- **Conventions**: project-specific patterns not obvious from reading any single file.

## Likely scope (inferred from directory name)

Discord bot project. When scaffolding, expect:

- Discord library (discord.py, discord.js, serenity, etc.) — pick one and document.
- Token/secret loading (env vars, `.env`, secret manager) — document the path, never commit secrets.
- Command registration model (slash commands vs. prefix, guild-scoped vs. global) — document deployment/registration command.
