# AURA-MINI
A lightweight WhatsApp command bot powered by Baileys.

## Setup

```bash
npm install
cp .env.example .env
npm start
```

On first start, scan the QR code printed in the terminal. For pairing-code login, set `PAIRING_NUMBER` to the full international number without `+` before starting. Session files are stored in `auth/` and are ignored by Git.

## Environment

- `PREFIX`: command prefix, defaults to `!`
- `OWNER_NUMBER`: owner number without punctuation; enables owner commands
- `PAIRING_NUMBER`: optional WhatsApp number for pairing-code login
- `LOG_LEVEL`: optional Pino log level, defaults to `info`

## Commands

Built-in commands are loaded from `commands.js`. Add persistent owner-only commands with:

```text
!addcmd hello Hello from AURA-MINI
!delcmd hello
```

Custom commands are saved in `database/customcmd.json`. A valid JPEG at `menu.jpg` is uploaded for `!menu`; the text menu is used as a fallback until one is supplied.
