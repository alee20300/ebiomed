This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Local Authentik sign-in

The local app uses the existing Authentik instance on port `9001` and exposes
its OIDC bridge to LAN devices on port `9003`. OIDC credentials are stored only
in the ignored `.env.local` file. `AUTHENTIK_BROWSER_URL` in that file must use
the Mac's current LAN address when the address changes.

Start Supabase with those credentials loaded, then start both bridge containers:

```bash
set -a
. ./.env.local
set +a
npx supabase start
docker compose -f docker-compose.authentik-oidc.yml up -d --force-recreate
npx supabase migration up --local
```

Run the web app on the LAN with `npm run dev -- --hostname 0.0.0.0 --port 3002`,
then open `http://192.168.1.6:3002/login` and choose **Continue with Authentik**.

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

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
