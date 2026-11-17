# Security policy

Report credential leaks privately to the repository owner. Prefer GitHub
private vulnerability reporting when it is available.

This plugin authenticates with the user's own DeepSeek account. It does not
bypass CAPTCHA, WAF, or account access controls. It never reads the user's
default browser profile.

Do not paste into issues, fixtures, or logs:

- Bearer tokens
- cookies
- Authorization headers
- raw browser profiles

Tests use the documented literal `Bearer TEST_ONLY_TOKEN`.

Session list, history, materialize, and Fork stay on the Host. The browser
client never receives the bearer token, cookies, or raw authentication
material.

Since 1.0.43 every host HTTP route under /plugins/dsh-deepseek-web/ passes
through ctx.connection.requestRejection(req) before its handler (DSH
framework Host/Origin admission and browser authentication), in addition to
the plugin-owned trustedPluginRequest loopback/same-origin check. A missing
or broken gate fails closed with 503; unadmitted requests get 401/403.
