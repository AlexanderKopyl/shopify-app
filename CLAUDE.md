# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Shopify embedded app named "zoo-product-form" built with React Router v7. The app uses the `write_products` scope and is designed to be embedded within the Shopify admin interface.

## Development Commands

### Essential Commands
- `npm run dev` - Start local development server with Shopify CLI (includes tunneling and hot reload)
- `npm run build` - Build the app for production
- `npm run setup` - Initialize database (runs `prisma generate && prisma migrate deploy`)
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking and generate React Router types

### Shopify CLI Commands
- `npm run deploy` - Deploy app to Shopify
- `npm run config:link` - Link to a Shopify app configuration
- `npm run generate` - Generate Shopify app extensions
- `npm run env` - Manage environment variables

### Database & Code Generation
- `npm run prisma` - Access Prisma CLI
- `npm run graphql-codegen` - Generate GraphQL types from queries/mutations

## Architecture

### Tech Stack
- **Framework**: React Router v7 (file-based routing)
- **UI**: Polaris Web Components (s-* custom elements like `<s-page>`, `<s-button>`)
- **Database**: Prisma with SQLite (session storage only)
- **API**: Shopify Admin GraphQL API (October25 version)
- **Authentication**: Shopify App Bridge with Prisma session storage

### Project Structure

```
app/
  routes/          # React Router v7 file-based routes
    app.jsx        # Layout for authenticated app routes (includes AppProvider)
    app._index.jsx # Main app page at /app
    auth.*.jsx     # Authentication routes
    webhooks.*.jsx # Webhook handlers
  shopify.server.js # Main Shopify app configuration
  db.server.js     # Prisma client singleton
  root.jsx         # Root layout
  entry.server.jsx # Server entry point
extensions/        # Shopify app extensions (currently empty)
prisma/
  schema.prisma    # Database schema (Session model only)
```

### Key Configuration Files
- `shopify.app.toml` - Shopify app configuration (webhooks, scopes, client_id)
- `.mcp.json` - Shopify Dev MCP server configuration for AI assistants
- `.graphqlrc.js` - GraphQL codegen configuration for Admin API
- `vite.config.js` - Vite configuration with HMR and tunnel support

## Important Patterns

### Authentication
All routes under `/app/*` are authenticated via `authenticate.admin(request)` in loaders. The main Shopify instance is exported from `app/shopify.server.js`:

```javascript
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  // Use admin.graphql() for API calls
};
```

### GraphQL Queries
Use tagged template literals with `#graphql` comment for GraphQL codegen:

```javascript
const response = await admin.graphql(
  `#graphql
    mutation populateProduct($product: ProductCreateInput!) {
      productCreate(product: $product) {
        product { id title }
      }
    }`,
  { variables: { product: { title: "Example" } } }
);
```

### Embedded App Navigation
**CRITICAL**: In embedded apps, always use proper navigation components:
- Use `<s-link>` (Polaris) or `<Link>` from react-router, NEVER `<a>` tags
- Use `redirect` from `authenticate.admin`, NEVER `redirect` from react-router
- Use `useSubmit` from react-router for form submissions

Breaking these rules will break the embedded app session.

### Webhooks
Webhooks are configured in `shopify.app.toml` (app-specific subscriptions) and automatically synced on deploy. Webhook handlers are in `app/routes/webhooks.*.jsx` following the naming pattern `webhooks.{topic}.jsx`.

### UI Components
This app uses Polaris Web Components (not React components). All UI elements use the `<s-*>` prefix:
- `<s-page>`, `<s-section>`, `<s-button>`, `<s-link>`
- `<s-stack>`, `<s-box>`, `<s-paragraph>`, `<s-text>`
- `<s-app-nav>` for navigation (defined in `app/routes/app.jsx`)

### Error Boundaries
React Router routes that interact with Shopify must export an ErrorBoundary that calls `boundary.error()`:

```javascript
import { boundary } from "@shopify/shopify-app-react-router/server";

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
```

### Database
The database only stores Shopify session data (OAuth tokens). The Session model in `prisma/schema.prisma` is managed by Shopify's session storage adapter. Before first run, execute `npm run setup` to initialize the database.

## Environment Variables

Required environment variables (managed by Shopify CLI during development):
- `SHOPIFY_API_KEY` - App API key
- `SHOPIFY_API_SECRET` - App API secret
- `SCOPES` - OAuth scopes (comma-separated)
- `SHOPIFY_APP_URL` - App URL (for tunneling)
- `DATABASE_URL` - Database connection (Prisma)

## Common Development Tasks

### Adding New Routes
1. Create file in `app/routes/` following React Router v7 naming conventions
2. Routes under `app.*` are automatically authenticated
3. Export `loader` for GET requests, `action` for POST/PUT/DELETE
4. Include ErrorBoundary and headers exports for Shopify boundary handling

### Modifying Database Schema
1. Edit `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name <migration_name>`
3. Prisma client is automatically regenerated

### Adding Webhooks
1. Add webhook subscription to `shopify.app.toml` under `[[webhooks.subscriptions]]`
2. Create route handler at `app/routes/webhooks.{topic}.jsx`
3. Deploy with `npm run deploy` to sync changes

### GraphQL Type Generation
1. Write queries/mutations with `#graphql` comment
2. Run `npm run graphql-codegen` to generate types in `app/types/`
3. Types are based on Shopify Admin API October25 version

## Shopify Dev MCP

This app includes the Shopify Dev MCP server in `.mcp.json`, which provides AI assistants with access to Shopify documentation and API references. The MCP server is automatically available when using Claude Code, Cursor, or GitHub Copilot.