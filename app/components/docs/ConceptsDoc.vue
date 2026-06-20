<template>
  <div>
    <h2 class="h2" style="margin-top: 40px; margin-bottom: 12px">Records</h2>
    <p style="font-size: 15px; line-height: 1.7; color: var(--ink-2); margin: 12px 0">
      A <strong>record</strong> is one inbound item — a single webhook payload or one email —
      captured server-side and converted to Markdown. One record becomes exactly one
      <code class="mono" style="font-size: 13px; background: var(--bg-2); padding: 2px 6px; border-radius: 4px; color: var(--accent-700)">.md</code> file.
    </p>
    <h2 class="h2" style="margin-top: 40px; margin-bottom: 12px">Sources</h2>
    <p style="font-size: 15px; line-height: 1.7; color: var(--ink-2); margin: 12px 0">
      A <strong>source</strong> is where records come from: a webhook endpoint, an email-in
      address, or an integration. Each has its own credentials and routing rules.
    </p>
    <h2 class="h2" style="margin-top: 40px; margin-bottom: 12px">Sync</h2>
    <p style="font-size: 15px; line-height: 1.7; color: var(--ink-2); margin: 12px 0">
      <strong>Sync</strong> is the CLI pulling pending records and writing them to disk. With
      <code class="mono" style="font-size: 13px; background: var(--bg-2); padding: 2px 6px; border-radius: 4px; color: var(--accent-700)">--watch</code>
      it runs continuously; with auto-delete on, the server copy is removed once the file is
      safely written.
    </p>
    <div style="margin-top: 22px">
      <AppAlert tone="info" title="Local-first by design">
        markpost is a relay, not a store. The server holds records only until your machine
        collects them.
      </AppAlert>
    </div>
  </div>
</template>
