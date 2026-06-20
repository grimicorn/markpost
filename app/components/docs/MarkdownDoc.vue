<template>
  <div>
    <h2 class="h2" style="margin-top: 40px; margin-bottom: 12px">
      Frontmatter
    </h2>
    <p
      style="
        font-size: 15px;
        line-height: 1.7;
        color: var(--ink-2);
        margin: 12px 0;
      "
    >
      Each file opens with YAML frontmatter Obsidian reads natively — title,
      source, created and tags.
    </p>
    <AppCodeBlock lang="markdown">
      <span class="c">---</span>{{ "\n" }}<span class="k">title</span>:
      Production deploy succeeded{{ "\n" }}<span class="k">source</span>:
      webhook/github{{ "\n" }}<span class="k">created</span>:
      <span class="s">2026-06-14T09:41:02Z</span>{{ "\n"
      }}<span class="k">tags</span>: [ci, deploy, incoming]{{ "\n"
      }}<span class="c">---</span>
    </AppCodeBlock>
    <h2 class="h2" style="margin-top: 40px; margin-bottom: 12px">
      Filename templates
    </h2>
    <p
      style="
        font-size: 15px;
        line-height: 1.7;
        color: var(--ink-2);
        margin: 12px 0;
      "
    >
      Control the path with tokens. Set the template in
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
    </p>
    <AppCodeBlock lang="text" copy="{{date}}-{{slug}}.md">
      <span class="n">{{ "{{date}}" }}</span>-<span class="n"
        >{{ "{{slug}}" }}</span
      >.md <span class="c">→ 2026-06-14-production-deploy.md</span>{{ "\n"
      }}<span class="n">{{ "{{source}}" }}</span>/<span class="n"
        >{{ "{{slug}}" }}</span
      >.md <span class="c">→ github/production-deploy.md</span>
    </AppCodeBlock>
  </div>
</template>
