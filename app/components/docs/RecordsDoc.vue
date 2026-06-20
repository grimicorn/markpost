<template>
  <div>
    <div class="row gap-3" style="align-items: center; margin: 8px 0 4px">
      <span
        class="mono"
        style="
          font-size: 11px;
          font-weight: 600;
          padding: 2px 7px;
          border-radius: 4px;
          color: var(--info);
          background: var(--info-tint);
          letter-spacing: 0.05em;
        "
      >
        GET
      </span>
      <span class="mono" style="font-size: 14px">/v1/records</span>
    </div>
    <p style="font-size: 15px; line-height: 1.7; color: var(--ink-2); margin: 12px 0">
      Returns records newest-first. Filter by
      <code class="mono" style="font-size: 13px; background: var(--bg-2); padding: 2px 6px; border-radius: 4px; color: var(--accent-700)">?status=pending</code>
      or
      <code class="mono" style="font-size: 13px; background: var(--bg-2); padding: 2px 6px; border-radius: 4px; color: var(--accent-700)">?source=email</code>.
    </p>
    <AppCodeBlock lang="json">
      <span class="k">{{"{"}}</span>{{ "\n"
      }}  <span class="k">"data"</span>: [{{ "\n"
      }}    <span class="k">{{"{"}}</span> <span class="k">"id"</span>: <span class="s">"rec_a91f"</span>, <span class="k">"title"</span>: <span class="s">"Deploy ok"</span>, <span class="k">"status"</span>: <span class="s">"synced"</span> <span class="k">{{"}"}}</span>{{ "\n"
      }}  ],{{ "\n"
      }}  <span class="k">"next"</span>: <span class="s">null</span>{{ "\n"
      }}<span class="k">{{"}"}}</span>
    </AppCodeBlock>
  </div>
</template>
