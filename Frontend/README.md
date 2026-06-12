# AeroGuard — Frontend (React + Webpack)

AeroGuard is a third-party risk & SOC 2 compliance platform.

Plain React app bundled with Webpack 5 + Babel (no Vite).

## Scripts

- `npm install` — install dependencies
- `npm start` — start the dev server at http://localhost:3000 (hot reload)
- `npm run build` — production build into `dist/`

## Structure

- `src/index.jsx` — entry point, mounts `<App />`
- `src/tprm-portal.jsx` — the full portal UI
- `public/index.html` — HTML template
- `webpack.config.js` / `.babelrc` — build config

## Backend

The UI talks to the FastAPI backend at `http://localhost:5000`. Run the backend
with `uvicorn main:app --port 5000` from the `Backend/` folder.
