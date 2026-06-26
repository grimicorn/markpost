<template>
  <div>
    <h2 class="h2" style="margin-top: 40px; margin-bottom: 12px">
      Install the CLI
    </h2>
    <p
      style="
        font-size: 15px;
        line-height: 1.7;
        color: var(--ink-2);
        margin: 12px 0;
      "
    >
      markpost ships as a single binary. Install it with Homebrew, or grab a
      release for your platform.
    </p>
    <AppCodeBlock lang="bash" copy="brew install markpost/tap/markpost">
      <span class="c"># macOS / Linux</span>{{ "\n"
      }}<span class="k">brew</span> install markpost/tap/markpost{{ "\n\n"
      }}<span class="c"># verify</span>{{ "\n"
      }}<span class="k">markpost</span> --version
    </AppCodeBlock>

    <h2 class="h2" style="margin-top: 40px; margin-bottom: 12px">
      Authenticate
    </h2>
    <p
      style="
        font-size: 15px;
        line-height: 1.7;
        color: var(--ink-2);
        margin: 12px 0;
      "
    >
      Generate a token in
      <code
        class="mono"
        style="
          font-size: 13px;
          background: var(--bg-2);
          padding: 2px 6px;
          border-radius: 4px;
          color: var(--accent-700);
        "
        >Settings → API Tokens</code
      >, then hand it to the CLI. It's stored in
      <code
        class="mono"
        style="
          font-size: 13px;
          background: var(--bg-2);
          padding: 2px 6px;
          border-radius: 4px;
          color: var(--accent-700);
        "
        >~/.markpost/config</code
      >.
    </p>
    <AppCodeBlock lang="bash" copy="markpost auth mp_live_…">
      <span class="k">markpost</span> auth
      <span class="s">mp_live_8f2a91c4…</span>{{ "\n"
      }}<span class="c">✓ token saved to ~/.markpost/config</span>
    </AppCodeBlock>

    <h2 class="h2" style="margin-top: 40px; margin-bottom: 12px">
      Point a source
    </h2>
    <p
      style="
        font-size: 15px;
        line-height: 1.7;
        color: var(--ink-2);
        margin: 12px 0;
      "
    >
      Send any JSON to your webhook URL, or forward an email to your
      <code
        class="mono"
        style="
          font-size: 13px;
          background: var(--bg-2);
          padding: 2px 6px;
          border-radius: 4px;
          color: var(--accent-700);
        "
        >@in.markpost.io</code
      >
      address. The payload becomes a record instantly.
    </p>
    <AppCodeBlock
      lang="bash"
      copy='curl -X POST https://ingest.markpost.io/v1/hooks/wh_8f2a91c4 -d &apos;{"title":"Hello"}&apos;'
    >
      <span class="k">curl</span> -X POST
      https://ingest.markpost.io/v1/hooks/wh_8f2a91c4 \{{ "\n" }} -H
      <span class="s">"Content-Type: application/json"</span> \{{ "\n" }} -d
      <span class="s">'{{ "{" }}"title":"Hello from markpost"{{ "}" }}'</span>
    </AppCodeBlock>

    <h2 class="h2" style="margin-top: 40px; margin-bottom: 12px">Sync</h2>
    <p
      style="
        font-size: 15px;
        line-height: 1.7;
        color: var(--ink-2);
        margin: 12px 0;
      "
    >
      Run the watcher and your records land in your vault as Markdown. That's
      it.
    </p>
    <AppCodeBlock lang="bash" copy="markpost sync --watch --dir ~/vault">
      <span class="k">markpost</span> sync --watch --dir ~/vault{{ "\n"
      }}<span class="c">→ watching for inbound records…</span>{{ "\n"
      }}<span style="color: #4ade80">✓ 99-incoming/hello-from-markpost.md</span>
    </AppCodeBlock>

    <div style="margin-top: 24px">
      <AppAlert tone="ok" title="You're done">
        Every new webhook and email now syncs automatically. Configure naming
        and frontmatter in
        <code
          class="mono"
          style="
            font-size: 13px;
            background: var(--bg-2);
            padding: 2px 6px;
            border-radius: 4px;
            color: var(--accent-700);
          "
          >Settings → Sync</code
        >.
      </AppAlert>
    </div>
  </div>
</template>
