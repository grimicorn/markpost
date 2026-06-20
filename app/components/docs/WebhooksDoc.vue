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
          color: var(--ok);
          background: var(--ok-tint);
          letter-spacing: 0.05em;
        "
      >
        POST
      </span>
      <span class="mono" style="font-size: 14px">/v1/hooks/:source_id</span>
    </div>
    <p
      style="
        font-size: 15px;
        line-height: 1.7;
        color: var(--ink-2);
        margin: 12px 0;
      "
    >
      Send a JSON body to your source's ingest URL. markpost extracts a title
      and body using your mapping rules, then queues a record.
    </p>
    <h2 class="h2" style="margin-top: 40px; margin-bottom: 12px">Request</h2>
    <AppCodeBlock
      lang="bash"
      copy="curl -X POST https://ingest.markpost.io/v1/hooks/wh_8f2a91c4"
    >
      <span class="k">curl</span> -X POST
      https://ingest.markpost.io/v1/hooks/wh_8f2a91c4 \{{ "\n" }} -H
      <span class="s">"Content-Type: application/json"</span> \{{ "\n" }} -d
      <span class="s"
        >'{{
          '{ "title": "Deploy ok", "body": "shipped to prod", "tags": ["ci"] }'
        }}'</span
      >
    </AppCodeBlock>
    <h2 class="h2" style="margin-top: 40px; margin-bottom: 12px">Response</h2>
    <AppCodeBlock lang="json">
      <span class="k">{{ "{" }}</span
      >{{ "\n" }} <span class="k">"id"</span>:
      <span class="s">"rec_a91f2c"</span>,{{ "\n" }}
      <span class="k">"status"</span>: <span class="s">"queued"</span>,{{
        "\n"
      }}
      <span class="k">"file"</span>:
      <span class="s">"99-incoming/deploy-ok.md"</span>{{ "\n"
      }}<span class="k">{{ "}" }}</span>
    </AppCodeBlock>
    <h2 class="h2" style="margin-top: 40px; margin-bottom: 12px">
      Field mapping
    </h2>
    <div class="card" style="overflow: hidden; margin: 14px 0">
      <div
        v-for="([field, type, desc], index) in fieldMap"
        :key="field"
        class="row"
        :style="{
          padding: '11px 16px',
          borderTop: index ? '1px solid var(--line)' : 0,
          gap: '14px',
        }"
      >
        <span
          class="mono"
          style="width: 80px; font-size: 12.5px; color: var(--accent-700)"
          >{{ field }}</span
        >
        <span class="mono faint" style="width: 90px; font-size: 11.5px">{{
          type
        }}</span>
        <span style="font-size: 13.5px; color: var(--ink-2)">{{ desc }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const fieldMap = [
  ["title", "string", "Markdown H1 + frontmatter title"],
  ["body", "string / html", "converted to Markdown body"],
  ["tags", "string[]", "merged into frontmatter tags"],
  ["created", "ISO 8601", "defaults to receipt time"],
] as [string, string, string][];
</script>
