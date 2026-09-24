# Carnival POS — Web Version

Static browser version of the Tkinter carnival stall POS. No Flask, no Python, no database server.

Drop this `web` folder on GitHub Pages, Netlify, or any static host. You can also just open `index.html`.

## Run it

Open `web/index.html` in a browser, or from this folder:

```bash
npx --yes serve .
```

## What it includes

- Stall login and create-stall
- Per-stall menu and cart
- Add and edit menu items, including photos
- Complete order + saveable receipt
- Data saved in the browser with `localStorage` (same machine/browser only)

Sample stall: **Burger Station** / `burger123`

## Put it live on GitHub Pages

1. Push this repo to GitHub.
2. Repo **Settings → Pages → Source** = **GitHub Actions**.
3. The workflow in `.github/workflows/pages.yml` publishes the `web` folder.
4. After the Action turns green, the site URL is:
   `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

Stalls, menus, and orders stay in that visitor's browser. They are not a shared live database.
