import fs from 'node:fs';
import path from 'node:path';
import Parser from 'rss-parser';

const parser = new Parser();

const today = new Date();
const easternDate = today.toLocaleDateString('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});

const fileDate = today.toLocaleDateString('en-CA', {
  timeZone: 'America/New_York'
});

const generatedAt = today.toLocaleString('en-US', {
  timeZone: 'America/New_York',
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short'
});

const feeds = [
  {
    name: 'Macro / Fed / Markets',
    thesis:
      'Tracks the direction of rates, inflation, liquidity, credit conditions, and risk appetite.',
    url:
      'https://news.google.com/rss/search?q=(site:reuters.com%20OR%20site:ft.com%20OR%20site:wsj.com%20OR%20site:barrons.com)%20(markets%20OR%20economy%20OR%20Federal%20Reserve)%20when:7d&hl=en-US&gl=US&ceid=US:en'
  },
  {
    name: 'AI / Semiconductors / Data Centers',
    thesis:
      'Tracks whether AI remains a capex-led productivity boom or becomes a crowded infrastructure cycle.',
    url:
      'https://news.google.com/rss/search?q=(AI%20OR%20artificial%20intelligence%20OR%20semiconductor%20OR%20Nvidia%20OR%20data%20center%20OR%20hyperscaler)%20markets%20when:7d&hl=en-US&gl=US&ceid=US:en'
  },
  {
    name: 'Consumer / Labor / Housing / Credit',
    thesis:
      'Tracks whether the U.S. consumer is still absorbing inflation, higher rates, and tighter credit.',
    url:
      'https://news.google.com/rss/search?q=(consumer%20OR%20retail%20OR%20spending%20OR%20jobs%20OR%20wages%20OR%20housing%20OR%20credit)%20US%20economy%20when:7d&hl=en-US&gl=US&ceid=US:en'
  },
  {
    name: 'Geopolitics / China / Energy / Trade',
    thesis:
      'Tracks geopolitical shocks that can affect inflation, supply chains, commodities, and defense spending.',
    url:
      'https://news.google.com/rss/search?q=(China%20OR%20tariffs%20OR%20sanctions%20OR%20oil%20OR%20Ukraine%20OR%20Middle%20East%20OR%20shipping)%20markets%20when:7d&hl=en-US&gl=US&ceid=US:en'
  },
  {
    name: 'Industrials / Aerospace / Defense',
    thesis:
      'Tracks the real-economy side of capital spending, reshoring, aerospace demand, and defense procurement.',
    url:
      'https://news.google.com/rss/search?q=(industrial%20OR%20manufacturing%20OR%20aerospace%20OR%20defense%20OR%20Lockheed%20OR%20Boeing)%20markets%20when:7d&hl=en-US&gl=US&ceid=US:en'
  }
];

function clean(value = '') {
  return String(value)
    .replace(/\s+/g, ' ')
    .replace(/ - Google News$/i, '')
    .trim();
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value) {
  if (!value) return 'Date unavailable';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return clean(value);

  return parsed.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function isWithinLastWeek(value) {
  if (!value) return true;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return true;

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return parsed.getTime() >= sevenDaysAgo;
}

function sourceFromTitle(title = '') {
  const parts = title.split(' - ');
  return parts.length > 1 ? clean(parts.at(-1)) : 'Source';
}

function headlineWithoutSource(title = '') {
  const parts = title.split(' - ');
  return clean(parts.length > 1 ? parts.slice(0, -1).join(' - ') : title);
}

function articleImpact(item, category) {
  const text = `${item.title} ${category}`.toLowerCase();

  if (/fed|inflation|rate|yield|jobs|payroll|cpi|pce|treasury/.test(text)) {
    return 'This matters because rate expectations drive equity multiples, credit conditions, housing affordability, and the discount rate applied to long-duration growth assets.';
  }

  if (/ai|nvidia|semiconductor|chip|data center|hyperscaler|power|cooling/.test(text)) {
    return 'This matters because AI is becoming a capital spending cycle. The key question is whether infrastructure investment converts into durable productivity gains and pricing power.';
  }

  if (/consumer|retail|spending|wage|housing|credit|delinquency|loan/.test(text)) {
    return 'This matters because consumer resilience determines whether the economy can keep expanding without reigniting inflation or breaking credit quality.';
  }

  if (/china|tariff|sanction|oil|ukraine|middle east|shipping|trade/.test(text)) {
    return 'This matters because geopolitical pressure can quickly move energy prices, supply chains, inflation expectations, and defense budgets.';
  }

  if (/industrial|manufacturing|aerospace|defense|boeing|lockheed|rtx|supply chain/.test(text)) {
    return 'This matters because industrial and defense activity shows where physical investment, procurement, and reshoring are translating into earnings power.';
  }

  return 'This matters because it may affect investor expectations, sector leadership, or the broader macro narrative over the next several weeks.';
}

function markdownLink(title, url) {
  return `[${title}](${url})`;
}

function markdownToEmailHtml(markdown) {
  const lines = markdown.split('\n');
  const html = [];
  let inList = false;

  function closeList() {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      closeList();
      continue;
    }

    if (line.startsWith('# ')) {
      closeList();
      html.push(`<h1>${inlineMarkdown(line.slice(2))}</h1>`);
      continue;
    }

    if (line.startsWith('## ')) {
      closeList();
      html.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
      continue;
    }

    if (line.startsWith('### ')) {
      closeList();
      html.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
      continue;
    }

    if (line.startsWith('- ')) {
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }

      html.push(`<li>${inlineMarkdown(line.slice(2))}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${inlineMarkdown(line)}</p>`);
  }

  closeList();
  return html.join('\n');
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );
}

