# Game Launcher React App

This is a React + TypeScript game launcher. The main page displays two large video buttons, each with a header and video face. Clicking a button should launch a .exe file (requires Electron or backend for real implementation).

## How to Use

- Replace the placeholder video files in `public/` with your own game preview videos.
- To actually launch `.exe` files, you must use Electron or a backend server. The current implementation only shows a placeholder alert.

## Development

```sh
npm install
npm run dev
```

## Customization

- Edit `src/App.tsx` to change game names, video sources, and .exe paths.
- Update styles in `src/App.css` for layout tweaks.

---

**Note:** Browsers cannot launch `.exe` files directly for security reasons. Use Electron for a real desktop launcher experience.
