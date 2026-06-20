<template>
  <div>
    <p style="font-size: 15px; line-height: 1.7; color: var(--ink-2); margin: 12px 0">
      Every workspace gets a unique inbound address. Send or forward anything to it and the
      message body, subject and date become a clean record.
    </p>
    <AppCodeBlock lang="text" copy="clip-8f2a@in.markpost.io">
      To: <span class="s">clip-8f2a@in.markpost.io</span>{{ "\n"
      }}Subject: Swift concurrency notes{{ "\n\n"
      }}<span class="c">→ 99-incoming/swift-concurrency-notes.md</span>
    </AppCodeBlock>
    <h2 class="h2" style="margin-top: 40px; margin-bottom: 12px">What's stripped</h2>
    <p style="font-size: 15px; line-height: 1.7; color: var(--ink-2); margin: 12px 0">
      markpost removes tracking pixels, signatures and quoted reply chains, then converts the
      remaining HTML to Markdown.
    </p>
    <div style="margin-top: 18px">
      <AppAlert tone="warn" title="Keep it private">
        Anyone with your email-in address can create records. Rotate it from
        <code class="mono" style="font-size: 13px; background: var(--bg-2); padding: 2px 6px; border-radius: 4px; color: var(--accent-700)">Settings → Sources</code>
        if it leaks.
      </AppAlert>
    </div>
  </div>
</template>