async function fetchFeed(feed) {
  const parsed = await parser.parseURL(feed.url);

  return {
    ...feed,
    items: parsed.items
      .filter((item) => isWithinLastWeek(item.pubDate || item.isoDate))
      .slice(0, 5)
      .map((item) => {
        const title = clean(item.title);
        const headline = headlineWithoutSource(title);
        const source = sourceFromTitle(title);

        return {
          title,
          headline,
          source,
          link: item.link,
          date: formatDate(item.pubDate || item.isoDate),
          impact: articleImpact(item, feed.name)
        };
      })
  };
}

function buildMarkdown(sections) {
  const allItems = sections.flatMap((section) =>
    section.items.map((item) => ({ ...item, category: section.name }))
  );

  const topStories = allItems.slice(0, 8);

  const markdown = [];

  markdown.push(`# Daily Macro Briefing - ${easternDate}`);
  markdown.push('');
  markdown.push(`Generated: ${generatedAt}`);
  markdown.push('');
  markdown.push('## Executive Macro Thesis');
  markdown.push('');
  markdown.push(
    'The current macro setup appears to be defined by a three-way tension: resilient nominal growth, persistent uncertainty around inflation and interest rates, and an AI-led capital spending cycle that is reshaping market leadership. The central question is whether productivity gains and corporate investment can offset tighter financial conditions, geopolitical shocks, and pressure on the consumer.'
  );
  markdown.push('');
  markdown.push(
    'For an investment management lens, the most important thing to track is whether market leadership broadens beyond AI infrastructure and mega-cap quality, or whether investors continue paying a premium for companies with visible earnings durability, pricing power, and balance sheet strength.'
  );
  markdown.push('');
  markdown.push('## What Changed In The Last Week');
  markdown.push('');

  if (topStories.length === 0) {
    markdown.push('- No qualifying headlines were found in the last seven days.');
  } else {
    for (const item of topStories.slice(0, 5)) {
      markdown.push(
        `- **${item.category}:** ${markdownLink(item.headline, item.link)}. ${item.impact}`
      );
    }
  }

  markdown.push('');
  markdown.push('## Category Briefings');
  markdown.push('');

  for (const section of sections) {
    markdown.push(`### ${section.name}`);
    markdown.push('');
    markdown.push(`**Why this category matters:** ${section.thesis}`);
    markdown.push('');

    if (section.items.length === 0) {
      markdown.push('- No qualifying headlines found in the last seven days.');
      markdown.push('');
      continue;
    }

    for (const item of section.items) {
      markdown.push(`- **${markdownLink(item.headline, item.link)}**`);
      markdown.push(`  Source: ${item.source}. Published: ${item.date}.`);
      markdown.push(`  Impact: ${item.impact}`);
    }

    markdown.push('');
  }

  markdown.push('## Market Implications');
  markdown.push('');
  markdown.push(
    '- **Rates:** Watch whether incoming inflation and labor data keep rate-cut expectations delayed. Higher-for-longer conditions tend to pressure speculative growth, housing, and leveraged companies.'
  );
  markdown.push(
    '- **AI:** The AI trade is no longer just about model excitement. The key issue is monetization: who earns attractive returns on massive data center, chip, power, and cooling investment?'
  );
  markdown.push(
    '- **Consumer:** Strong spending can support earnings, but it can also keep inflation sticky. Watch the split between higher-income consumers and lower-income consumers using credit.'
  );
  markdown.push(
    '- **Geopolitics:** Energy, shipping, tariffs, sanctions, and defense procurement remain important sources of inflation risk and sector rotation.'
  );
  markdown.push(
    '- **Industrials and Defense:** Reshoring, infrastructure, aerospace backlogs, and defense budgets can create multi-year demand, but execution and supply chain constraints matter.'
  );
  markdown.push('');
  markdown.push('## Questions To Track');
  markdown.push('');
  markdown.push(
    '- Is AI investment producing measurable productivity gains, or mostly pulling forward infrastructure spending?'
  );
  markdown.push(
    '- Is the consumer still healthy, or is spending increasingly dependent on credit and higher-income households?'
  );
  markdown.push(
    '- Are inflation expectations stabilizing enough for the Federal Reserve to ease policy without risking credibility?'
  );
  markdown.push(
    '- Which companies have true pricing power if rates stay elevated and growth slows?'
  );
  markdown.push(
    '- Are defense and industrial names benefiting from durable budget cycles or short-term geopolitical fear?'
  );
  markdown.push('');
  markdown.push('## Personal Thesis Workspace');
  markdown.push('');
  markdown.push(
    'Use this section in Obsidian to build your differentiated view over time.'
  );
  markdown.push('');
  markdown.push('- My current view:');
  markdown.push('- What surprised me today:');
  markdown.push('- What I disagree with:');
  markdown.push('- Companies or sectors to research:');
  markdown.push('- Follow-up questions:');
  markdown.push('');
  markdown.push('## Feedback For Tomorrow');
  markdown.push('');
  markdown.push('- What was useful?');
  markdown.push('- What was too shallow?');
  markdown.push('- What topics should be added?');
  markdown.push('- What sources should be prioritized or removed?');
  markdown.push('');

  return markdown.join('\n');
}

