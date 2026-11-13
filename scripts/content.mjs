// Everything the profile says, in one place. Edit here, then `npm run build`.
// Numbers and wording follow ritvikdayal.github.io; keep the two in step.

export const person = {
  name: ['Ritvik', 'Dayal'],
  title: 'Senior Software Engineer',
  line: ['Seven layers between a tap and an answer.', 'I hold up the middle five.'],
};

// The seven layers from the site's hero. `mine` marks the middle five.
export const layers = [
  { n: '01', name: 'Surface', mine: false },
  { n: '02', name: 'Kernel', mine: true },
  { n: '03', name: 'Transport', mine: true },
  { n: '04', name: 'Network', mine: true },
  { n: '05', name: 'Platform', mine: true },
  { n: '06', name: 'Data', mine: true },
  { n: '07', name: 'Return', mine: false },
];

export const links = [
  { id: 'portfolio', label: 'Portfolio', href: 'https://ritvikdayal.github.io/', primary: true },
  { id: 'linkedin', label: 'LinkedIn', href: 'https://linkedin.com/in/ritvikdayal' },
  { id: 'x', label: 'X / Twitter', href: 'https://twitter.com/ritvikr98' },
];

export const sections = [
  { id: 'who', n: '01', label: 'Who', headline: ['I build the layers', 'you never see fail.'] },
  { id: 'work', n: '02', label: 'Selected work', headline: ['Things I proposed,', 'built, and shipped.'] },
  { id: 'source', n: '03', label: 'Open source', headline: ['Shipping to strangers', 'is a different job.'] },
  { id: 'stack', n: '04', label: 'Stack', headline: ['The tools, by layer.'] },
  { id: 'signal', n: '05', label: 'Signal', headline: ['The public half.'] },
];

// Headline numbers, two per card. `tone` picks the number's colour: cyan, amber or text.
export const stats = [
  [
    { value: '100×', caption: ['Lower cost per', 'incident investigated'], tone: 'cyan' },
    { value: '$35K+', caption: ['Saved per year on', 'licences and time'], tone: 'amber' },
  ],
  [
    { value: '500+', caption: ['Production incidents', 'auto-investigated'], tone: 'text' },
    { value: '3 min', caption: ['Average, down from', '15–60 by hand'], tone: 'text' },
  ],
];

// A value may mix fonts: plain strings are set in the number face, {mono} segments in JetBrains Mono (arrows).
export const work = [
  {
    id: 'incidents',
    n: '01',
    tag: 'Doxel · 2025',
    title: ['AI incident-investigation', 'platform'],
    body: 'LLM agents with 22+ tools investigate PagerDuty incidents on their own and post root-cause analysis straight to Slack.',
    stats: [
      { value: '< 3 min', caption: ['Average investigation,', 'vs 15–60 manual'], tone: 'cyan' },
      { value: '$0.10–0.40', caption: ['Per incident, against', '~$25 of engineer time'], tone: 'text' },
    ],
    chips: ['LLM agents', 'MCP server', 'GKE', 'Terraform', 'Datadog'],
  },
  {
    id: 'bim',
    n: '02',
    tag: 'Doxel · 2025',
    title: ['Browser-based BIM', 'authoring & review'],
    body: 'One web app in place of three desktop tools: a three.js viewer for 50,000+ element models, a 2D floor-plan editor, PostGIS zone geometry.',
    stats: [
      { value: '50,000+', caption: ['Model elements,', 'rendered in-browser'], tone: 'cyan' },
      { value: ['3 ', { mono: '→' }, ' 1'], caption: ['Desktop tools folded', 'into one web app'], tone: 'amber' },
    ],
    chips: ['three.js', 'WebGL', 'React', 'PostGIS', 'FastAPI'],
  },
  {
    id: 'unglamorous',
    n: '03',
    tag: 'Doxel · 2023–25',
    title: ['The unglamorous half:', 'cost, latency, CVEs'],
    body: 'Synchronous APIs moved to async Kubernetes jobs, compute right-sized with Terraform, and the security checks that supported SOC 2.',
    stats: [
      { value: '25–45%', caption: ['Faster hot-path', 'API responses'], tone: 'cyan' },
      { value: '19', caption: ['CVEs patched in one', 'hardening sprint'], tone: 'text' },
    ],
    chips: ['Kubernetes', 'Terraform', 'Airflow', 'SOC 2'],
  },
  {
    id: 'sandbox',
    n: '04',
    tag: 'GeeksforGeeks · 2022',
    title: ['Code execution around', 'an existing compiler'],
    body: 'An execution server that wraps the compiler in a Docker sandbox and isolates multi-language runs. Wrap the compiler, don’t rebuild it.',
    stats: [
      { value: '30–40%', caption: ['Less cost and', 'complexity'], tone: 'cyan' },
      { value: '−20%', caption: ['Compute at', 'peak traffic'], tone: 'text' },
    ],
    chips: ['Docker sandboxing', 'Python', 'Go', 'Microservices'],
  },
];

export const source = [
  {
    id: 'featherwall',
    tag: 'C# · Windows 10 / 11 · MIT',
    title: ['FeatherWall'],
    href: 'https://github.com/RitvikDayal/featherwall',
    body: 'Live wallpapers for Windows that don’t eat your laptop. One\u00a0process. No browser engine, no launcher, no account.',
    stats: [
      { value: '7 MB', caption: ['The whole', 'application'], tone: 'cyan' },
      { value: '0', caption: ['Browser engines', 'bundled'], tone: 'text' },
    ],
    code: 'winget install RitvikDayal.FeatherWall',
  },
  {
    id: 'whetstone',
    tag: 'Python · CLI · Pre-release',
    title: ['Whetstone'],
    href: 'https://github.com/RitvikDayal/whetstone',
    body: 'Evidence-gated project improvement. Point it at a repository and it finds real, evidence-backed issues in the code and in the running app.',
    steps: ['Hunt', 'Reproduce', 'Falsify', 'Grade'],
    code: 'It never merges and it never deploys.',
    codeIsProse: true,
  },
];

export const stack = [
  { id: 'ai', title: 'AI / LLM systems', items: ['LLM agents (Claude)', 'Agent tool design', 'MCP servers', 'Vision-language models', 'Prompt engineering', 'LLM evaluation & cost optimisation'] },
  { id: 'cloud', title: 'Cloud & infrastructure', items: ['GCP · AWS', 'Kubernetes (GKE)', 'Terraform · Helm', 'Docker', 'Airflow', 'GitHub Actions CI/CD'] },
  { id: 'backend', title: 'Backend & data', items: ['FastAPI · REST APIs', 'Microservices', 'PostgreSQL / PostGIS', 'Redis', 'ETL pipelines', 'Datadog · PagerDuty'] },
  { id: 'lang', title: 'Languages · frontend · 3D', items: ['Python · Go · SQL', 'TypeScript / JavaScript', 'React · Vite', 'three.js', 'WebGL / WebGPU rendering'] },
];

export const recognition = [
  { id: 'award', title: ['Exceptional Innovation and', 'Advancement in AI'], when: 'Q1 2026', body: ['Company-wide award at Doxel,', 'recognising the AI platform work.'] },
  { id: 'sih', title: ['Smart India Hackathon,', 'winner'], when: 'Jan 2020', body: ['Led development of a tool to analyse', 'and visualise CDR and IPDR data.'] },
];

export const footer = {
  headline: 'Got a layer that needs holding up?',
  body: ['AI platforms, distributed backends, cloud architecture,', 'or the security work nobody volunteers for.'],
  sign: 'Ritvik Dayal · Noida, India',
};
