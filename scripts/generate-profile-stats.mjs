import { mkdir, writeFile } from 'node:fs/promises';

const username = 'Syedsameer-10';
const preview = process.argv.includes('--preview');
const token = process.env.GITHUB_TOKEN;
if (!preview && !token) throw new Error('GITHUB_TOKEN is required');

const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const fmt = (value) => new Intl.NumberFormat('en-US').format(value);
const header = (height, label) => `<svg xmlns="http://www.w3.org/2000/svg" width="850" height="${height}" viewBox="0 0 850 ${height}" role="img" aria-label="${esc(label)}"><rect x="1" y="1" width="848" height="${height - 2}" rx="16" fill="#111827" stroke="#303a4b"/><style>text{font-family:Arial,Helvetica,sans-serif}</style>`;

let profile;
if (preview) {
  profile = { contributionsCollection: { contributionCalendar: { totalContributions: null, weeks: [] } }, repositories: { totalCount: null }, followers: { totalCount: null } };
} else {
  const query = `query($login: String!) { user(login: $login) { followers { totalCount } repositories(privacy: PUBLIC, isFork: false) { totalCount } contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount color } } } } } }`;
  const response = await fetch('https://api.github.com/graphql', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'profile-readme' }, body: JSON.stringify({ query, variables: { login: username } }) });
  const result = await response.json();
  if (!response.ok || result.errors?.length || !result.data?.user) throw new Error(`GitHub API failed: ${JSON.stringify(result.errors ?? result.message)}`);
  profile = result.data.user;
}

const calendar = profile.contributionsCollection.contributionCalendar;
const days = calendar.weeks.flatMap((week) => week.contributionDays);
const activeDays = days.filter((day) => day.contributionCount > 0).length;
const metrics = [
  ['CONTRIBUTIONS', calendar.totalContributions],
  ['PUBLIC REPOS', profile.repositories.totalCount],
  ['FOLLOWERS', profile.followers.totalCount],
  ['ACTIVE DAYS', preview ? null : activeDays],
];
let stats = header(180, `${username} GitHub profile stats`);
stats += `<text x="30" y="39" fill="#e7eefb" font-size="21" font-weight="700">GitHub at a glance</text><text x="820" y="38" text-anchor="end" fill="#8b9bb4" font-size="13">${esc(username)}</text>`;
metrics.forEach(([label, value], i) => {
  const x = 30 + i * 205;
  stats += `<rect x="${x}" y="62" width="185" height="88" rx="11" fill="#192337" stroke="#2c3950"/>`;
  stats += `<text x="${x + 16}" y="111" fill="#69a7ff" font-size="30" font-weight="700">${value == null ? '—' : fmt(value)}</text>`;
  stats += `<text x="${x + 16}" y="133" fill="#aebbd0" font-size="11" font-weight="700" letter-spacing="1">${label}</text>`;
});
stats += '</svg>';

let graph = header(198, `${username} contribution calendar`);
graph += `<text x="30" y="38" fill="#e7eefb" font-size="21" font-weight="700">Contribution calendar</text>`;
graph += `<text x="820" y="37" text-anchor="end" fill="#8b9bb4" font-size="13">${preview ? 'Updates after first workflow run' : 'Past 12 months'}</text>`;
const weeks = calendar.weeks.slice(-52);
const palette = ['#202b3b', '#0e4429', '#006d32', '#26a641', '#39d353'];
const max = Math.max(1, ...days.map((day) => day.contributionCount));
for (let w = 0; w < 52; w++) {
  for (let d = 0; d < 7; d++) {
    const day = weeks[w]?.contributionDays[d];
    const count = day?.contributionCount ?? 0;
    const level = count === 0 ? 0 : Math.max(1, Math.min(4, Math.ceil((count / max) * 4)));
    const x = 37 + w * 15;
    const y = 58 + d * 15;
    graph += `<rect x="${x}" y="${y}" width="11" height="11" rx="2" fill="${palette[level]}">${day ? `<title>${esc(day.date)}: ${count} contribution${count === 1 ? '' : 's'}</title>` : ''}</rect>`;
  }
}
graph += `<text x="37" y="182" fill="#8b9bb4" font-size="12">${preview ? 'Run Profile Stats in GitHub Actions to load your activity' : `${fmt(calendar.totalContributions)} contributions in the past year`}</text>`;
graph += '</svg>';

await mkdir('assets', { recursive: true });
await Promise.all([writeFile('assets/stats.svg', stats), writeFile('assets/contributions.svg', graph)]);