function buildHeadlineHtml(sections) {
  return sections
    .map((section) => {
      const itemsHtml =
        section.items.length === 0
          ? '<p class="muted">No qualifying headlines found in the last seven days.</p>'
          : section.items
              .map(
                (item) => `
                  <div class="headline">
                    <a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">
                      ${escapeHtml(item.headline)}
                    </a>
                    <div class="meta">${escapeHtml(item.source)} · ${escapeHtml(item.date)}</div>
                  </div>
                `
              )
              .join('');

      return `
        <section class="headline-section">
          <h3>${escapeHtml(section.name)}</h3>
          <p class="section-thesis">${escapeHtml(section.thesis)}</p>
          ${itemsHtml}
        </section>
      `;
    })
    .join('');
}

function buildEmailHtml(sections, markdown) {
  const headlineHtml = buildHeadlineHtml(sections);
  const briefingHtml = markdownToEmailHtml(markdown);

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>Daily Macro Briefing</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #000000;
      color: #f5f5f5;
      font-family: Arial, Helvetica, sans-serif;
    }

    .wrap {
      max-width: 760px;
      margin: 0 auto;
      padding: 38px 22px 48px;
    }

    .eyebrow {
      color: #999999;
      font-size: 11px;
      letter-spacing: 1.8px;
      text-transform: uppercase;
      margin-bottom: 10px;
    }

    .title {
      color: #ffffff;
      font-size: 34px;
      line-height: 1.1;
      font-weight: 600;
      margin: 0 0 10px;
    }

    .date {
      color: #aaaaaa;
      font-size: 14px;
      margin-bottom: 28px;
    }

    .top {
      border-bottom: 1px solid #333333;
      margin-bottom: 30px;
      padding-bottom: 22px;
    }

    h2 {
      color: #ffffff;
      font-size: 19px;
      font-weight: 600;
      margin: 0 0 18px;
      padding-bottom: 10px;
      border-bottom: 1px solid #222222;
    }

    h3 {
      color: #ffffff;
      font-size: 16px;
      font-weight: 600;
      margin: 26px 0 8px;
    }

    p {
      color: #e8e8e8;
      font-size: 15px;
      line-height: 1.65;
      margin: 0 0 14px;
    }

    ul {
      margin: 0 0 18px 20px;
      padding: 0;
    }

    li {
      color: #e8e8e8;
      font-size: 15px;
      line-height: 1.65;
      margin-bottom: 9px;
    }

    a {
      color: #ffffff;
      text-decoration: underline;
      text-decoration-color: #666666;
    }

    strong {
      color: #ffffff;
      font-weight: 700;
    }

    .headline-section {
      border-bottom: 1px solid #202020;
      padding-bottom: 20px;
      margin-bottom: 20px;
    }

    .section-thesis {
      color: #aaaaaa;
      font-size: 13px;
      line-height: 1.55;
      margin-bottom: 14px;
    }

    .headline {
      margin: 0 0 16px;
    }

    .headline a {
      font-size: 15px;
      line-height: 1.45;
      font-weight: 600;
    }

    .meta {
      color: #888888;
      font-size: 12px;
      line-height: 1.45;
      margin-top: 4px;
    }

    .muted {
      color: #888888;
      font-size: 14px;
    }

    .briefing {
      border-top: 1px solid #333333;
      margin-top: 36px;
      padding-top: 30px;
    }

    .briefing h1 {
      color: #ffffff;
      font-size: 26px;
      line-height: 1.2;
      margin: 0 0 16px;
    }

    .briefing h2 {
      margin-top: 34px;
    }

    .briefing h3 {
      margin-top: 24px;
    }

    .footer {
      color: #777777;
      font-size: 12px;
      line-height: 1.5;
      border-top: 1px solid #222222;
      margin-top: 38px;
      padding-top: 18px;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="top">
      <div class="eyebrow">Kelley Daily Macro Briefing</div>
      <h1 class="title">Daily News Briefing</h1>
      <div class="date">${escapeHtml(generatedAt)}</div>
    </header>

    <main>
      <section>
        <h2>Headlines</h2>
        ${headlineHtml}
      </section>

      <section class="briefing">
        <div class="eyebrow">Full Briefing</div>
        ${briefingHtml}
      </section>
    </main>

    <footer class="footer">
      This briefing is generated for market learning, investment research, and personal thesis development. Review the source links before relying on any item for investment conclusions.
    </footer>
  </div>
</body>
</html>
`;
}

async function main() {
  const sections = [];

  for (const feed of feeds) {
    try {
      const section = await fetchFeed(feed);
      sections.push(section);
    } catch (error) {
      console.error(`Failed to fetch ${feed.name}:`, error.message);
      sections.push({
        ...feed,
        items: []
      });
    }
  }

  const markdown = buildMarkdown(sections);
  const html = buildEmailHtml(sections, markdown);

  const distDir = path.join(process.cwd(), 'dist');
  const homeDir = path.join(process.cwd(), '00 - Home');
  const dailyDir = path.join(process.cwd(), '01 - Daily Briefings');

  fs.mkdirSync(distDir, { recursive: true });
  fs.mkdirSync(homeDir, { recursive: true });
  fs.mkdirSync(dailyDir, { recursive: true });

  fs.writeFileSync(path.join(distDir, 'email.html'), html);
  fs.writeFileSync(path.join(distDir, 'briefing.md'), markdown);
  fs.writeFileSync(path.join(homeDir, 'Latest Daily Briefing.md'), markdown);
  fs.writeFileSync(
    path.join(dailyDir, `${fileDate} Daily Macro Briefing.md`),
    markdown
  );

  const totalItems = sections.reduce((sum, section) => sum + section.items.length, 0);
  console.log(`Generated enriched briefing with ${totalItems} items.`);
  console.log(`Updated Obsidian note: 00 - Home/Latest Daily Briefing.md`);
  console.log(`Updated daily archive: 01 - Daily Briefings/${fileDate} Daily Macro Briefing.md`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
