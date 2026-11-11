# Website hosting

The prepared production address is https://spatial-elements.bergjohann.com/. Connect and verify that domain in Vercel before announcing it as live.

Import the repository with root directory '.', framework preset Other, Node 24, install command npm ci, build command npm run build:website and output directory apps/website/build. vercel.json owns these values. The production branch is main; PRs receive preview deployments.

The website uses adapter-static with explicit pages and assets output 'build', including when VERCEL=1. All showcase detail routes provide prerender entries. The browser adds spatial rendering to prerendered content; no server-side GPU is required. Validate changes with VERCEL=1 and npm run build:website.

Vercel hosting and npm publication are independent. No credentials or project IDs are committed. The default domain and custom DNS connection are configured in the Vercel project.
