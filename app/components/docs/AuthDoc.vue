<template>
  <div>
    <p
      style="
        font-size: 15px;
        line-height: 1.7;
        color: var(--ink-2);
        margin: 12px 0;
      "
    >
      markpost uses bearer tokens. Create one in
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
      >
      and send it in the
      <code
        class="mono"
        style="
          font-size: 13px;
          background: var(--bg-2);
          padding: 2px 6px;
          border-radius: 4px;
          color: var(--accent-700);
        "
        >Authorization</code
      >
      header. Tokens are shown once — store them safely.
    </p>
    <h2 class="h2" style="margin-top: 40px; margin-bottom: 12px">
      Making a request
    </h2>
    <AppCodeBlock
      lang="bash"
      copy="curl -H 'Authorization: Bearer mp_live_…' https://ingest.markpost.io/v1/records"
    >
      <span class="k">curl</span> https://ingest.markpost.io/v1/records \{{
        "\n"
      }}
      -H <span class="s">"Authorization: Bearer mp_live_8f2a…"</span>
    </AppCodeBlock>
    <h2 class="h2" style="margin-top: 40px; margin-bottom: 12px">Errors</h2>
    <p
      style="
        font-size: 15px;
        line-height: 1.7;
        color: var(--ink-2);
        margin: 12px 0;
      "
    >
      The API returns standard HTTP status codes. A
      <code
        class="mono"
        style="
          font-size: 13px;
          background: var(--bg-2);
          padding: 2px 6px;
          border-radius: 4px;
          color: var(--accent-700);
        "
        >401</code
      >
      means a missing or invalid token.
    </p>
    <AppCodeBlock lang="json">
      <span class="k">{{ "{" }}</span
      >{{ "\n" }} <span class="k">"error"</span>:
      <span class="s">"unauthorized"</span>,{{ "\n" }}
      <span class="k">"status"</span>: <span class="n">401</span>{{ "\n"
      }}<span class="k">{{ "}" }}</span>
    </AppCodeBlock>
  </div>
</template>
