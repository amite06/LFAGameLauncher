# Game Launcher React App

This is the LFA game launcher. The main page displays two large video buttons, each with a header and video face. Clicking a button launches a .exe file (when running in Electron).

## How to Use

- Configure your games and video paths in `public/games-config.json`.
- Place your video files in `public/videos/` (this folder is not tracked by git).

## Development

```sh
npm install
npm run electron:dev
```

This will launch the Electron app in development mode with hot reload.

## Building a Standalone Windows App

```sh
npm run build:react
npm run build:electron
```

The installer and unpacked app will be in the `dist/` folder.

## Customization

- Edit `public/games-config.json` to add or change games, video files, and .exe paths.
- Update styles in `src/App.css` for layout tweaks.

## Prerequisites

- **Node.js**: Download and install from [https://nodejs.org/](https://nodejs.org/)
  - Download the LTS version for your operating system (Windows, macOS, or Linux).
  - After installation, verify with:
    ```sh
    node --version
    npm --version
    ```
- **Git** (optional, for cloning): Download from [https://git-scm.com/](https://git-scm.com/)

---

**Note:** Browsers cannot launch `.exe` files directly for security reasons. Use Electron for a real desktop launcher experience.
