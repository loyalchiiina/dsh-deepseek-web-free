# DeepSeek Web remote sessions

After you sign in on the official page inside the DSH web panel, a compact **DeepSeek Web chats**
control appears in the sidebar footer. It lists conversations from the signed-in
Web account. Opening a row creates or reuses a normal Harness session.

## Continue vs Fork

- Opening a Web conversation continues **that same** remote conversation when
replay metadata is still valid (same account, model, and history prefix).
The popover auto-refresh pauses after you scroll-load extra pages, so it
cannot reset the list while you are at the bottom.
- **Fork to Workspace** sits next to Harness's native branch control. It copies
  history through that turn into a workspace you choose (DeepSeek Chat is listed
  first). It works on any finalized assistant message, not only DeepSeek Web
  chats. Later replies on a DeepSeek Web fork do **not** write into the original
  Web conversation.

Imported user turns keep only the human text. Runtime context, file policy, and
skills that were stored on the Web user turn are stripped. Archive a dirty local
copy and reopen from the sidebar if an older import still shows that extra text.

Opening a Web conversation lands in the **DeepSeek Chat** workspace under the
plugin data directory. Archiving a Harness session hides that copy; opening the
same Web conversation again from the sidebar creates a new live session.

## Replay and fallback

If replay data is missing, too old, or no longer matches (account switch, model
change, edited history, or a rejected remote cursor), the plugin rebuilds a
fresh remote conversation from Harness history instead of appending to the
wrong Web thread.

Restart keeps continuation when the durable assistant replay envelope is still
valid.

## Security

The browser UI never receives the DeepSeek credential. Listing and opening go
through Host plugin routes. Tokens, cookies, and raw authentication material
are not returned to the client.

## Limits

DeepSeek Web APIs are unofficial and can change. Very large histories are
refused rather than silently truncated. A conversation deleted on the Web
between list and open fails with a safe error.
