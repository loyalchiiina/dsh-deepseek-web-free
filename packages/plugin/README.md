# dsh-deepseek-web

See the repository README for install, models, tools, and security boundaries.

This package is a DeepSeek Harness plugin. It uses DeepSeek Web through a
compatibility layer, is not the official Open Platform adapter, and does not
bypass CAPTCHA/WAF or account access controls.

After signing in on the official page inside the DSH web panel, the sidebar footer lists DeepSeek Web conversations. Fork
to Workspace creates an independent Harness session that does not write back to
the original Web conversation. Native search stays on for `default`. `/clean`
is a session toggle that sends only the human text.
