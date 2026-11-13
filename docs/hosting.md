# Website hosting

The prepared production address is https://spatial-elements.bergjohann.com/. Connect and verify that domain in Vercel before announcing it as live.

## First deployment

1. Import `LauridBergjohann/spatial-elements` into Vercel.
2. Keep the **Root Directory** at the repository root (`.`), not `apps/website`. Choose **Other** as the framework preset and **24.x** as the Node.js version.
3. Use the configuration committed in root `vercel.json`: install command `npm ci`, build command `npm run build:website`, output directory `apps/website/build`. The root build also compiles the local packages the website imports.
4. Use `main` as the production branch. Feature branches and pull requests receive preview deployments.
5. Add `spatial-elements.bergjohann.com` under **Settings → Domains** and apply the DNS record Vercel displays. Wait for domain verification and HTTPS before announcing the site.

Do not use the automatically detected `apps/website` SvelteKit project defaults: this repository deliberately builds a static website from its workspace root. No application environment variables are required.

The website uses adapter-static with explicit pages and assets output 'build', including when VERCEL=1. All showcase detail routes provide prerender entries. The browser adds spatial rendering to prerendered content; no server-side GPU is required. Validate changes with VERCEL=1 and npm run build:website.

Vercel hosting and npm publication are independent. No credentials or project IDs are committed. The default domain and custom DNS connection are configured in the Vercel project.

After deployment, open the homepage, a documentation page and a nested product URL directly. Check the logo/favicon, navigation, media selection and the page without JavaScript. A successful npm release does not imply that the Vercel deployment has finished successfully.
