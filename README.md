This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

## Live Version

This project is already hosted and can be accessed at https://task-and-habit-tracker.vercel.app/.

## Locally

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## .env.local

```bash
NEXT_PUBLIC_SUPABASE_URL=https://nextpublicsupabaseurl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=samplenextpublicsupabaseanonkey
NEXT_PUBLIC_SITE_URL=https://your-hosted-url.vercel.app/
NODE_ENV=development

# Security: Console Logging Control
# Set to 'true' to enable detailed console logging in development
# Set to 'false' or remove to disable all console logs for security
NEXT_PUBLIC_ENABLE_LOGGING=false
```

## Security Features

This project includes comprehensive security measures to protect user data and privacy:

- **Secure Console Logging**: All console logs are controlled through a centralized logger utility
- **Environment-Based Logging**: Logging can be completely disabled in production
- **No Sensitive Data Exposure**: User IDs, database structures, and API details are never logged to the browser console
- **Real-Time Security**: Real-time subscription details are protected from exposure

See [SECURITY.md](./SECURITY.md) for detailed security documentation.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
