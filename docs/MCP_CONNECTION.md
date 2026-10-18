# MCP Connection Guide

## 1. Purpose
Model Context Protocol (MCP) can expose approved tools or data sources to compatible AI clients. MCP is optional and is not required for the core placement system unless a specific integration is approved.

## 2. Before Adding MCP
Define:
- User problem and expected benefit
- MCP server and tool ownership
- Data that the server can read or modify
- Authentication method
- Permission boundaries
- Network exposure and audit logging
- Failure behavior and operational owner

## 3. Safe Integration Pattern
```text
Approved AI client
      |
      v
MCP client connection
      |
      v
Authenticated MCP server
      |
      v
Narrowly scoped tools
      |
      v
Existing application service/API
      |
      v
Database (through existing authorization and validation)
```
Do not give an MCP server unrestricted database access or bypass application authorization.

## 4. Tool Design
- Prefer narrow, purpose-specific tools.
- Validate all arguments.
- Enforce user and role permissions on every call.
- Require confirmation for destructive or externally visible actions.
- Return only the minimum necessary data.
- Apply timeouts, rate limits, and audit logs.
- Do not expose secrets in tool results.

## 5. Read-Only First
Start with read-only tools such as aggregate placement statistics or a user's own application summary. Add write operations only after a threat review and explicit product approval.

## 6. Configuration
Record the actual MCP client/server, transport, authentication, environment variables, and deployment details only after they are selected. Do not invent server URLs or credentials.

## 7. Tests
Cover invalid arguments, unauthenticated use, wrong roles, data isolation, timeouts, unavailable servers, and attempts to invoke disallowed operations.
