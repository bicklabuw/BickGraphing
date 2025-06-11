# Bick Graphing

Check it out here: [Bick Graphing Link](https://ie-graphing-709865.pages.doit.wisc.edu)

## Devoloper Installation Guide

These instructions are made for ubuntu machines:

Install Node:

```
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl software-properties-common
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Config your bash file:

```
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=$HOME/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

Check to see if Node exists

```
node -v
```

If you did this correcly - output should look like this:

```
v20.18.3
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

rm -rf .svelte-kit/ node_modules/.vite/ dist/
pnpm dev # or npm run dev / yarn dev

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Deployment

- This is deployed through github pages. [Bick Graphing](https://ie-graphing-709865.pages.doit.wisc.edu)
-
