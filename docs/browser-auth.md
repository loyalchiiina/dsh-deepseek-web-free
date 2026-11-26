# Browser auth


Browser login uses an isolated profile, CDP orchestration, strict origin
filtering (`https://chat.deepseek.com` only), credential validation, and
redaction. The settings-page diagnostic card keeps a secondary entry that
reuses `LOGIN_PATH`; since 1.0.44 the isolated-browser credential path is
**only for panel guest-token write-back and troubleshooting**, never for an LLM
adapter, never to capture a Bearer token for DSH chat, and never to start
conversations inside DSH.

The plugin does not read the default browser profile, does not capture
cross-site traffic, and does not return tokens to the frontend.
