# Mocktail Matcher (QVAC)

Describe what you feel like, like "fruity and fizzy for a summer party" or "cozy and warm for winter", and find **alcohol-free drinks that fit by meaning** from a list of 25, each with ingredients and simple steps. Type ingredients to **leave out** (like coconut or milk) and those drinks are skipped. Save your favorites.

It runs **on your own computer** using [QVAC](https://github.com/tetherto/qvac), Tether's open-source AI SDK.
No API key, no cloud service, and what you type never leaves your machine.

![screenshot](screenshot.png)

## SDK version

`@qvac/sdk` **0.19.0** (declared in `package.json`)

Functions used: `loadModel` and `embed`, with the `EMBEDDINGGEMMA_300M_Q4_0` model.

## Install

You need [Node.js](https://nodejs.org) 22 or newer and some free disk space for the model.

```bash
git clone https://github.com/misaki-codex/qvac-mocktail-matcher.git
cd qvac-mocktail-matcher
npm install
```

## Run

```bash
npm start
```

Then open **http://localhost:3076** (the address, not the HTML file). The first start downloads the model.
While it loads, keyword matching is used instead, so it always works.

## How it works

- `drinks.js` holds 25 alcohol-free drinks with a flavor description, ingredients and steps. Add your own.
- Drinks containing anything you want to leave out are removed first. Then `server.js` ranks the rest with QVAC's `embed`.
- Every drink is alcohol-free. For allergies, check each ingredient's label.
- The server listens on `127.0.0.1`, so only your own computer can reach it.

## Troubleshooting

If you see `RPC_INIT_TIMEOUT`, the QVAC worker was slow to start. `server.js` already waits 3 minutes.
Set `QVAC_RPC_INIT_TIMEOUT_MS` (milliseconds) before `npm start` to wait longer, and make sure no other
QVAC app is running at the same time. If you see `ERR_MODULE_NOT_FOUND`, delete the `node_modules` folder
and run `npm install` again (this usually means an install was interrupted, for example by a full disk).

## License

MIT
