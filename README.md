# AI Agent Platform

A modern, high-performance monorepo for creating, managing, and running AI agents with OpenAI and the Model Context Protocol (MCP).

## 🏗️ Architecture

This project is a monorepo managed by [Turborepo](https://turbo.build/) and [pnpm](https://pnpm.io/).

### Apps

- **`apps/api`**: Express-based backend handling agent runtime, tool management, and MCP integration.
- **`apps/user`**: Next.js frontend for users to manage their agents and conversations.
- **`apps/admin`**: Admin dashboard for platform-wide management.

### Shared Packages

- **`@repo/db`**: Database schema and client using Drizzle ORM and PostgreSQL.
- **`@repo/config`**: Shared configuration management.
- **`@repo/eslint-config`**: Shared ESLint configurations.
- **`@repo/typescript-config`**: Shared TypeScript configurations.

## 🌟 Core Features

- **Agent Lifecycle Management**: Create, configure, and monitor agents with custom instructions and model parameters.
- **RAG (Retrieval-Augmented Generation)**: Integrated knowledge base support via OpenAI Vector Stores for file-based retrieval.
- **MCP Integration**: Seamlessly connect agents to Model Context Protocol servers (hosted, stdio, or HTTP).
- **Secure Credential Storage**: OpenAI API keys and other secrets are encrypted at rest using AES-GCM.
- **Session Authentication**: Robust session-based auth system.
- **Extensible Tooling**: Dynamic tool registration and discovery for agents.

## 🚀 Getting Started

### Prerequisites

- **Node.js**: >= 18
- **pnpm**: Global installation recommended
- **PostgreSQL**: Required for the database
- **Redis**: Required for the API (session management)

### Installation

```sh
pnpm install
```

### Environment Setup

1. Copy `.env.example` to `.env` in the root and relevant app directories.
2. Configure your database, Redis, and OpenAI credentials.

### Database Initialization

```sh
# Generate migrations
pnpm db:generate

# Apply migrations
pnpm db:migrate
```

### Development

Start the development environment for all apps and packages:

```sh
pnpm dev
```

- **User Dashboard**: `http://localhost:3000`
- **API Server**: `http://localhost:4000`

## 🛠️ Available Scripts

- `pnpm dev`: Runs all apps in watch mode.
- `pnpm build`: Builds all apps and packages for production.
- `pnpm lint`: Lints the entire codebase.
- `pnpm format`: Formats code with Prettier.
- `pnpm check-types`: Runs TypeScript type checking across the workspace.
- `pnpm db:studio`: Opens Drizzle Studio to explore the database.

## 🛡️ Security

Sensitive data (like API keys) is encrypted before being stored in the database. Ensure the `ENCRYPTION_KEY` is securely managed in your environment variables.

---
Built with ❤️ using Turborepo, Next.js, Express, and Drizzle.
