This is a [Next.js](https://nextjs.org) project bootstrapped with `[create-next-app](https://nextjs.org/docs/app/api-reference/cli/create-next-app)`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses `[next/font](https://nextjs.org/docs/app/building-your-application/optimizing/fonts)` to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

1. Import [this repo](https://github.com/RobNatt/seo-geo-automations) in the [Vercel dashboard](https://vercel.com/new) (framework: Next.js; leave defaults).
2. Add environment variables from [`.env.example`](./.env.example). At minimum set **`DATABASE_URL`**.

**Database note:** This app uses **SQLite** via Prisma. A file-based DB on Vercel’s serverless runtime is **not durable** (each invocation may not share the same disk, and the filesystem is ephemeral). For a real production deployment, plan on **Postgres** (e.g. [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) or [Neon](https://neon.tech)) or **Turso** (libSQL), then point `DATABASE_URL` at that service and adjust the Prisma provider/schema as needed. For a smoke-test deploy, you can still verify that the **build** succeeds with a placeholder `DATABASE_URL` if Prisma does not need a live DB at build time (this project runs `prisma generate` in `postinstall` / `build`).

See also: [Next.js deployment](https://nextjs.org/docs/app/building-your-application/deploying).